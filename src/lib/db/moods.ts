import { getDb } from "@/lib/firebase/client";
import { collection, limit, query, where, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { MoodDoc } from "@/lib/types";

const moodsCol = () => collection(getDb(), "moods") as CollectionReference<MoodDoc>;

/** Both people's moods for one month: a single range on dateKey (≤ 62 docs). */
export function moodsForMonth(yearMonth: string): Query<MoodDoc> {
  return query(moodsCol(), where("dateKey", ">=", `${yearMonth}-01`), where("dateKey", "<=", `${yearMonth}-31`), limit(70));
}
