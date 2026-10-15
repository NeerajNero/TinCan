/**
 * Sixteen original stickers, drawn as inline SVG. Simple shapes, warm colours,
 * no borrowed characters. Each renders at 140 px in chat, without a bubble.
 */
import type { SVGProps } from "react";

export interface Sticker {
  id: string;
  label: string;
  Svg: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
}

const base = (props: SVGProps<SVGSVGElement>) => ({ viewBox: "0 0 100 100", width: 140, height: 140, ...props });
const face = (x: number, y: number, gap = 9) => (
  <>
    <circle cx={x - gap} cy={y} r="2.6" fill="#3b2f3a" />
    <circle cx={x + gap} cy={y} r="2.6" fill="#3b2f3a" />
    <path d={`M${x - 5} ${y + 7} q5 5 10 0`} stroke="#3b2f3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <circle cx={x - gap - 6} cy={y + 6} r="3" fill="#ff8fab" opacity=".6" />
    <circle cx={x + gap + 6} cy={y + 6} r="3" fill="#ff8fab" opacity=".6" />
  </>
);

export const STICKERS: readonly Sticker[] = [
  {
    id: "tincan-love",
    label: "Tin can with hearts",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Tin can with hearts">
        <rect x="30" y="28" width="40" height="52" rx="8" fill="#c7d2e8" />
        <ellipse cx="50" cy="28" rx="20" ry="7" fill="#e3e9f5" />
        <ellipse cx="50" cy="80" rx="20" ry="6" fill="#aab6d0" />
        <path d="M40 46 h20" stroke="#8c9bbd" strokeWidth="2" strokeLinecap="round" />
        {face(50, 58, 8)}
        <path d="M20 20 c-5-7 5-11 7-4 c2-7 12-3 7 4 l-7 7z" fill="#ff8fab" />
        <path d="M74 14 c-4-5 4-9 6-3 c2-6 10-2 6 3 l-6 6z" fill="#ff8fab" />
      </svg>
    ),
  },
  {
    id: "happy-cloud",
    label: "Happy cloud",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Happy cloud">
        <circle cx="38" cy="55" r="18" fill="#eef3ff" />
        <circle cx="58" cy="45" r="20" fill="#eef3ff" />
        <circle cx="72" cy="58" r="15" fill="#eef3ff" />
        <rect x="24" y="55" width="62" height="18" rx="9" fill="#eef3ff" />
        {face(55, 56)}
      </svg>
    ),
  },
  {
    id: "sunny",
    label: "Cheerful sun",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Cheerful sun">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="50" y1="50" x2={50 + 40 * Math.cos((i * Math.PI) / 4)} y2={50 + 40 * Math.sin((i * Math.PI) / 4)} stroke="#ffb454" strokeWidth="6" strokeLinecap="round" />
        ))}
        <circle cx="50" cy="50" r="24" fill="#ffd166" />
        {face(50, 48)}
      </svg>
    ),
  },
  {
    id: "sleepy-moon",
    label: "Sleepy moon",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Sleepy moon">
        <path d="M62 15 a35 35 0 1 0 0 70 a28 28 0 1 1 0-70z" fill="#ffe08a" />
        <path d="M46 50 q4 3 8 0" stroke="#3b2f3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M40 42 q3-3 6 0 M50 42 q3-3 6 0" stroke="#3b2f3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <text x="72" y="30" fontSize="14" fill="#b48cff" fontFamily="sans-serif" fontWeight="700">z</text>
        <text x="80" y="20" fontSize="10" fill="#b48cff" fontFamily="sans-serif" fontWeight="700">z</text>
      </svg>
    ),
  },
  {
    id: "tea",
    label: "Cup of tea",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Cup of tea">
        <path d="M28 40 h44 v22 a22 22 0 0 1 -44 0z" fill="#ff8fab" />
        <path d="M72 46 h8 a8 8 0 0 1 0 16 h-8" fill="none" stroke="#ff8fab" strokeWidth="5" />
        <ellipse cx="50" cy="40" rx="22" ry="5" fill="#ffd1dc" />
        <path d="M40 30 q3-6 0-12 M50 28 q3-6 0-12 M60 30 q3-6 0-12" stroke="#c7d2e8" strokeWidth="3" fill="none" strokeLinecap="round" />
        {face(50, 54, 8)}
        <rect x="26" y="78" width="48" height="5" rx="2.5" fill="#e3e9f5" />
      </svg>
    ),
  },
  {
    id: "cactus",
    label: "Cactus",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Cactus">
        <path d="M34 82 h32 l-4 10 h-24z" fill="#e59a6a" />
        <rect x="30" y="74" width="40" height="9" rx="4" fill="#f2b088" />
        <rect x="40" y="22" width="20" height="54" rx="10" fill="#5fd3a4" />
        <path d="M40 48 h-8 v-14 a5 5 0 0 1 10 0 v14" fill="#5fd3a4" />
        <path d="M60 42 h8 v-10 a5 5 0 0 0 -10 0 v10" fill="#5fd3a4" />
        <circle cx="50" cy="24" r="5" fill="#ff8fab" />
        {face(50, 48, 5)}
      </svg>
    ),
  },
  {
    id: "star",
    label: "Twinkle star",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Twinkle star">
        <path d="M50 10 l11 26 l28 2 l-21 18 l7 27 l-25 -15 l-25 15 l7 -27 l-21 -18 l28 -2z" fill="#ffd166" stroke="#ffb454" strokeWidth="3" strokeLinejoin="round" />
        {face(50, 50, 7)}
      </svg>
    ),
  },
  {
    id: "rainbow",
    label: "Rainbow",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Rainbow">
        {["#ff6b6b", "#ffb454", "#ffd166", "#5fd3a4", "#6fb6ff", "#b48cff"].map((c, i) => (
          <path key={c} d={`M${12 + i * 6} 78 a${38 - i * 6} ${38 - i * 6} 0 0 1 ${76 - i * 12} 0`} fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
        ))}
        <circle cx="16" cy="78" r="9" fill="#eef3ff" />
        <circle cx="84" cy="78" r="9" fill="#eef3ff" />
      </svg>
    ),
  },
  {
    id: "paper-plane",
    label: "Paper plane",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Paper plane">
        <path d="M12 50 l76 -30 l-22 66 l-16 -24z" fill="#6fb6ff" />
        <path d="M50 62 l38 -42 l-54 36z" fill="#9ccbff" />
        <path d="M14 70 q10 -8 20 -2 M20 82 q8 -6 16 -2" stroke="#c7d2e8" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "heart-balloon",
    label: "Heart balloon",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Heart balloon">
        <path d="M50 70 c-25 -18 -30 -32 -18 -42 c8 -6 16 -2 18 4 c2 -6 10 -10 18 -4 c12 10 7 24 -18 42z" fill="#ff8fab" />
        <path d="M44 32 q-3 -6 3 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
        <path d="M50 70 q-6 10 2 14 q-8 4 -2 10" stroke="#8a7a86" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "cookie",
    label: "Cookie",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Cookie">
        <path d="M50 14 a36 36 0 1 0 36 36 a10 10 0 0 1 -14 -10 a10 10 0 0 1 -12 -12 a10 10 0 0 1 -10 -14z" fill="#e8b27a" />
        {[[34, 40], [48, 58], [64, 66], [38, 68], [58, 34]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#7a5236" />
        ))}
        {face(50, 48, 6)}
      </svg>
    ),
  },
  {
    id: "ghost",
    label: "Friendly ghost",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Friendly ghost">
        <path d="M26 50 a24 24 0 0 1 48 0 v34 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6z" fill="#f4f6ff" stroke="#c7d2e8" strokeWidth="2" />
        {face(50, 48, 8)}
      </svg>
    ),
  },
  {
    id: "ice-cream",
    label: "Ice cream",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Ice cream">
        <path d="M34 52 h32 l-16 40z" fill="#f2b088" />
        <path d="M38 60 l24 0 M41 68 l18 0 M44 76 l12 0" stroke="#e59a6a" strokeWidth="2" />
        <circle cx="50" cy="40" r="20" fill="#ff8fab" />
        <circle cx="38" cy="30" r="12" fill="#ffd1dc" />
        <circle cx="62" cy="30" r="12" fill="#ffd1dc" />
        <circle cx="52" cy="18" r="4" fill="#ff6b6b" />
        {face(50, 42, 7)}
      </svg>
    ),
  },
  {
    id: "planet",
    label: "Little planet",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Little planet">
        <circle cx="50" cy="50" r="24" fill="#b48cff" />
        <circle cx="40" cy="42" r="6" fill="#c9adff" />
        <circle cx="58" cy="58" r="4" fill="#c9adff" />
        <ellipse cx="50" cy="52" rx="42" ry="10" fill="none" stroke="#ffd166" strokeWidth="5" transform="rotate(-15 50 52)" />
        {face(50, 50, 7)}
      </svg>
    ),
  },
  {
    id: "love-letter",
    label: "Love letter",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Love letter">
        <rect x="14" y="30" width="72" height="48" rx="8" fill="#fff0e6" stroke="#f2b088" strokeWidth="3" />
        <path d="M14 36 l36 26 l36 -26" fill="none" stroke="#f2b088" strokeWidth="3" strokeLinejoin="round" />
        <path d="M50 66 c-9 -6 -11 -12 -6 -16 c3 -2 6 0 6 2 c0 -2 3 -4 6 -2 c5 4 3 10 -6 16z" fill="#ff8fab" />
      </svg>
    ),
  },
  {
    id: "frog",
    label: "Frog face",
    Svg: (p) => (
      <svg {...base(p)} role="img" aria-label="Frog face">
        <circle cx="34" cy="34" r="12" fill="#5fd3a4" />
        <circle cx="66" cy="34" r="12" fill="#5fd3a4" />
        <ellipse cx="50" cy="56" rx="34" ry="26" fill="#5fd3a4" />
        <circle cx="34" cy="34" r="5" fill="#fff" />
        <circle cx="66" cy="34" r="5" fill="#fff" />
        <circle cx="35" cy="35" r="2.5" fill="#3b2f3a" />
        <circle cx="67" cy="35" r="2.5" fill="#3b2f3a" />
        <path d="M36 60 q14 12 28 0" stroke="#3b2f3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="26" cy="60" r="4" fill="#ff8fab" opacity=".6" />
        <circle cx="74" cy="60" r="4" fill="#ff8fab" opacity=".6" />
      </svg>
    ),
  },
];

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
