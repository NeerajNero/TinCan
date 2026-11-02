"use client";

import { ChevronLeft } from "lucide-react";

import { useHeaderBack, useHeaderContent } from "@/components/shell/HeaderProvider";
import { HowToButton } from "@/components/ui/HowTo";

/** The bar's height without the safe-area inset. */
const APP_HEADER_HEIGHT = 56;

/**
 * The one header (chore: persistent app header), mounted once by the app
 * shell above the scrolling main area and never remounted or animated. Fixed
 * height (56 px + the top safe-area inset), the theme background, three
 * slots: left (back arrow or the page's emoji / leading node), centre (title
 * + subtitle, truncated), right (the page's actions, the ? help button, and
 * the bell in a fixed 44 px box so a badge change never shifts the icons).
 * Pages declare their content with `useHeader`; the provider keeps the last
 * content through navigation.
 */
export function AppHeader({ bell }: { bell: React.ReactNode }) {
  const content = useHeaderContent();
  const back = useHeaderBack();
  const hasBack = content?.back !== undefined;

  return (
    <header
      data-app-header
      className="relative z-40 flex shrink-0 items-center gap-2 bg-bg px-2"
      style={{ height: `calc(${APP_HEADER_HEIGHT}px + env(safe-area-inset-top))`, paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-w-0 shrink-0 items-center" data-header-left>
        {hasBack ? (
          <button type="button" onClick={() => back(content?.back)} aria-label="Back" className="tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            <ChevronLeft size={24} />
          </button>
        ) : null}
        {content?.leading ?? (content?.emoji ? (
          <span className="grid size-11 shrink-0 place-items-center text-[26px] leading-none" aria-hidden>
            {content.emoji}
          </span>
        ) : null)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center" data-header-centre>
        <h1 className="truncate font-heading text-xl leading-tight font-semibold">{content?.title ?? " "}</h1>
        {content?.subtitle && <div className="min-w-0 truncate text-xs leading-tight text-muted">{content.subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5" data-header-right>
        {content?.actions}
        {content?.help && <HowToButton key={content.help} topic={content.help} />}
        <span className="grid w-11 shrink-0 place-items-center" data-header-bell-slot>
          {bell}
        </span>
      </div>
    </header>
  );
}
