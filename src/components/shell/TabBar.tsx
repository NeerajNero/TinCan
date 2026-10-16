"use client";

import { m } from "framer-motion";
import { CalendarHeart, Gamepad2, House, Images, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { Spinner } from "@/components/ui/Spinner";
import { useChatMeta } from "@/hooks/useChatMeta";
import { cn } from "@/lib/cn";
import { activeTab, TABS, type TabKey } from "@/lib/tabs";

const ICONS: Record<TabKey, LucideIcon> = {
  home: House,
  chat: MessageCircle,
  play: Gamepad2,
  memories: Images,
  plan: CalendarHeart,
  more: Sparkles,
};

export function TabBar() {
  const pathname = usePathname();
  const current = activeTab(pathname);
  const { unreadCount } = useChatMeta();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <div className="card grid grid-cols-6 gap-0.5 rounded-[28px] bg-surface/90 p-1.5 backdrop-blur-md">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.key];
          const active = tab.key === current.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-label={tab.key === "chat" && unreadCount > 0 ? `${tab.label}, ${unreadCount} unread` : tab.label}
              aria-current={active ? "page" : undefined}
              style={{ "--accent": `var(${tab.accentVar})` } as React.CSSProperties}
              className={cn(
                "tap relative flex flex-col items-center justify-center gap-0.5 rounded-[20px] py-1.5",
                "text-muted transition-colors",
                active && "text-text",
              )}
            >
              {active && (
                <m.span
                  layoutId="tab-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-[20px] bg-accent-soft"
                  transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.8 }}
                />
              )}
              {tab.key === "chat" && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread`}
                  className="absolute top-0.5 right-[calc(50%-20px)] z-10 min-w-5 rounded-full bg-[var(--accent-chat)] px-1.5 text-center text-[10px] font-bold leading-5 text-white shadow-sm"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              <TabIcon Icon={Icon} active={active} />
              <span className="relative text-[10px] font-bold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The icon, or a spinner while this link's navigation is pending. */
function TabIcon({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <m.span className="relative grid size-6 place-items-center" animate={active ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}>
      {pending ? (
        <Spinner size={18} className="text-[var(--accent)]" />
      ) : (
        <Icon size={22} strokeWidth={active ? 2.4 : 2} style={active ? { color: "var(--accent)" } : undefined} />
      )}
    </m.span>
  );
}
