/**
 * Per-device conveniences in localStorage (a remembered open section, a
 * last-seen time). Storage can be missing or throw (private mode, blocked
 * site data), so every access is guarded and callers get the fallback.
 */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not persisted; fine
  }
}
