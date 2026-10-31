/**
 * Named vibration patterns, so every screen says the same thing with the
 * same buzz: `tap` under a key or option press, `success` for a solved word
 * or a right answer, `error` for a wrong guess or answer. No-op where
 * `navigator.vibrate` is missing or throws (desktop, iOS, blocked).
 */
export const HAPTIC = { tap: 10, success: [20, 40, 20], error: [40, 30, 40] } as const;
export type HapticKind = keyof typeof HAPTIC;

export function haptic(kind: HapticKind): void {
  try {
    navigator.vibrate?.(HAPTIC[kind] as number | number[]);
  } catch {
    // no haptics
  }
}
