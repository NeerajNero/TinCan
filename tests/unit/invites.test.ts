import { afterEach, describe, expect, it } from "vitest";

import { firebaseErrorCode, isPermissionDenied } from "@/lib/diagLog";
import { rtdbPath } from "@/lib/firebase/rt";
import { INVITE_COOLDOWN_MS, INVITE_TTL_MS, inviteAllowed, inviteCardState, inviteCooldownLeft, inviteText, isInviteRoute, joinRoute, markInvited, parseInviteMeta, resetInviteCooldowns } from "@/lib/invites";

afterEach(() => resetInviteCooldowns());

describe("invite meta", () => {
  const meta = { route: "/play/trivia/abc", activity: "trivia", label: "a Trivia duel", expiresAt: 1000, roundId: "abc" };
  it("parses the stored shape and drops a hand-made one", () => {
    expect(parseInviteMeta(meta)).toEqual(meta);
    const { roundId: _r, ...noRound } = meta;
    void _r;
    expect(parseInviteMeta(noRound)).toEqual(noRound);
    expect(parseInviteMeta({ ...meta, activity: "laser-show" })).toBeNull();
    expect(parseInviteMeta({ ...meta, route: "https://evil.example/" })).toBeNull();
    expect(parseInviteMeta({ ...meta, expiresAt: "later" })).toBeNull();
    expect(parseInviteMeta({ ...meta, label: "  " })).toBeNull();
    expect(parseInviteMeta(null)).toBeNull();
    expect(parseInviteMeta(["x"])).toBeNull();
  });
  it("accepts only bounded same-origin routes", () => {
    expect(isInviteRoute("/play/watch")).toBe(true);
    expect(isInviteRoute("/play/abc?join=1")).toBe(true);
    expect(isInviteRoute("play/watch")).toBe(false);
    expect(isInviteRoute("//evil.example")).toBe(false);
    expect(isInviteRoute("/" + "x".repeat(100))).toBe(false);
  });
  it("writes the chat line and the join route", () => {
    expect(inviteText("Sam", "a Trivia duel")).toBe("🎯 Sam started a Trivia duel");
    expect(inviteText("Sam", "x".repeat(100)).length).toBeLessThanOrEqual("🎯 Sam started ".length + 80);
    expect(joinRoute("/play/abc")).toBe("/play/abc?join=1");
    expect(joinRoute("/play/abc?x=1")).toBe("/play/abc?x=1&join=1");
  });
  it("the card is open, then ended once the round is over, and expired after two hours whatever the round", () => {
    const m = { expiresAt: 10_000 + INVITE_TTL_MS };
    expect(inviteCardState(m, "unknown", 10_000)).toBe("open");
    expect(inviteCardState(m, "open", 10_000)).toBe("open");
    expect(inviteCardState(m, "ended", 10_000)).toBe("ended");
    expect(inviteCardState(m, "open", m.expiresAt)).toBe("expired");
    expect(inviteCardState(m, "ended", m.expiresAt + 1)).toBe("expired");
  });
});

describe("invite cooldown", () => {
  it("allows one per activity per two minutes, independently per activity", () => {
    const t0 = 5_000_000;
    expect(inviteAllowed("trivia", t0)).toBe(true);
    markInvited("trivia", t0);
    expect(inviteAllowed("trivia", t0 + 1)).toBe(false);
    expect(inviteCooldownLeft("trivia", t0 + 30_000)).toBe(INVITE_COOLDOWN_MS - 30_000);
    expect(inviteAllowed("trivia", t0 + INVITE_COOLDOWN_MS)).toBe(true);
    expect(inviteAllowed("watch", t0 + 1)).toBe(true);
    expect(inviteCooldownLeft("watch", t0 + 1)).toBe(0);
  });
});

describe("reported Firebase failures", () => {
  it("reads the code off either SDK's error and recognises a rules rejection", () => {
    expect(firebaseErrorCode({ code: "permission-denied", message: "Missing or insufficient permissions." })).toBe("permission-denied");
    expect(firebaseErrorCode({ code: "PERMISSION_DENIED", message: "PERMISSION_DENIED: Permission denied" })).toBe("PERMISSION_DENIED");
    expect(firebaseErrorCode({ code: "firestore/unavailable" })).toBe("unavailable");
    expect(firebaseErrorCode(new TypeError("x"))).toBe("TypeError");
    expect(firebaseErrorCode(null)).toBe("unknown");
    expect(isPermissionDenied("permission-denied")).toBe(true);
    expect(isPermissionDenied("PERMISSION_DENIED")).toBe(true);
    expect(isPermissionDenied("unavailable")).toBe(false);
  });
  it("logs the node path, never the database host", () => {
    expect(rtdbPath({ toString: () => "https://tincan-default-rtdb.firebaseio.com/trivia/abc" })).toBe("trivia/abc");
    expect(rtdbPath({ ref: { toString: () => "https://x.firebaseio.com/games" }, toString: () => "query" })).toBe("games");
    expect(rtdbPath({ toString: () => "https://x.firebaseio.com/" })).toBe("/");
  });
});
