"use client";

import { m } from "framer-motion";
import { usePathname } from "next/navigation";

import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { TabBar } from "@/components/shell/TabBar";
import { activeTab } from "@/lib/tabs";

/**
 * Centred 480px column fixed to the viewport (inset: 0): <main> is the only
 * scroller and the tab bar is the column's last row, so it can't move when
 * the keyboard opens or a screen is tall. Full-height screens (chat) own their scrolling. Tab
 * switches cross-fade with a short spring so screens don't snap in.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tab = activeTab(pathname);

  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col safe-top" style={{ "--accent": `var(${tab.accentVar})` } as React.CSSProperties}>
      <OfflineBanner />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6">
        <m.div key={tab.key} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
          {children}
        </m.div>
      </main>
      <TabBar />
    </div>
  );
}
