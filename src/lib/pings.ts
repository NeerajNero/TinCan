/** Ping cooldown: one ping per five seconds, so a double tap can't spam the friend. */
export const PING_COOLDOWN_MS = 5000;

/** Wall-clock ms, kept out of components so the React Compiler sees no impure call in render scope. */
export const pingNow = (): number => Date.now();

/** True when enough time has passed since the last ping (or there was none). */
export function pingAllowed(lastSentAt: number | null, now: number = Date.now()): boolean {
  return lastSentAt === null || now - lastSentAt >= PING_COOLDOWN_MS;
}

/** Ms until the next ping is allowed; 0 when it already is. */
export function pingCooldownLeft(lastSentAt: number | null, now: number): number {
  return lastSentAt === null ? 0 : Math.max(0, PING_COOLDOWN_MS - (now - lastSentAt));
}
