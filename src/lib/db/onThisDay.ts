/**
 * "On this day": what the two of you did exactly a year and a month ago,
 * fetched once per room day on the first Home open and cached in localStorage
 * (key `tincan:onthisday`, keyed by today's dateKey), so later opens cost
 * nothing. Four one-shot queries per look-back date: photos (≤ 3), the daily
 * question doc, one journal entry, both moods.
 */
import { fromZonedTime } from "date-fns-tz";

import { addDays } from "@/lib/dates";
import { dailyRef } from "@/lib/db/daily";
import { memoriesCol } from "@/lib/db/memories";
import { getDb } from "@/lib/firebase/client";
import { collection, getDoc, getDocs, limit, query, Timestamp, where, type CollectionReference } from "@/lib/firebase/fs";
import { readPref, writePref } from "@/lib/localPref";
import { LOOKBACKS, type LookbackSpan } from "@/lib/onThisDay";
import type { DateKey, JournalDoc, MediaVariants, MoodDoc } from "@/lib/types";

const CACHE_KEY = "tincan:onthisday";
const PHOTO_LIMIT = 3;

export interface OnThisDayPhoto {
  id: string;
  url: string;
  variants?: MediaVariants;
  w: number;
  h: number;
  caption: string;
}
export interface OnThisDayItem {
  span: LookbackSpan;
  label: string;
  dateKey: DateKey;
  photos: OnThisDayPhoto[];
  question: { index: number; answers: Record<string, string> } | null;
  journal: { id: string; authorId: string; text: string; mood: string } | null;
  /** uid → emoji */
  moods: Record<string, string>;
}
interface Cache {
  today: DateKey;
  items: OnThisDayItem[];
}

export const hasContent = (i: OnThisDayItem) => i.photos.length > 0 || i.question !== null || i.journal !== null || Object.keys(i.moods).length > 0;

/** The cached result for `today`, or null when it was fetched on another day (or never). */
export function readOnThisDayCache(today: DateKey): OnThisDayItem[] | null {
  const raw = readPref(CACHE_KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Cache;
    return c.today === today && Array.isArray(c.items) ? c.items : null;
  } catch {
    return null;
  }
}

async function lookBack(span: LookbackSpan, label: string, dateKey: DateKey, roomTz: string): Promise<OnThisDayItem> {
  const start = Timestamp.fromDate(fromZonedTime(`${dateKey}T00:00:00`, roomTz));
  const end = Timestamp.fromDate(fromZonedTime(`${addDays(dateKey, 1)}T00:00:00`, roomTz));
  const journalCol = collection(getDb(), "journal") as CollectionReference<JournalDoc>;
  const moodsCol = collection(getDb(), "moods") as CollectionReference<MoodDoc>;
  const [photos, daily, journal, moods] = await Promise.all([
    getDocs(query(memoriesCol(), where("takenAt", ">=", start), where("takenAt", "<", end), limit(PHOTO_LIMIT))),
    getDoc(dailyRef(dateKey)),
    getDocs(query(journalCol, where("createdAt", ">=", start), where("createdAt", "<", end), limit(1))),
    getDocs(query(moodsCol, where("dateKey", "==", dateKey), limit(2))),
  ]);
  const d = daily.data();
  const answers = Object.fromEntries(Object.entries(d?.answers ?? {}).map(([uid, a]) => [uid, a.text]));
  const j = journal.docs[0];
  return {
    span,
    label,
    dateKey,
    photos: photos.docs.map((p) => {
      const m = p.data();
      return { id: p.id, url: m.url, variants: m.variants, w: m.w, h: m.h, caption: m.caption };
    }),
    question: d && Object.keys(answers).length > 0 ? { index: d.questionIndex, answers } : null,
    journal: j ? { id: j.id, authorId: j.data().authorId, text: j.data().text, mood: j.data().mood } : null,
    moods: Object.fromEntries(moods.docs.flatMap((m) => (m.data().uid ? [[m.data().uid as string, m.data().emoji]] : []))),
  };
}

/** Fetch both look-backs for today and cache them (even when empty, so the day costs one fetch). */
export async function fetchOnThisDay(today: DateKey, roomTz: string): Promise<OnThisDayItem[]> {
  const items = await Promise.all(LOOKBACKS.map((l) => lookBack(l.span, l.label, l.date(today), roomTz)));
  writePref(CACHE_KEY, JSON.stringify({ today, items } satisfies Cache));
  return items;
}
