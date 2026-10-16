export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_KEY = "tincan-theme";

/**
 * Runs in <head> before first paint: resolves the stored preference (or the OS
 * setting) and stamps it on <html data-theme> so there is no flash. Served as
 * public/theme-init.js (a same-origin file, so no inline script and no
 * raw-HTML injection); tests/unit/theme.test.ts keeps the two identical.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=(p==="light"||p==="dark")?p:(d?"dark":"light");var h=document.documentElement;h.dataset.theme=t;h.style.colorScheme=t;}catch{}})();`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function mediaQuery() {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? (mediaQuery().matches ? "dark" : "light") : pref;
}

export function applyTheme(resolved: ResolvedTheme) {
  const html = document.documentElement;
  html.dataset.theme = resolved;
  html.style.colorScheme = resolved;
}

/* ── A tiny external store so React can read the theme via useSyncExternalStore ── */

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Subscribe to preference changes (this tab, other tabs, and OS changes). */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const mq = mediaQuery();
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) listener();
  };
  mq.addEventListener("change", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getResolvedSnapshot(): ResolvedTheme {
  return resolveTheme(readThemePref());
}

/** Persist a preference, paint it, and tell subscribers. */
export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Storage unavailable (private mode) — the preference just won't persist.
  }
  applyTheme(resolveTheme(pref));
  notify();
}
