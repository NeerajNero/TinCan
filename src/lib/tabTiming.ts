/**
 * Tab-switch timing for More → Diagnostics: the tab bar marks the tap, the
 * destination page marks its first content paint (`TabPaint`), and the pair
 * becomes one `TabSwitch`. "Cold" means that path had not painted yet since
 * the app opened (its code and server payload were not in memory). Pure, so
 * `tests/unit/tabTiming.test.ts` can drive it with a fake clock; the app uses
 * the `tabTimer` singleton.
 */
export interface TabSwitch {
  /** Destination pathname (`/`, `/chat`, …). */
  href: string;
  /** Tap → first paint of the destination's content. */
  ms: number;
  cold: boolean;
  /** Wall-clock time of the paint. */
  at: number;
}

/** Switches kept for the diagnostics dump. */
const KEEP = 10;
/** A tap older than this when the paint arrives was not this navigation. */
const STALE_MS = 30_000;

export function createTabTimer(now: () => number = () => performance.now(), wallClock: () => number = () => Date.now()) {
  let pending: { href: string; start: number } | null = null;
  const painted = new Set<string>();
  const switches: TabSwitch[] = [];
  return {
    /** The tab bar was tapped for `href` (ignored when already there). */
    tap(href: string, current: string): void {
      if (href === current) return;
      pending = { href, start: now() };
    },
    /** `pathname`'s content painted; returns the recorded switch when a matching tap was pending. */
    painted(pathname: string): TabSwitch | null {
      const cold = !painted.has(pathname);
      painted.add(pathname);
      if (!pending || pending.href !== pathname) return null;
      const ms = now() - pending.start;
      pending = null;
      if (ms < 0 || ms > STALE_MS) return null;
      const s: TabSwitch = { href: pathname, ms: Math.round(ms), cold, at: wallClock() };
      switches.push(s);
      if (switches.length > KEEP) switches.splice(0, switches.length - KEEP);
      return s;
    },
    /** Oldest first, at most 10. */
    list: (): readonly TabSwitch[] => switches.slice(),
    last: (): TabSwitch | null => switches[switches.length - 1] ?? null,
  };
}

export const tabTimer = createTabTimer();

/** "420 ms (cold: no)" */
export const formatTabSwitch = (s: TabSwitch): string => `${s.ms} ms (cold: ${s.cold ? "yes" : "no"})`;

/** One dump line: "/chat 420 ms cold 11:33:04". */
export const tabSwitchLine = (s: TabSwitch): string => `${s.href} ${s.ms} ms ${s.cold ? "cold" : "warm"} ${new Date(s.at).toISOString()}`;
