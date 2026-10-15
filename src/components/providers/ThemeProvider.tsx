"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  applyTheme,
  getResolvedSnapshot,
  readThemePref,
  setThemePref,
  subscribeTheme,
  type ResolvedTheme,
  type ThemePref,
} from "@/lib/theme";

interface ThemeContextValue {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const serverPref = (): ThemePref => "system";
const serverResolved = (): ResolvedTheme => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline <head> script already painted the right theme before hydration;
  // these just keep React's view of it in sync with localStorage + the OS.
  const pref = useSyncExternalStore(subscribeTheme, readThemePref, serverPref);
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedSnapshot, serverResolved);

  // Keep <html data-theme> in step when the OS or another tab changes it.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const value = useMemo(() => ({ pref, resolved, setPref: setThemePref }), [pref, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
