/**
 * The shared garden: a scene and 24 original stickers, one per unlock. Each
 * sticker knows the event that earns it, a hint for its silhouette, and
 * where it sits in the scene (percent of width/height).
 */
export type GardenEvent =
  | "whiteboard" | "pixel" | "pictionary" | "watch" | "listen" | "focus" | "cook"
  | "chess-win" | "c4-win" | "pictionary-win" | "trivia" | "quiz" | "word"
  | "capsule" | "envelope" | "photos-10" | "map-pin" | "trip"
  | "streak-7" | "streak-30" | "messages-100" | "voice" | "pet-level-2" | "pings-100";

export interface GardenSticker {
  id: GardenEvent;
  name: string;
  emoji: string;
  hint: string;
  x: number;
  y: number;
  Svg: (props: { size?: number; locked?: boolean }) => React.JSX.Element;
}

const S = (d: string, fill: string, extra?: React.ReactNode) =>
  function Sticker({ size = 48, locked }: { size?: number; locked?: boolean }) {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <path d={d} fill={locked ? "#3b2f3a" : fill} opacity={locked ? 0.25 : 1} />
        {!locked && extra}
      </svg>
    );
  };

const dot = (cx: number, cy: number, r: number, fill: string) => <circle cx={cx} cy={cy} r={r} fill={fill} />;

export const GARDEN_STICKERS: readonly GardenSticker[] = [
  { id: "whiteboard", name: "Paint splat", emoji: "🎨", hint: "Draw together on the whiteboard", x: 14, y: 72, Svg: S("M24 6c6 0 9 5 9 9 0 3 6 4 6 9s-5 7-9 7c-3 0-4 6-9 6s-6-5-6-9c0-3-7-4-7-9s6-6 9-6c2 0 2-7 7-7z", "#ff8fab", dot(24, 24, 4, "#fff")) },
  { id: "pixel", name: "Mushroom", emoji: "🍄", hint: "Paint a pixel together", x: 26, y: 78, Svg: S("M8 24c0-10 7-16 16-16s16 6 16 16H8zm12 0h8v14a4 4 0 0 1-8 0z", "#ff6b6b", <>{dot(16, 16, 3, "#fff")}{dot(28, 13, 3, "#fff")}</>) },
  { id: "pictionary", name: "Easel bird", emoji: "🐦", hint: "Finish a game of Pictionary", x: 40, y: 70, Svg: S("M12 28c0-9 6-16 14-16 6 0 10 4 10 9l6 2-6 2c0 6-5 11-12 11-7 0-12-3-12-8z", "#6fb6ff", dot(29, 21, 2, "#3b2f3a")) },
  { id: "watch", name: "Popcorn", emoji: "🍿", hint: "Watch a video to the end together", x: 56, y: 80, Svg: S("M12 18h24l-3 24H15zM14 12c2-6 18-6 20 0 2-4 8-4 8 2H6c0-6 6-6 8-2z", "#ffd166") },
  { id: "listen", name: "Music note", emoji: "🎵", hint: "Finish a track together", x: 70, y: 74, Svg: S("M20 10l18-4v22a6 5 0 1 1-4-5V13l-10 2v19a6 5 0 1 1-4-5z", "#b48cff") },
  { id: "focus", name: "Tomato", emoji: "🍅", hint: "Complete a focus session", x: 84, y: 82, Svg: S("M24 12c10 0 16 7 16 15s-6 15-16 15S8 35 8 27s6-15 16-15z", "#ff6b6b", <path d="M24 12l-4-6 4 2 4-2z" fill="#5fd3a4" />) },
  { id: "cook", name: "Chef's pot", emoji: "🍲", hint: "Cook a recipe all the way through", x: 8, y: 86, Svg: S("M8 20h32v4h-2v12a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V24H8zM18 10c0-4 4-4 4 0s4 4 4 0", "#e59a6a") },
  { id: "chess-win", name: "Golden pawn", emoji: "♟️", hint: "Win a game of chess", x: 20, y: 56, Svg: S("M24 8a6 6 0 0 1 3 11c4 2 5 8 5 12H16c0-4 1-10 5-12a6 6 0 0 1 3-11zM12 34h24l2 6H10z", "#ffd166") },
  { id: "c4-win", name: "Four discs", emoji: "🔴", hint: "Win at Connect Four", x: 34, y: 58, Svg: S("M10 10h8v8h-8zm10 0h8v8h-8zm10 0h8v8h-8zM10 20h8v8h-8z", "#ff6b6b") },
  { id: "pictionary-win", name: "Ribbon", emoji: "🎀", hint: "Win a Pictionary game", x: 48, y: 60, Svg: S("M24 22l-12-8v16zm0 0l12-8v16zM20 20h8v8h-8z", "#ff8fab") },
  { id: "trivia", name: "Lightbulb", emoji: "💡", hint: "Finish a trivia duel", x: 62, y: 56, Svg: S("M24 6a12 12 0 0 1 7 22v6H17v-6A12 12 0 0 1 24 6zm-6 32h12v4H18z", "#ffd166") },
  { id: "quiz", name: "Mirror", emoji: "🪞", hint: "Take a know-me quiz", x: 76, y: 60, Svg: S("M24 6a14 16 0 0 1 0 32 14 16 0 0 1 0-32zm-4 36h8v4h-8z", "#9ccbff", <ellipse cx="20" cy="18" rx="3" ry="6" fill="#fff" opacity=".7" />) },
  { id: "word", name: "Green tile", emoji: "🟩", hint: "Solve the daily word", x: 90, y: 62, Svg: S("M8 8h32v32H8z", "#5fd3a4", <text x="24" y="31" fontSize="18" fontWeight="700" textAnchor="middle" fill="#fff" fontFamily="sans-serif">W</text>) },
  { id: "capsule", name: "Hourglass", emoji: "⏳", hint: "Open a time capsule", x: 12, y: 40, Svg: S("M12 6h24v6l-8 12 8 12v6H12v-6l8-12-8-12z", "#ffb454") },
  { id: "envelope", name: "Love letter", emoji: "💌", hint: "Open an open-when envelope", x: 30, y: 42, Svg: S("M6 12h36v26H6zm0 0l18 14 18-14", "#fff0e6", <path d="M6 12l18 14 18-14" fill="none" stroke="#f2b088" strokeWidth="2" />) },
  { id: "photos-10", name: "Camera", emoji: "📷", hint: "Add ten photos to memories", x: 48, y: 40, Svg: S("M8 14h8l3-4h10l3 4h8v24H8z", "#3b2f3a", dot(24, 26, 6, "#6fb6ff")) },
  { id: "map-pin", name: "Map pin", emoji: "📍", hint: "Drop your first map pin", x: 66, y: 42, Svg: S("M24 4a12 12 0 0 1 12 12c0 9-12 26-12 26S12 25 12 16A12 12 0 0 1 24 4z", "#b48cff", dot(24, 16, 5, "#fff")) },
  { id: "trip", name: "Suitcase", emoji: "🧳", hint: "Plan your first trip", x: 84, y: 44, Svg: S("M10 16h28v24H10zm9-6h10v6H19z", "#e59a6a", <rect x="22" y="16" width="4" height="24" fill="#c97b4a" />) },
  { id: "streak-7", name: "Little flame", emoji: "🔥", hint: "Keep a 7-day streak", x: 20, y: 24, Svg: S("M24 4c2 10 10 12 10 22a10 10 0 0 1-20 0c0-6 4-8 4-14 3 3 4 6 4 9 2-6 2-11 2-17z", "#ffb454") },
  { id: "streak-30", name: "Big flame", emoji: "🔥", hint: "Keep a 30-day streak", x: 38, y: 22, Svg: S("M24 2c3 12 14 14 14 26a14 14 0 0 1-28 0c0-8 6-10 6-18 4 4 5 8 5 12 3-8 3-14 3-20z", "#ff6b6b", dot(24, 32, 5, "#ffd166")) },
  { id: "messages-100", name: "Speech bubble", emoji: "💬", hint: "Send 100 messages", x: 56, y: 22, Svg: S("M8 10h32v22H20l-8 8v-8H8z", "#6fb6ff") },
  { id: "voice", name: "Microphone", emoji: "🎤", hint: "Send a voice note", x: 72, y: 24, Svg: S("M18 6h12v20H18zM14 20c0 8 20 8 20 0h4c0 9-6 12-11 12v6h-6v-6c-5 0-11-3-11-12z", "#8a7a86") },
  { id: "pet-level-2", name: "Pet bowl", emoji: "🥣", hint: "Raise your pet to level 2", x: 88, y: 26, Svg: S("M6 22h36c0 8-6 14-18 14S6 30 6 22z", "#ff8fab", <ellipse cx="24" cy="22" rx="14" ry="4" fill="#e59a6a" />) },
  { id: "pings-100", name: "Heart cloud", emoji: "💗", hint: "Send 100 pings", x: 50, y: 8, Svg: S("M24 40C12 30 6 24 10 16c3-6 10-6 14-1 4-5 11-5 14 1 4 8-2 14-14 24z", "#ff8fab") },
];

export const STICKER_BY_ID = Object.fromEntries(GARDEN_STICKERS.map((s) => [s.id, s])) as Record<GardenEvent, GardenSticker>;

/** The backdrop: sky, hills, pond and a tree. Stickers are laid over it. */
export function GardenScene() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3ff" />
          <stop offset="1" stopColor="#fff7f1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky)" />
      <circle cx="340" cy="60" r="26" fill="#ffd166" />
      <ellipse cx="90" cy="70" rx="40" ry="14" fill="#fff" opacity=".9" />
      <ellipse cx="120" cy="64" rx="28" ry="12" fill="#fff" opacity=".9" />
      <ellipse cx="80" cy="230" rx="260" ry="90" fill="#9fe0bd" />
      <ellipse cx="330" cy="250" rx="220" ry="80" fill="#7fd3a6" />
      <ellipse cx="300" cy="262" rx="70" ry="20" fill="#9ccbff" />
      <ellipse cx="300" cy="258" rx="58" ry="14" fill="#bfe3ff" opacity=".8" />
      <rect x="86" y="150" width="16" height="70" rx="6" fill="#8b5e3c" />
      <circle cx="94" cy="130" r="40" fill="#5fbf8a" />
      <circle cx="70" cy="150" r="26" fill="#6ccf98" />
      <circle cx="120" cy="150" r="26" fill="#6ccf98" />
      <rect x="0" y="282" width="400" height="18" fill="#6cc392" />
    </svg>
  );
}
