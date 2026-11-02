"use client";

import { m } from "framer-motion";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { HeaderProvider } from "@/components/shell/HeaderProvider";
import { InboxBell } from "@/components/shell/InboxBell";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { TabBar } from "@/components/shell/TabBar";
import { activeTab } from "@/lib/tabs";

/**
 * Centred 480px column fixed to the viewport (inset: 0): the persistent app
 * header first (it owns the top safe-area inset), then <main> as the only
 * scroller, then the tab bar as the column's last row, so nothing moves when
 * the keyboard opens or a screen is tall. Full-height screens (chat) own their
 * scrolling. Only the main content cross-fades on a tab switch; the header and
 * the tab bar are mounted once and never animate or remount.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tab = activeTab(pathname);

  return (
    <HeaderProvider>
      <div className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col" style={{ "--accent": `var(${tab.accentVar})` } as React.CSSProperties}>
        <AppHeader bell={<InboxBell />} />
        <OfflineBanner />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6">
          <m.div key={tab.key} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
            {children}
          </m.div>
        </main>
        <TabBar />
      </div>
    </HeaderProvider>
  );
}
