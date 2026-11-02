/**
 * Home's in-app digest (phase 27b): what happened since `users/{me}.lastOpenAt`,
 * assembled from data Home already holds (no new listeners) into the shared
 * `DigestInput`, so the card and the morning push say the same things.
 */
import type { DigestInput } from "@/lib/digest";
import { noteLine, noteVisible } from "@/lib/notes";
import { statFrom } from "@/lib/pet";
import { SNAP_WINDOW_MS } from "@/lib/snap";
import type { DailyQuestionDoc, PairDoc, SnapSummaryDoc, UserNote } from "@/lib/types";

export interface HomeDigestSource {
  uid: string;
  friendUid: string;
  /** `users/{me}.lastOpenAt` in ms, or null on the very first open (then only "current state" items show). */
  sinceMs: number | null;
  now: number;
  today: string;
  unread: number;
  snapSummary: Pick<SnapSummaryDoc, "posted"> | null;
  schedule: PairDoc["snap"] | undefined;
  friendNote: UserNote | null | undefined;
  daily: Pick<DailyQuestionDoc, "answers"> | null;
  /** From the open-games list. */
  myTurn: number;
  invites: number;
  jar: PairDoc["jar"] | undefined;
  milestonesToday: string[];
  pet: PairDoc["pet"] | undefined;
}

const after = (ms: number | null | undefined, since: number | null): boolean => typeof ms === "number" && (since === null || ms > since);

/** Everything that happened since the last open, as the digest understands it. */
export function homeDigestInput(src: HomeDigestSource): DigestInput {
  const { since, now } = { since: src.sinceMs, now: src.now };
  const todayAt = src.schedule?.todayKey === src.today ? src.schedule.todayAt : null;
  const friendPosted = src.snapSummary?.posted?.[src.friendUid] === true;
  const note = src.friendNote && noteVisible(src.friendNote, now) ? src.friendNote : null;
  const friendAnswerAt = src.daily?.answers?.[src.friendUid]?.at?.toMillis?.() ?? null;
  const jarAdded = src.jar?.addedBy === src.friendUid && after(src.jar.addedAt, since);
  const jarDrawn = src.jar?.drawnBy === src.friendUid && after(src.jar.drawnAt, since);
  return {
    yourTurn: src.myTurn,
    invites: src.invites,
    jarNotes: 0,
    dailyUnanswered: false,
    pet: src.pet ? { name: src.pet.name, food: statFrom(src.pet.hungerAt, now), joy: 100 } : null,
    capsulesToday: 0,
    milestonesToday: src.milestonesToday,
    unread: src.unread,
    // The friend's post is "new" when my last open was before today's minute (the summary carries no post time).
    friendSnapPosted: friendPosted && todayAt !== null && (since === null || since < todayAt + SNAP_WINDOW_MS),
    friendNote: note && after(note.at?.toMillis?.(), since) ? noteLine(note) : null,
    friendAnswered: after(friendAnswerAt, since),
    jarAdded,
    jarDrawn,
  };
}
