/**
 * Everything the Play tab can open, in one list: the seven board games, the
 * quick-play screens and the together activities. Ids double as how-to keys
 * and as the ids stored in `pair/main.play` (recent / favourites), so lookups
 * from storage go through `playInfo()`, which skips ids this build doesn't know.
 */
import { DECK_KINDS, DECK_META, type DeckKind } from "@/lib/deckMeta";
import { BOARD_GAMES, GAME_CATALOG } from "@/lib/games/catalog";
import type { GameType } from "@/lib/games/types";

export type PlaySection = "board" | "quick" | "together";
type QuickId = "word" | "trivia" | "quiz" | "twenty" | DeckKind;
type TogetherId = "whiteboard" | "pixel" | "pictionary" | "watch" | "listen" | "radio" | "timer" | "cook";
export type PlayId = GameType | QuickId | TogetherId;

export interface PlayEntry {
  id: PlayId;
  name: string;
  /** Fits a compact tile: one or two short words. */
  short: string;
  emoji: string;
  /** Board games have no page of their own: the lobby starts or resumes a game. */
  href: string;
  section: PlaySection;
}

const SHORT_BOARD: Record<GameType, string> = { tictactoe: "Tic-tac-toe", connectfour: "Connect 4", chess: "Chess", checkers: "Checkers", dots: "Dots", hangman: "Hangman", battleship: "Battleship" };

const DECK_SHORT: Record<DeckKind, string> = { wyr: "WYR", nhie: "NHIE", tod: "Truth/Dare", convo: "Convo" };

const QUICK: PlayEntry[] = [
  { id: "word", name: "Daily word", short: "Daily word", emoji: "🟩", href: "/play/word", section: "quick" },
  { id: "trivia", name: "Trivia duel", short: "Trivia", emoji: "🧠", href: "/play/trivia", section: "quick" },
  { id: "quiz", name: "Know-me quiz", short: "Know-me", emoji: "🪞", href: "/play/quiz", section: "quick" },
  { id: "twenty", name: "20 Questions", short: "20 Qs", emoji: "🔍", href: "/play/twenty", section: "quick" },
  ...DECK_KINDS.map((k): PlayEntry => ({ id: k, name: DECK_META[k].name, short: DECK_SHORT[k], emoji: DECK_META[k].emoji, href: `/play/deck/${k}`, section: "quick" })),
];

const TOGETHER: PlayEntry[] = [
  { id: "whiteboard", name: "Whiteboard", short: "Whiteboard", emoji: "🖍️", href: "/play/whiteboard", section: "together" },
  { id: "pixel", name: "Pixel art", short: "Pixel art", emoji: "🟪", href: "/play/pixel", section: "together" },
  { id: "pictionary", name: "Pictionary", short: "Pictionary", emoji: "🎨", href: "/play/pictionary", section: "together" },
  { id: "watch", name: "Watch together", short: "Watch", emoji: "📺", href: "/play/watch", section: "together" },
  { id: "listen", name: "Listen together", short: "Listen", emoji: "🎧", href: "/play/listen", section: "together" },
  { id: "radio", name: "Radio", short: "Radio", emoji: "📻", href: "/play/radio", section: "together" },
  { id: "timer", name: "Focus timer", short: "Focus", emoji: "⏱️", href: "/play/timer", section: "together" },
  { id: "cook", name: "Cook-along", short: "Cook", emoji: "🍳", href: "/play/cook", section: "together" },
];

export const PLAY_ENTRIES: readonly PlayEntry[] = [
  ...BOARD_GAMES.map((t): PlayEntry => ({ id: t, name: GAME_CATALOG[t].name, short: SHORT_BOARD[t], emoji: GAME_CATALOG[t].emoji, href: "/play", section: "board" })),
  ...QUICK,
  ...TOGETHER,
];

export const PLAY_SECTIONS: readonly { id: PlaySection; title: string }[] = [
  { id: "board", title: "Board games" },
  { id: "quick", title: "Quick play" },
  { id: "together", title: "Together" },
];

const BY_ID = new Map<string, PlayEntry>(PLAY_ENTRIES.map((e) => [e.id, e]));

/** Safe lookup for ids read from storage: undefined for anything unknown. */
export const playInfo = (id: string | null | undefined): PlayEntry | undefined => (id ? BY_ID.get(id) : undefined);

const isPlayId = (id: string): id is PlayId => BY_ID.has(id);

export const entriesIn = (section: PlaySection): PlayEntry[] => PLAY_ENTRIES.filter((e) => e.section === section);

/** Segments under /play that are screens of their own (anything else is a board-game id). */
const STATIC_SEGMENTS = new Set<string>([...QUICK.map((e) => e.id), ...TOGETHER.map((e) => e.id)]);

function playSegments(pathname: string): string[] {
  const clean = pathname.split(/[?#]/)[0] ?? "";
  if (clean !== "/play" && !clean.startsWith("/play/")) return [];
  return clean.slice("/play/".length).split("/").filter(Boolean);
}

/** The Play entry a route belongs to (`/play/trivia/abc` → trivia, `/play/deck/wyr` → wyr), or null. */
export function playIdForPath(pathname: string): PlayId | null {
  const [first, second] = playSegments(pathname);
  if (!first) return null;
  if (first === "deck") return second && isPlayId(second) && BY_ID.get(second)?.section === "quick" ? (second as PlayId) : null;
  return STATIC_SEGMENTS.has(first) && isPlayId(first) ? first : null;
}

/** The game id of a board-game route (`/play/-Nabc`), or null for every other route. */
export function gameIdForPath(pathname: string): string | null {
  const segs = playSegments(pathname);
  const first = segs[0];
  return segs.length === 1 && first && !STATIC_SEGMENTS.has(first) ? first : null;
}

/** "Surprise us": a uniformly random entry. `rand` is injectable for tests. */
export function pickSurprise(entries: readonly PlayEntry[] = PLAY_ENTRIES, rand: () => number = Math.random): PlayEntry {
  const i = Math.min(entries.length - 1, Math.floor(rand() * entries.length));
  const picked = entries[i];
  if (!picked) throw new Error("No Play entries to pick from");
  return picked;
}
