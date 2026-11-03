/**
 * The collapsible game dock (daily word, Hangman): whether the letter keyboard
 * is hidden, per screen, for the session. Pure, so `pnpm test` covers it.
 *
 * Rules: a round in progress starts expanded, a finished one collapsed; a
 * round ending collapses the dock, a round starting expands it; in between,
 * the person's own tap (hide / show) is remembered until the next transition.
 */

export interface DockCollapsible {
  /** The screen, e.g. "word" or "hangman": the memory key. */
  key: string;
  /** Typing makes sense right now (my guess, the round still open). */
  roundActive: boolean;
  /** Pixels to lift the floating "show keyboard" button above another floating button on the same screen. */
  stackAbove?: number;
}

export interface DockMemory {
  collapsed: boolean;
  roundActive: boolean;
}

/** The state after seeing `roundActive`: a transition sets the default, otherwise the remembered choice stays. */
export function nextDockState(prev: DockMemory | undefined, roundActive: boolean): DockMemory {
  if (!prev || prev.roundActive !== roundActive) return { collapsed: !roundActive, roundActive };
  return { collapsed: prev.collapsed, roundActive };
}

const memory = new Map<string, DockMemory>();

/** Whether the dock for `key` is collapsed now that the round is / isn't active (updates the memory). */
export function dockCollapsed(key: string, roundActive: boolean): boolean {
  const next = nextDockState(memory.get(key), roundActive);
  memory.set(key, next);
  return next.collapsed;
}

/** The person's own hide / show, kept until the round state next changes. */
export function rememberDock(key: string, collapsed: boolean): void {
  memory.set(key, { collapsed, roundActive: memory.get(key)?.roundActive ?? true });
}

/** Tests only. */
export function forgetDocks(): void {
  memory.clear();
}
