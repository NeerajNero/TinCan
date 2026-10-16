/**
 * Security-rules tests against the Firebase emulators.
 * Run with `pnpm test:rules` (needs Java for the emulators and `pnpm rules:build` first).
 * Allowlisted emails come from .env.local / .env so the generated rules match.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { child, get, push, ref, remove, set, update } from "firebase/database";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const root = resolve(__dirname, "..");
function parseEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/\s+#.*$/, "").replace(/^(['"])(.*)\1$/, "$2")];
      }),
  );
}
const env = { ...parseEnv(resolve(root, ".env")), ...parseEnv(resolve(root, ".env.local")) };
const [EMAIL_A, EMAIL_B] = (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
const CLOUD = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "demo";
const A = "uid-a";
const B = "uid-b";
const STRANGER = "uid-stranger";

let env$: RulesTestEnvironment;

beforeAll(async () => {
  if (!EMAIL_A || !EMAIL_B) throw new Error("ALLOWED_EMAILS needs two emails for the rules tests");
  env$ = await initializeTestEnvironment({
    projectId: "tincan-rules-test",
    firestore: { rules: readFileSync(resolve(root, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8181 },
    database: { rules: readFileSync(resolve(root, "database.rules.json"), "utf8"), host: "127.0.0.1", port: 9191 },
  });
});
afterAll(async () => env$?.cleanup());
beforeEach(async () => {
  await env$.clearFirestore();
  await env$.clearDatabase();
});

const asA = () => env$.authenticatedContext(A, { email: EMAIL_A, email_verified: true });
const asB = () => env$.authenticatedContext(B, { email: EMAIL_B, email_verified: true });
const asStranger = () => env$.authenticatedContext(STRANGER, { email: "someone@example.com", email_verified: true });

const seed = (fn: (db: ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"] extends () => infer R ? R : never) => Promise<void>) =>
  env$.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

describe("allowlist", () => {
  it("a non-allowlisted Google user can read nothing", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC" });
      await setDoc(doc(db, "messages/m1"), { senderId: A, type: "text", text: "hi", status: "sent", createdAt: new Date() });
    });
    const db = asStranger().firestore();
    await assertFails(getDoc(doc(db, "pair/main")));
    await assertFails(getDoc(doc(db, "messages/m1")));
    await assertFails(getDoc(doc(db, `users/${A}`)));
    await assertFails(get(ref(asStranger().database(), `presence/${A}`)));
  });
});

describe("messages", () => {
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, "messages/m1"), { senderId: A, type: "text", text: "hello", status: "sent", reactions: {}, deliveredAt: null, readAt: null, deletedFor: [], deletedForEveryone: false, createdAt: new Date() });
    }),
  );
  it("the friend can mark delivered and read, but not edit or delete", async () => {
    const db = asB().firestore();
    await assertSucceeds(updateDoc(doc(db, "messages/m1"), { deliveredAt: serverTimestamp(), status: "delivered" }));
    await assertSucceeds(updateDoc(doc(db, "messages/m1"), { readAt: serverTimestamp(), status: "read" }));
    await assertFails(updateDoc(doc(db, "messages/m1"), { text: "tampered" }));
    await assertFails(updateDoc(doc(db, "messages/m1"), { deletedForEveryone: true }));
    await assertFails(setDoc(doc(db, "messages/m1"), { senderId: B, type: "text", text: "x" }));
  });
  it("only the sender may create, with a server timestamp and a bounded text", async () => {
    const db = asA().firestore();
    const base = { senderId: A, type: "text", status: "sent", reactions: {}, deliveredAt: null, readAt: null, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, "messages/m2"), { ...base, text: "ok" }));
    await assertFails(setDoc(doc(db, "messages/m3"), { ...base, senderId: B, text: "spoofed" }));
    await assertFails(setDoc(doc(db, "messages/m4"), { ...base, text: "x".repeat(2001) }));
    await assertFails(setDoc(doc(db, "messages/m5"), { ...base, text: "ok", createdAt: new Date(0) }));
    await assertFails(setDoc(doc(db, "messages/m6"), { ...base, text: "ok", extra: "field" }));
  });
  it("image media must point at our Cloudinary cloud", async () => {
    const db = asA().firestore();
    const base = { senderId: A, type: "image", text: "", status: "sent", reactions: {}, deliveredAt: null, readAt: null, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, "messages/i1"), { ...base, media: { url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/tincan/images/a.jpg`, publicId: "tincan/images/a" } }));
    await assertFails(setDoc(doc(db, "messages/i2"), { ...base, media: { url: "https://evil.example/x.jpg", publicId: "x" } }));
  });
  it("authenticated media with signed variants is accepted; a foreign variant is not", async () => {
    const db = asA().firestore();
    const base = { senderId: A, type: "image", text: "", status: "sent", reactions: {}, deliveredAt: null, readAt: null, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp() };
    const signed = (t: string) => `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--AbCd_12---/${t}/tincan/images/a`;
    const variants = { w320: signed("w_320"), w640: signed("w_640"), w800: signed("w_800"), blur: signed("e_blur:2000"), original: signed("v1") };
    await assertSucceeds(setDoc(doc(db, "messages/a1"), { ...base, media: { url: variants.original, publicId: "tincan/images/a", variants } }));
    await assertFails(setDoc(doc(db, "messages/a2"), { ...base, media: { url: variants.original, publicId: "tincan/images/a", variants: { ...variants, w320: "https://evil.example/x.jpg" } } }));
    await assertFails(setDoc(doc(db, "messages/a3"), { ...base, media: { url: variants.original, publicId: "tincan/images/a", variants: { ...variants, extra: signed("x") } } }));
    await assertFails(setDoc(doc(db, "messages/a4"), { ...base, media: { url: `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/tincan/images/a`, publicId: "tincan/images/a" } }));
  });
});

describe("private bodies", () => {
  it("a capsule body is hidden from the friend until unlockAt", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const past = new Date(Date.now() - 60 * 1000);
    await seed(async (db) => {
      await setDoc(doc(db, "capsules/c1"), { authorId: A, title: "t", unlockAt: future, openedAt: null, openedBy: null, photoCount: 0, createdAt: new Date() });
      await setDoc(doc(db, "capsules/c1/private/body"), { body: "secret", media: [] });
      await setDoc(doc(db, "capsules/c2"), { authorId: A, title: "t", unlockAt: past, openedAt: null, openedBy: null, photoCount: 0, createdAt: new Date() });
      await setDoc(doc(db, "capsules/c2/private/body"), { body: "open", media: [] });
    });
    await assertFails(getDoc(doc(asB().firestore(), "capsules/c1/private/body")));
    await assertSucceeds(getDoc(doc(asB().firestore(), "capsules/c2/private/body")));
    await assertSucceeds(getDoc(doc(asA().firestore(), "capsules/c1/private/body")));
  });
  it("an envelope body is hidden from the recipient until they open it", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "envelopes/e1"), { authorId: A, forUid: B, label: "sad", openedAt: null, createdAt: new Date() });
      await setDoc(doc(db, "envelopes/e1/private/body"), { body: "there there" });
    });
    const db = asB().firestore();
    await assertFails(getDoc(doc(db, "envelopes/e1/private/body")));
    await assertSucceeds(updateDoc(doc(db, "envelopes/e1"), { openedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db, "envelopes/e1/private/body")));
  });
});

describe("places", () => {
  it("deleting a place may unlink the friend's photos, but only in the same batch and only placeId", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC" });
      await setDoc(doc(db, "places/p1"), { name: "Cafe", lat: 1, lng: 2, kind: "been", addedBy: A });
      await setDoc(doc(db, "memories/m1"), { uploaderId: B, url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/tincan/images/b.jpg`, publicId: "tincan/images/b", w: 4, h: 3, caption: "", placeId: "p1" });
    });
    const db = asA().firestore();
    // While the place still exists, A can't touch B's photo.
    await assertFails(updateDoc(doc(db, "memories/m1"), { placeId: null }));
    const batch = writeBatch(db);
    batch.delete(doc(db, "places/p1"));
    batch.update(doc(db, "memories/m1"), { placeId: null });
    await assertSucceeds(batch.commit());
    // Once it's gone, nothing but placeId may change.
    await assertFails(updateDoc(doc(db, "memories/m1"), { caption: "mine now" }));
  });
});

describe("lists", () => {
  it("gift ideas are invisible to the other person", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "lists/gifts/items/g1"), { text: "a scarf", note: "", url: "", addedBy: A, done: false, doneAt: null, order: 0, createdAt: new Date() });
    });
    await assertFails(getDoc(doc(asB().firestore(), "lists/gifts/items/g1")));
    await assertSucceeds(getDoc(doc(asA().firestore(), "lists/gifts/items/g1")));
    await assertSucceeds(getDocs(query(collection(asB().firestore(), "lists/gifts/items"), where("addedBy", "==", B))));
  });
});

describe("pair/main", () => {
  it("uids can't be changed or dropped", async () => {
    await seed(async (db) => setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC" }));
    const db = asA().firestore();
    await assertFails(updateDoc(doc(db, "pair/main"), { uids: [A] }));
    await assertFails(updateDoc(doc(db, "pair/main"), { uids: [A, STRANGER] }));
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { relationship: "best-friends" }));
  });
});

describe("rtdb pings", () => {
  it("children are creatable only by the other user and deletable only by the owner", async () => {
    const dbB = asB().database();
    const dbA = asA().database();
    const pushed = push(ref(dbB, `pings/${A}`));
    await assertSucceeds(set(pushed, { from: B, kind: "hug", at: Date.now() }));
    await assertFails(set(push(ref(dbA, `pings/${A}`)), { from: A, kind: "hug", at: Date.now() }));
    await assertFails(set(push(ref(dbB, `pings/${A}`)), { from: A, kind: "hug", at: Date.now() }));
    await assertFails(remove(child(ref(dbB, `pings/${A}`), pushed.key as string)));
    await assertSucceeds(remove(child(ref(dbA, `pings/${A}`), pushed.key as string)));
  });
  it("presence is own-write only and the page is bounded", async () => {
    await assertSucceeds(update(ref(asA().database(), `presence/${A}`), { online: true, page: "/" }));
    await assertFails(update(ref(asB().database(), `presence/${A}`), { online: false }));
    await assertFails(update(ref(asA().database(), `presence/${A}`), { page: "x".repeat(101) }));
  });
});
