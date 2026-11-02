/**
 * Security-rules tests against the Firebase emulators.
 * Run with `pnpm test:rules` (needs Java for the emulators and `pnpm rules:build` first).
 * Allowlisted emails come from .env.local / .env so the generated rules match.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { child, get, limitToLast, push, query as rtdbQuery, ref, remove, serverTimestamp as rtdbServerTimestamp, set, update } from "firebase/database";
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rulesVersion } from "../scripts/lib/rules-version.mjs";
import { extractFirestoreRulesVersion, extractRtdbRulesVersion } from "../src/lib/rulesVersion";


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
// Local: .env / .env.local. CI: the workflow env (placeholders in .github/workflows/ci.yml) wins.
const env = { ...parseEnv(resolve(root, ".env")), ...parseEnv(resolve(root, ".env.local")), ...process.env };
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
  it("kind and meta are allowed on system lines only, and stay small", async () => {
    const db = asA().firestore();
    const sys = { senderId: A, type: "system", text: "🍪 Sam fed Mochi", status: "sent", reactions: {}, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, "messages/s1"), { ...sys, kind: "pet-fed", meta: { who: "Sam", pet: "Mochi" } }));
    await assertSucceeds(setDoc(doc(db, "messages/s2"), sys)); // the pre-phase-18 shape
    await assertFails(setDoc(doc(db, "messages/s3"), { ...sys, type: "text", kind: "pet-fed" }));
    await assertFails(setDoc(doc(db, "messages/s4"), { ...sys, type: "text", meta: { a: 1 } }));
    await assertFails(setDoc(doc(db, "messages/s5"), { ...sys, kind: "x".repeat(33) }));
    await assertFails(setDoc(doc(db, "messages/s6"), { ...sys, meta: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, i])) }));
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

  it("holds the shared chat wallpaper (phase 22b): built-in ids and our photos only", async () => {
    await seed(async (db) => setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC" }));
    const db = asB().firestore();
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { chatBg: { id: "dots" }, chatBgBy: B }));
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { chatBg: { id: "photo", photoUrl: `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--abcdefgh--/w_640/tincan/images/x.jpg`, photoPublicId: "tincan/images/x" }, chatBgBy: B }));
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { chatBg: null, chatBgBy: B }));
    await assertFails(updateDoc(doc(db, "pair/main"), { chatBg: { id: "photo", photoUrl: "https://evil.example.com/x.jpg" } }));
    await assertFails(updateDoc(doc(db, "pair/main"), { chatBg: { id: "dots", extra: 1 } }));
    await assertFails(updateDoc(doc(db, "pair/main"), { chatBg: "dots" }));
  });

  it("holds Play usage (recent ≤ 8, favourites ≤ 6, nothing else)", async () => {
    await seed(async (db) => setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC" }));
    const db = asA().firestore();
    const row = (i: number) => ({ id: `g${i}`, at: 1000 + i, by: A });
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { "play.recent": [row(1), row(2)] }));
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { "play.favourites": ["chess", "watch"] }));
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { play: { recent: Array.from({ length: 8 }, (_, i) => row(i)), favourites: Array.from({ length: 6 }, (_, i) => `f${i}`) } }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "play.recent": Array.from({ length: 9 }, (_, i) => row(i)) }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "play.favourites": Array.from({ length: 7 }, (_, i) => `f${i}`) }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "play.other": 1 }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "play.recent": "chess" }));
    await assertFails(updateDoc(doc(db, "pair/main"), { play: ["chess"] }));
  });
});

describe("users: legacy chatBg", () => {
  const user = (chatBg?: unknown) => ({ name: "A", nickname: "A", email: EMAIL_A, photoURL: null, tz: "UTC", city: "X", lat: 0, lng: 0, fcmTokens: [], notif: { enabled: false }, createdAt: new Date(), ...(chatBg === undefined ? {} : { chatBg }) });
  it("can no longer be written, but the migration may delete it", async () => {
    await seed(async (db) => setDoc(doc(db, `users/${A}`), user()));
    const db = asA().firestore();
    await assertFails(updateDoc(doc(db, `users/${A}`), { chatBg: { id: "dots" } }));
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { nickname: "Aa" }));
    await seed(async (adb) => setDoc(doc(adb, `users/${A}`), user({ id: "dots" })));
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { chatBg: deleteField() }));
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

describe("playlists", () => {
  const item = (n: number) => ({ videoId: `vid${String(n).padStart(8, "0")}`, title: `Song ${n}`, addedBy: A, addedAt: n });
  const items = (count: number) => Array.from({ length: count }, (_, i) => item(i));
  it("both of you may save up to 50 items, signed with your own uid", async () => {
    await assertSucceeds(setDoc(doc(asA().firestore(), "playlists/watch"), { items: items(50), updatedAt: serverTimestamp(), updatedBy: A }));
    await assertSucceeds(setDoc(doc(asB().firestore(), "playlists/watch"), { items: items(2), updatedAt: serverTimestamp(), updatedBy: B }));
    await assertSucceeds(getDoc(doc(asB().firestore(), "playlists/watch")));
  });
  it("over 50 items, someone else's updatedBy, extra keys or an unknown room are rejected", async () => {
    const db = asA().firestore();
    await assertFails(setDoc(doc(db, "playlists/listen"), { items: items(51), updatedAt: serverTimestamp(), updatedBy: A }));
    await assertFails(setDoc(doc(db, "playlists/listen"), { items: items(1), updatedAt: serverTimestamp(), updatedBy: B }));
    await assertFails(setDoc(doc(db, "playlists/listen"), { items: items(1), updatedAt: serverTimestamp(), updatedBy: A, extra: true }));
    await assertFails(setDoc(doc(db, "playlists/radio"), { items: items(1), updatedAt: serverTimestamp(), updatedBy: A }));
    await assertFails(getDoc(doc(asStranger().firestore(), "playlists/watch")));
  });
});

describe("rtdb roomchat", () => {
  const msg = (uid: string, text = "hi") => ({ uid, text, at: Date.now() - 1000 });
  it("the owner creates; the wrong uid, over 500 chars or an unknown room are rejected", async () => {
    const db = asA().database();
    await assertSucceeds(set(push(ref(db, "roomchat/watch")), msg(A)));
    await assertSucceeds(set(push(ref(db, "roomchat/listen")), msg(A, "x".repeat(500))));
    await assertFails(set(push(ref(db, "roomchat/watch")), msg(B)));
    await assertFails(set(push(ref(db, "roomchat/watch")), msg(A, "x".repeat(501))));
    await assertFails(set(push(ref(db, "roomchat/watch")), msg(A, "")));
    await assertFails(set(push(ref(db, "roomchat/radio")), msg(A)));
    await assertFails(set(push(ref(db, "roomchat/watch")), { ...msg(A), extra: 1 }));
    await assertFails(set(push(ref(db, "roomchat/watch")), { ...msg(A), at: Date.now() + 60_000 }));
    await assertFails(get(ref(asStranger().database(), "roomchat/watch")));
  });
  it("no edits; either of you may delete (trim) or clear the room", async () => {
    const a = push(ref(asA().database(), "roomchat/watch"));
    await assertSucceeds(set(a, msg(A)));
    await assertFails(set(a, msg(A, "edited")));
    await assertFails(update(a, { text: "edited" }));
    await assertSucceeds(update(ref(asB().database(), "roomchat/watch"), { [a.key as string]: null }));
    await assertSucceeds(set(push(ref(asB().database(), "roomchat/watch")), msg(B)));
    await assertSucceeds(remove(ref(asA().database(), "roomchat/watch")));
    await assertFails(set(ref(asA().database(), "roomchat/watch"), { x: msg(A) }));
  });
});

describe("rtdb trivia live node", () => {
  const node = (db: ReturnType<typeof asA>["database"] extends () => infer R ? R : never, id = "r1") => ref(db, `trivia/${id}`);
  it("each player joins under their own uid only", async () => {
    await assertSucceeds(update(node(asA().database()), { [`joined/${A}`]: Date.now() }));
    await assertSucceeds(update(node(asB().database()), { [`joined/${B}`]: Date.now() }));
    await assertFails(update(node(asA().database()), { [`joined/${B}`]: Date.now() }));
    await assertFails(update(node(asA().database()), { [`joined/${A}`]: "soon" }));
    await assertFails(get(node(asStranger().database())));
  });
  it("starting rewrites the node with the other player's join left as it was", async () => {
    const dbA = asA().database();
    await assertSucceeds(update(node(dbA), { [`joined/${A}`]: 1000 }));
    await assertSucceeds(update(node(asB().database()), { [`joined/${B}`]: 2000 }));
    // The transaction's shape: everything plus the new cursor fields.
    await assertSucceeds(set(node(dbA), { joined: { [A]: 1000, [B]: 2000 }, qIndex: 0, qStartedAt: Date.now() + 3000, startedBy: A }));
    await assertFails(set(node(dbA), { joined: { [A]: 1000, [B]: 2001 }, qIndex: 0, qStartedAt: Date.now(), startedBy: A }));
    await assertFails(update(node(dbA), { qIndex: "zero" }));
    await assertFails(update(node(dbA), { extra: true }));
  });
  it("answers are own-key only; advancing clears them and keeps the rest", async () => {
    const dbA = asA().database();
    const dbB = asB().database();
    await env$.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), "trivia/r1"), { joined: { [A]: 1, [B]: 2 }, qIndex: 0, qStartedAt: 5, startedBy: A }));
    await assertSucceeds(update(node(dbA), { [`answered/${A}`]: 2 }));
    await assertSucceeds(update(node(dbB), { [`answered/${B}`]: -1 }));
    await assertFails(update(node(dbA), { [`answered/${B}`]: 3 }));
    await assertFails(update(node(dbA), { [`answered/${A}`]: "b" }));
    // advanceLive from B: whole-node rewrite with answered gone and A's join untouched.
    await assertSucceeds(set(node(dbB), { joined: { [A]: 1, [B]: 2 }, qIndex: 1, qStartedAt: 6, startedBy: A }));
    // Either player may drop the live node (switch to async).
    await assertSucceeds(remove(node(dbB)));
  });
});

describe("rtdb invites", () => {
  const invite = (from: string, extra: Record<string, unknown> = {}) => ({ from, activity: "trivia", label: "a Trivia duel", route: "/play/trivia/abc?join=1", at: Date.now() - 500, ...extra });
  it("the other user creates, the owner deletes, nobody else reads", async () => {
    const dbA = asA().database();
    const dbB = asB().database();
    const pushed = push(ref(dbB, `invites/${A}`));
    await assertSucceeds(set(pushed, invite(B)));
    await assertFails(set(push(ref(dbA, `invites/${A}`)), invite(A)));
    await assertFails(set(push(ref(dbB, `invites/${A}`)), invite(A)));
    await assertFails(remove(child(ref(dbB, `invites/${A}`), pushed.key as string)));
    await assertSucceeds(get(ref(dbA, `invites/${A}`)));
    await assertFails(get(ref(dbB, `invites/${A}`)));
    await assertSucceeds(remove(child(ref(dbA, `invites/${A}`), pushed.key as string)));
  });
  it("validates the shape: activity ≤ 32, label 1–80, a same-origin route, at ≤ now, nothing else", async () => {
    const q = ref(asB().database(), `invites/${A}`);
    await assertFails(set(push(q), invite(B, { label: "" })));
    await assertFails(set(push(q), invite(B, { label: "x".repeat(81) })));
    await assertFails(set(push(q), invite(B, { activity: "x".repeat(33) })));
    await assertFails(set(push(q), invite(B, { route: "https://evil.example/" })));
    await assertFails(set(push(q), invite(B, { route: "//evil.example/" })));
    await assertFails(set(push(q), invite(B, { route: "/play/" + "x".repeat(100) })));
    await assertFails(set(push(q), invite(B, { at: Date.now() + 60_000 })));
    await assertFails(set(push(q), invite(B, { extra: 1 })));
    const { at: _at, ...noAt } = invite(B);
    void _at;
    await assertFails(set(push(q), noAt));
    await assertSucceeds(set(push(q), invite(B, { route: "/play/watch" })));
  });
});

describe("invite system lines", () => {
  const sys = (meta: Record<string, unknown> | undefined, kind = "invite") => ({ senderId: A, type: "system", kind, text: "🎯 Sam started a Trivia duel", status: "sent", reactions: {}, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp(), ...(meta ? { meta } : {}) });
  const meta = { route: "/play/trivia/abc", activity: "trivia", label: "a Trivia duel", expiresAt: Date.now() + 7_200_000 };
  it("needs route, activity, label and expiresAt; roundId is optional; nothing else", async () => {
    const db = asA().firestore();
    await assertSucceeds(setDoc(doc(db, "messages/v1"), sys(meta)));
    await assertSucceeds(setDoc(doc(db, "messages/v2"), sys({ ...meta, roundId: "abc" })));
    await assertFails(setDoc(doc(db, "messages/v3"), sys(undefined)));
    const { expiresAt: _e, ...noExpiry } = meta;
    void _e;
    await assertFails(setDoc(doc(db, "messages/v4"), sys(noExpiry)));
    await assertFails(setDoc(doc(db, "messages/v5"), sys({ ...meta, extra: 1 })));
    await assertFails(setDoc(doc(db, "messages/v6"), sys({ ...meta, route: "https://evil.example/" })));
    await assertFails(setDoc(doc(db, "messages/v6b"), sys({ ...meta, route: "//evil.example/" })));
    await assertFails(setDoc(doc(db, "messages/v7"), sys({ ...meta, label: "" })));
    await assertFails(setDoc(doc(db, "messages/v8"), sys({ ...meta, expiresAt: "later" })));
    // Other kinds keep the loose shape.
    await assertSucceeds(setDoc(doc(db, "messages/v9"), sys({ who: "Sam" }, "pet-fed")));
  });
});

describe("rtdb gameReactions: a queue created as yourself, deleted by either, never edited", () => {
  it("validates the shape and the writer", async () => {
    const dbA = asA().database();
    const dbB = asB().database();
    await assertSucceeds(set(ref(dbA, "gameReactions/g1/r1"), { by: A, emoji: "👏", at: 1 }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r2"), { by: B, emoji: "👏", at: 1 }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r3"), { by: A, emoji: "", at: 1 }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r4"), { by: A, emoji: "👏👏👏👏👏", at: 1 }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r5"), { by: A, emoji: "👏", at: "now" }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r6"), { by: A, emoji: "👏", at: 1, extra: true }));
    await assertFails(set(ref(dbA, "gameReactions/g1/r1"), { by: A, emoji: "😂", at: 2 }));
    await assertSucceeds(get(ref(dbB, "gameReactions/g1")));
    await assertSucceeds(remove(ref(dbB, "gameReactions/g1/r1")));
    await assertFails(get(ref(asStranger().database(), "gameReactions/g1")));
  });

  it("accepts exactly what the hook writes: push + set with a server timestamp, then the sender's own delete", async () => {
    const dbA = asA().database();
    const node = push(ref(dbA, "gameReactions/g2"));
    await assertSucceeds(set(node, { by: A, emoji: "👏", at: rtdbServerTimestamp() }));
    await assertSucceeds(get(ref(asB().database(), "gameReactions/g2")));
    await assertSucceeds(remove(node));
    const byB = push(ref(asB().database(), "gameReactions/g2"));
    await assertSucceeds(set(byB, { by: B, emoji: "😂", at: rtdbServerTimestamp() }));
    await assertSucceeds(remove(ref(dbA, `gameReactions/g2/${byB.key}`)));
  });

  it("accepts every game type's id (Hangman, Battleship, a board game) and one with no game node at all", async () => {
    const game = (type: string) => ({ type, state: "{}", turn: "first", players: { first: A, second: B }, status: "active", open: true, createdBy: A, createdAt: 1, lastMoveAt: 1, moves: 0 });
    await env$.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database();
      await set(ref(db, "games/-NhangmanGame"), game("hangman"));
      await set(ref(db, "games/-NbattleshipGame"), game("battleship"));
      await set(ref(db, "games/-NchessGame"), game("chess"));
    });
    for (const id of ["-NhangmanGame", "-NbattleshipGame", "-NchessGame", "-NnoSuchGame"]) {
      const dbA = asA().database();
      const dbB = asB().database();
      // The hook's own read: the last 12 children.
      await assertSucceeds(get(rtdbQuery(ref(dbB, `gameReactions/${id}`), limitToLast(12))));
      const node = push(ref(dbA, `gameReactions/${id}`));
      await assertSucceeds(set(node, { by: A, emoji: "😱", at: rtdbServerTimestamp() }));
      await assertSucceeds(remove(ref(dbB, `gameReactions/${id}/${node.key}`)));
      await assertFails(get(ref(asStranger().database(), `gameReactions/${id}`)));
    }
  });
});

describe("rtdb meta: the RULES_VERSION marker", () => {
  it("is readable by the pair, never writable by a client, and the built rules carry this checkout's version", async () => {
    const version = rulesVersion(root);
    await assertSucceeds(get(ref(asA().database(), "meta/rulesVersion")));
    await assertFails(get(ref(asStranger().database(), "meta/rulesVersion")));
    await assertFails(set(ref(asA().database(), "meta/rulesVersion"), version));
    await assertFails(set(ref(asA().database(), "meta/rulesVersion"), "deadbeef"));
    await assertFails(set(ref(asB().database(), "meta/other"), 1));
    // The deploy stamps it with admin access (the CLI), which the `.write: false` doesn't bind.
    await env$.withSecurityRulesDisabled(async (ctx) => set(ref(ctx.database(), "meta/rulesVersion"), version));
    await assertSucceeds(get(ref(asB().database(), "meta/rulesVersion")));
    expect(extractRtdbRulesVersion(readFileSync(resolve(root, "database.rules.json"), "utf8"))).toBe(version);
    expect(extractFirestoreRulesVersion(readFileSync(resolve(root, "firestore.rules"), "utf8"))).toBe(version);
  });
});

describe("rtdb games: new types and the owner-only private subtree", () => {
  const node = (players = { first: A, second: B }) => ({ type: "battleship", state: "{}", turn: "first", players, status: "active", open: true, createdBy: A, createdAt: 1, lastMoveAt: 1, moves: 0, winnerId: null, endReason: null });

  it("accepts the three new game types and still rejects unknown ones", async () => {
    const db = asA().database();
    await assertSucceeds(set(ref(db, "games/g1"), node()));
    await assertSucceeds(set(ref(db, "games/g2"), { ...node(), type: "hangman" }));
    await assertSucceeds(set(ref(db, "games/g3"), { ...node(), type: "dots" }));
    await assertFails(set(ref(db, "games/g4"), { ...node(), type: "poker" }));
  });

  it("gamePrivate/{id}/{uid} is readable and writable by that uid only", async () => {
    const dbA = asA().database();
    const dbB = asB().database();
    await assertSucceeds(set(ref(dbA, `gamePrivate/g1/${A}`), { word: "ice cream", round: 0 }));
    await assertSucceeds(set(ref(dbB, `gamePrivate/g1/${B}`), { fleet: JSON.stringify([{ r: 0, c: 0, len: 5, dir: "h" }]) }));
    await assertSucceeds(get(ref(dbA, `gamePrivate/g1/${A}`)));
    await assertFails(get(ref(dbB, `gamePrivate/g1/${A}`)));
    await assertFails(get(ref(dbB, "gamePrivate/g1")));
    await assertFails(get(ref(dbB, "gamePrivate")));
    await assertFails(set(ref(dbB, `gamePrivate/g1/${A}`), { word: "peek", round: 0 }));
    await assertFails(update(ref(dbB, `gamePrivate/g1/${A}`), { word: null }));
    await assertFails(get(ref(asStranger().database(), `gamePrivate/g1/${A}`)));
  });

  it("validates the private shape: lower-case letters and spaces ≤ 20 for the word, a short fleet string, nothing else", async () => {
    const db = asA().database();
    const mine = ref(db, `gamePrivate/g1/${A}`);
    await assertFails(set(mine, { word: "Apple", round: 0 }));
    await assertFails(set(mine, { word: "a".repeat(21), round: 0 }));
    await assertFails(set(mine, { word: " apple", round: 0 }));
    await assertFails(set(mine, { word: "apple", round: "one" }));
    await assertFails(set(mine, { fleet: "x".repeat(601) }));
    await assertFails(set(mine, { word: "apple", round: 0, secret: true }));
    await assertSucceeds(set(mine, { word: "apple", round: 0 }));
    await assertSucceeds(remove(mine));
  });
});

/* ── phase 27: snaps, notes, home layout, view-once ─────────────────────── */

const signedSnap = (t: string, id = "s1") => `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--AbCd_12---/${t}/tincan/snaps/${id}`;
const snapVariants = (id = "s1") => ({ w320: signedSnap("w_320", id), w640: signedSnap("w_640", id), w800: signedSnap("w_800", id), blur: signedSnap("e_blur:2000", id), original: signedSnap("v1", id) });
const snapEntry = (id = "s1", extra: Record<string, unknown> = {}) => ({ url: signedSnap("v1", id), publicId: `tincan/snaps/${id}`, variants: snapVariants(id), w: 1080, h: 1440, caption: "hi", at: serverTimestamp(), onTime: true, later: false, savedToMemories: false, ...extra });
const DAY = "2026-11-02";

describe("snaps: the friend's entry opens only once mine exists", () => {
  it("B is refused A's entry before posting and allowed after; a stranger never", async () => {
    const dbA = asA().firestore();
    const dbB = asB().firestore();
    await assertSucceeds(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("a1")));
    await assertSucceeds(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, posted: { [A]: true }, thumbs: { [A]: signedSnap("w_320", "a1") } }, { merge: true }));
    // Before B posts: the summary is readable, the entry is not.
    await assertSucceeds(getDoc(doc(dbB, `snaps/${DAY}`)));
    await assertFails(getDoc(doc(dbB, `snaps/${DAY}/entries/${A}`)));
    await assertSucceeds(getDoc(doc(dbA, `snaps/${DAY}/entries/${A}`)));
    // B posts (later), then may read A's.
    await assertSucceeds(setDoc(doc(dbB, `snaps/${DAY}/entries/${B}`), snapEntry("b1", { onTime: false, later: true })));
    await assertSucceeds(setDoc(doc(dbB, `snaps/${DAY}`), { dateKey: DAY, posted: { [B]: true }, thumbs: { [B]: signedSnap("w_320", "b1") }, later: { [B]: true } }, { merge: true }));
    await assertSucceeds(getDoc(doc(dbB, `snaps/${DAY}/entries/${A}`)));
    await assertSucceeds(getDoc(doc(dbA, `snaps/${DAY}/entries/${B}`)));
    await assertFails(getDoc(doc(asStranger().firestore(), `snaps/${DAY}/entries/${A}`)));
    await assertFails(getDoc(doc(asStranger().firestore(), `snaps/${DAY}`)));
    // The Memories query shape.
    await assertSucceeds(getDocs(query(collection(dbB, "snaps"), where("dateKey", "<=", DAY))));
  });

  it("an entry is written only by its owner, once, with our Cloudinary asset and a server time", async () => {
    const dbA = asA().firestore();
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${B}`), snapEntry("x")));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { url: "https://evil.example/x.jpg" })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { at: new Date(0) })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { caption: "c".repeat(61) })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { savedToMemories: true })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { onTime: true, later: true })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { onTime: "yes" })));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("x", { extra: 1 })));
    await assertSucceeds(setDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), snapEntry("a1")));
    await assertFails(deleteDoc(doc(dbA, `snaps/${DAY}/entries/${A}`)));
  });

  it("edits: the owner may fix the caption within ten minutes; either may keep a snap; nothing else changes", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `snaps/${DAY}/entries/${A}`), { ...snapEntry("a1"), at: new Date() });
      await setDoc(doc(db, `snaps/${DAY}/entries/${B}`), { ...snapEntry("b1"), at: new Date(Date.now() - 11 * 60_000) });
      await setDoc(doc(db, `snaps/${DAY}`), { dateKey: DAY, posted: { [A]: true, [B]: true } });
    });
    const dbA = asA().firestore();
    const dbB = asB().firestore();
    await assertSucceeds(updateDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), { caption: "better" }));
    await assertFails(updateDoc(doc(dbB, `snaps/${DAY}/entries/${B}`), { caption: "too late" }));
    await assertFails(updateDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), { later: true }));
    await assertFails(updateDoc(doc(dbA, `snaps/${DAY}/entries/${A}`), { url: signedSnap("v1", "other") }));
    await assertFails(updateDoc(doc(dbB, `snaps/${DAY}/entries/${A}`), { caption: "not mine" }));
    // Save to memories: either person, any time, only to true.
    await assertSucceeds(updateDoc(doc(dbB, `snaps/${DAY}/entries/${A}`), { savedToMemories: true }));
    await assertSucceeds(updateDoc(doc(dbB, `snaps/${DAY}/entries/${B}`), { savedToMemories: true }));
    await assertFails(updateDoc(doc(dbB, `snaps/${DAY}/entries/${A}`), { savedToMemories: false }));
  });

  it("the summary takes only the poster's own keys, our thumbnail, and the id as dateKey", async () => {
    const dbA = asA().firestore();
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, posted: { [B]: true } }, { merge: true }));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: "2026-01-01", posted: { [A]: true } }, { merge: true }));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, posted: { [A]: true }, thumbs: { [A]: "https://evil.example/t.jpg" } }, { merge: true }));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, posted: { [A]: true }, extra: 1 }, { merge: true }));
    await assertSucceeds(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, posted: { [A]: true }, thumbs: { [A]: signedSnap("w_320", "a1") } }, { merge: true }));
    await assertFails(setDoc(doc(dbA, `snaps/${DAY}`), { dateKey: DAY, thumbs: { [B]: signedSnap("w_320", "b1") } }, { merge: true }));
    await assertFails(deleteDoc(doc(dbA, `snaps/${DAY}`)));
  });

  it("pair.snap: a client may write the streak but never move today's minute", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pair/main"), { uids: [A, B], roomTz: "UTC", friendsSince: null, nextMeetup: null, snap: { todayKey: DAY, todayAt: 1_800_000_000_000 } });
    });
    const db = asA().firestore();
    await assertSucceeds(updateDoc(doc(db, "pair/main"), { "snap.streak": { count: 1, lastDateKey: DAY, best: 1 } }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "snap.todayAt": 1 }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "snap.todayKey": "2026-01-01" }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "snap.streak": { count: 1, lastDateKey: DAY, best: 1, extra: true } }));
    await assertFails(updateDoc(doc(db, "pair/main"), { "snap.other": 1 }));
  });
});

describe("users: homeCards and note are owner-only and shaped", () => {
  const user = (uid: string, email: string) => ({ name: "n", nickname: "nick", email, photoURL: null, tz: "UTC", city: "c", lat: 0, lng: 0, fcmTokens: [], notif: { enabled: false }, createdAt: new Date() });
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, `users/${A}`), user(A, EMAIL_A ?? ""));
      await setDoc(doc(db, `users/${B}`), user(B, EMAIL_B ?? ""));
    }),
  );
  it("homeCards: order and hidden lists, nothing else, only on my own doc; lastOpenAt is a timestamp", async () => {
    const db = asA().firestore();
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { lastOpenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { lastOpenAt: "now" }));
    await assertFails(updateDoc(doc(db, `users/${B}`), { lastOpenAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { homeCards: { order: ["pet", "presence"], hidden: ["lamp"] } }));
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { homeCards: deleteField() }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { homeCards: { order: ["pet"], hidden: [], extra: 1 } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { homeCards: { order: "pet", hidden: [] } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { homeCards: { order: Array.from({ length: 25 }, (_, i) => `c${i}`), hidden: [] } }));
    await assertFails(updateDoc(doc(db, `users/${B}`), { homeCards: { order: ["pet"], hidden: [] } }));
  });
  it("note: 1–60 chars, optional emoji, server time, an expiry; null clears it", async () => {
    const db = asA().firestore();
    const note = { text: "coffee run", emoji: "☕", at: serverTimestamp(), expiresAt: new Date(Date.now() + 86_400_000) };
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { note }));
    await assertSucceeds(updateDoc(doc(db, `users/${A}`), { note: null }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { note: { ...note, text: "" } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { note: { ...note, text: "x".repeat(61) } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { note: { ...note, extra: 1 } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { note: { text: "no expiry", at: serverTimestamp() } }));
    await assertFails(updateDoc(doc(db, `users/${A}`), { note: { ...note, at: "now" } }));
    await assertFails(updateDoc(doc(db, `users/${B}`), { note }));
    await assertSucceeds(getDoc(doc(asB().firestore(), `users/${A}`)));
  });
});

describe("messages: view-once", () => {
  const image = (extra: Record<string, unknown> = {}) => ({ senderId: A, type: "image", text: "", status: "sent", reactions: {}, deliveredAt: null, readAt: null, deletedFor: [], deletedForEveryone: false, createdAt: serverTimestamp(), media: { url: `${signedSnap("v1").replace("/snaps/", "/images/")}?once=1`, publicId: "tincan/images/s1" }, ...extra });
  it("the sender may flag a photo or voice note, not a text, and never pre-set viewedAt", async () => {
    const db = asA().firestore();
    await assertSucceeds(setDoc(doc(db, "messages/v1"), image({ viewOnce: true, viewedAt: null })));
    await assertSucceeds(setDoc(doc(db, "messages/v2"), image({ viewOnce: false })));
    await assertFails(setDoc(doc(db, "messages/v3"), image({ type: "text", media: null, viewOnce: true })));
    await assertFails(setDoc(doc(db, "messages/v4"), image({ viewOnce: "yes" })));
    await assertFails(setDoc(doc(db, "messages/v5"), image({ viewOnce: true, viewedAt: serverTimestamp() })));
  });
  it("viewedAt is written only by the recipient, only on a view-once message, only once, with the server time", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "messages/v1"), { ...image({ viewOnce: true, viewedAt: null }), createdAt: new Date() });
      await setDoc(doc(db, "messages/plain"), { ...image(), createdAt: new Date() });
    });
    const dbA = asA().firestore();
    const dbB = asB().firestore();
    await assertFails(updateDoc(doc(dbA, "messages/v1"), { viewedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbB, "messages/plain"), { viewedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbB, "messages/v1"), { viewedAt: new Date(0) }));
    await assertFails(updateDoc(doc(dbB, "messages/v1"), { viewedAt: serverTimestamp(), text: "x" }));
    await assertSucceeds(updateDoc(doc(dbB, "messages/v1"), { viewedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbB, "messages/v1"), { viewedAt: serverTimestamp() }));
    // The usual receipts still work alongside.
    await assertSucceeds(updateDoc(doc(dbB, "messages/v1"), { readAt: serverTimestamp(), status: "read" }));
  });
});

describe("inbox (phase 28): server-written rows the owner lists and deletes; the owner may only zero the badge", () => {
  const user = (uid: string, email: string) => ({ name: "n", nickname: "nick", email, photoURL: null, tz: "UTC", city: "c", lat: 0, lng: 0, fcmTokens: [], notif: { enabled: false }, inbox: { unread: 3 }, createdAt: new Date() });
  const row = { type: "ping", title: "nick", body: "👋 waved at you", url: "/", count: 1, createdAt: new Date() };
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, `users/${A}`), user(A, EMAIL_A ?? ""));
      await setDoc(doc(db, `users/${B}`), user(B, EMAIL_B ?? ""));
      await setDoc(doc(db, `inbox/${A}/items/i1`), row);
      await setDoc(doc(db, `inbox/${A}/items/i2`), { ...row, type: "message", title: "nick", body: "hi", count: 2 });
    }),
  );
  it("rows: the owner reads and deletes, never creates or edits; the friend and strangers see nothing", async () => {
    const a = asA().firestore();
    await assertSucceeds(getDocs(query(collection(a, `inbox/${A}/items`))));
    await assertSucceeds(getDoc(doc(a, `inbox/${A}/items/i1`)));
    await assertSucceeds(deleteDoc(doc(a, `inbox/${A}/items/i1`)));
    await assertFails(setDoc(doc(a, `inbox/${A}/items/i3`), row));
    await assertFails(updateDoc(doc(a, `inbox/${A}/items/i2`), { count: 9 }));
    await assertFails(getDoc(doc(a, `inbox/${A}`)));
    const b = asB().firestore();
    await assertFails(getDocs(query(collection(b, `inbox/${A}/items`))));
    await assertFails(getDoc(doc(b, `inbox/${A}/items/i2`)));
    await assertFails(deleteDoc(doc(b, `inbox/${A}/items/i2`)));
    await assertFails(getDocs(query(collection(asStranger().firestore(), `inbox/${A}/items`))));
  });
  it("users.inbox: zero + a server-time stamp is the only client write; counts, other keys and the friend's doc are refused", async () => {
    const a = asA().firestore();
    // While the count is 3, zeroing without the stamp, or with a bad one, is refused…
    await assertFails(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 0 }));
    await assertFails(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 0, "inbox.lastReadAt": "now" }));
    await assertFails(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 5, "inbox.lastReadAt": serverTimestamp() }));
    // …and zero + server time is the one allowed write.
    await assertSucceeds(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 0, "inbox.lastReadAt": serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(a, `users/${A}`), { nickname: "still me" })); // untouched inbox never blocks other edits
    await assertFails(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 2 }));
    await assertFails(updateDoc(doc(a, `users/${A}`), { inbox: { unread: 0, lastReadAt: serverTimestamp(), extra: 1 } }));
    await assertFails(updateDoc(doc(asB().firestore(), `users/${A}`), { "inbox.unread": 0, "inbox.lastReadAt": serverTimestamp() }));
  });
  it("users.inbox: a server-bumped count on my own doc never blocks an unrelated edit", async () => {
    await seed(async (db) => updateDoc(doc(db, `users/${A}`), { "inbox.unread": 12 }));
    const a = asA().firestore();
    await assertSucceeds(updateDoc(doc(a, `users/${A}`), { bio: "hello" }));
    await assertSucceeds(updateDoc(doc(a, `users/${A}`), { "inbox.unread": 0, "inbox.lastReadAt": serverTimestamp() }));
  });
});
