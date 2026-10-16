"use client";

import { m } from "framer-motion";
import { Moon, Smartphone, Sun, type LucideIcon } from "lucide-react";

import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";
import type { ThemePref } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePref; label: string; Icon: LucideIcon }> = [
  { value: "system", label: "Auto", Icon: Smartphone },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeSwitch() {
  const { pref, setPref } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(value)}
            className={cn(
              "tap relative flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold",
              active ? "text-text" : "text-muted",
            )}
          >
            {active && (
              <m.span
                layoutId="theme-pill"
                aria-hidden
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <Icon size={16} className="relative" aria-hidden />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
