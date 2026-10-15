import { doc, type DocumentReference } from "@/lib/firebase/fs";

import { getDb } from "@/lib/firebase/client";
import type { PairDoc, UserDoc } from "@/lib/types";

/** Typed references for the documents phase 2 touches. */
export const userRef = (uid: string) => doc(getDb(), "users", uid) as DocumentReference<UserDoc>;
export const pairRef = () => doc(getDb(), "pair", "main") as DocumentReference<PairDoc>;
