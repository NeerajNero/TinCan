"use client";

import { useSyncExternalStore } from "react";

import type { HowToKey } from "@/content/howto";

/** Which how-to sheets this device has already shown (localStorage, per device). */
const KEY = "tincan-howto-seen";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
const seenSet = (raw: string) => {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set<string>();
  }
};

export function markHowToSeen(key: HowToKey): void {
  const s = seenSet(read());
  if (s.has(key)) return;
  s.add(key);
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // storage blocked: the sheet will just show again next time
  }
  emit();
}

/** More → "Show all tips again". */
export function resetHowToSeen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True once this screen's tips were shown here; `null` during SSR (don't auto-open then). */
export function useHowToSeen(key: HowToKey): boolean | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return raw === null ? null : seenSet(raw).has(key);
}
