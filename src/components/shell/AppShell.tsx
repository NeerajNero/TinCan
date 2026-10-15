"use client";

import { usePathname } from "next/navigation";

import { TabBar } from "@/components/shell/TabBar";
import { activeTab } from "@/lib/tabs";

/** Centred 480px column with the bottom tab bar; sets the per-tab accent. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tab = activeTab(pathname);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col safe-top"
      style={{ "--accent": `var(${tab.accentVar})` } as React.CSSProperties}
    >
      <main className="flex-1 px-4 pt-4 pb-6">{children}</main>
      <TabBar />
    </div>
  );
}
