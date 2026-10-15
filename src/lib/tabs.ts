export type TabKey = "home" | "chat" | "play" | "memories" | "plan" | "more";

export interface Tab {
  key: TabKey;
  href: string;
  label: string;
  emoji: string;
  /** CSS custom property holding this tab's accent colour. */
  accentVar: string;
}

export const TABS: readonly Tab[] = [
  { key: "home", href: "/", label: "Home", emoji: "🏠", accentVar: "--accent-home" },
  { key: "chat", href: "/chat", label: "Chat", emoji: "💬", accentVar: "--accent-chat" },
  { key: "play", href: "/play", label: "Play", emoji: "🎲", accentVar: "--accent-play" },
  { key: "memories", href: "/memories", label: "Memories", emoji: "📸", accentVar: "--accent-memories" },
  { key: "plan", href: "/plan", label: "Plan", emoji: "🗓️", accentVar: "--accent-plan" },
  { key: "more", href: "/more", label: "More", emoji: "✨", accentVar: "--accent-more" },
] as const;

export function activeTab(pathname: string): Tab {
  if (pathname === "/") return TABS[0];
  return TABS.find((t) => t.href !== "/" && pathname.startsWith(t.href)) ?? TABS[0];
}
