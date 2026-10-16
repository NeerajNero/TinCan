/**
 * The one place a promise is allowed to fail silently: fire-and-forget writes
 * (reactions, presence pages, counters) whose failure the UI already tolerates.
 * Use `.catch(swallow)` so intent is greppable; anything the user must know
 * about goes through a toast instead.
 */
export const swallow = (): undefined => undefined;

/** A readable message for a toast, with a friendly fallback. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message && !/^[a-z_]+$/.test(err.message)) return err.message;
  return fallback;
}
