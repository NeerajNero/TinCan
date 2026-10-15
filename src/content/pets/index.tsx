/**
 * Three original pets, drawn parametrically: a jelly blob, a sprout with a
 * leaf, and a puffy cloud-cat. Four moods each, and three level looks
 * (plain → a bow → bigger with a tiny crown).
 */
import type { PetMood, PetSpecies } from "@/lib/types";

export const PET_SPECIES: Record<PetSpecies, { name: string; blurb: string; color: string; accent: string }> = {
  blob: { name: "Blob", blurb: "A wobbly jelly who loves snacks", color: "#ff8fab", accent: "#ff6b8f" },
  sprout: { name: "Sprout", blurb: "A tiny seedling with big feelings", color: "#5fd3a4", accent: "#3fb889" },
  puff: { name: "Puff", blurb: "A cloud-cat that purrs in the rain", color: "#9ccbff", accent: "#6fb6ff" },
};

interface Props {
  species: PetSpecies;
  mood: PetMood;
  level: number;
  size?: number;
  className?: string;
}

function Face({ mood, x, y, gap = 9 }: { mood: PetMood; x: number; y: number; gap?: number }) {
  if (mood === "sleeping")
    return (
      <>
        <path d={`M${x - gap - 3} ${y} q3 3 6 0 M${x + gap - 3} ${y} q3 3 6 0`} stroke="#3b2f3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d={`M${x - 4} ${y + 8} q4 2 8 0`} stroke="#3b2f3a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <text x={x + 22} y={y - 14} fontSize="11" fontWeight="700" fill="#b48cff" fontFamily="sans-serif">z</text>
      </>
    );
  const mouth =
    mood === "happy" ? `M${x - 6} ${y + 7} q6 6 12 0` : mood === "hungry" ? `M${x - 5} ${y + 9} a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0` : `M${x - 6} ${y + 10} q6 -5 12 0`;
  return (
    <>
      <circle cx={x - gap} cy={y} r="2.8" fill="#3b2f3a" />
      <circle cx={x + gap} cy={y} r="2.8" fill="#3b2f3a" />
      {mood === "sad" && <path d={`M${x + gap + 1} ${y + 4} q1 5 -1 8`} stroke="#6fb6ff" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <path d={mouth} stroke="#3b2f3a" strokeWidth="2.2" fill={mood === "hungry" ? "#3b2f3a" : "none"} strokeLinecap="round" />
      <circle cx={x - gap - 7} cy={y + 6} r="3" fill="#ff8fab" opacity=".55" />
      <circle cx={x + gap + 7} cy={y + 6} r="3" fill="#ff8fab" opacity=".55" />
    </>
  );
}

function Bow({ x, y, color }: { x: number; y: number; color: string }) {
  return <path d={`M${x} ${y} l-9 -6 v12 z M${x} ${y} l9 -6 v12 z`} fill={color} stroke="#3b2f3a" strokeWidth="1" />;
}
function Crown({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 11} ${y + 6} l0 -12 l6 6 l5 -9 l5 9 l6 -6 l0 12 z`} fill="#ffd166" stroke="#e0a800" strokeWidth="1.2" strokeLinejoin="round" />;
}

export function PetSprite({ species, mood, level, size = 120, className }: Props) {
  const s = PET_SPECIES[species];
  const big = level >= 3;
  const scale = big ? 1.12 : 1;
  const droop = mood === "sad" || mood === "hungry" ? 3 : 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`${s.name}, ${mood}`}>
      <g transform={`translate(60 62) scale(${scale}) translate(-60 -62)`}>
        {species === "blob" && (
          <>
            <path d={`M30 ${74 + droop} C30 42 44 30 60 30 C76 30 90 42 90 ${74 + droop} C90 92 76 98 60 98 C44 98 30 92 30 ${74 + droop}Z`} fill={s.color} />
            <ellipse cx="48" cy="48" rx="7" ry="4" fill="#fff" opacity=".6" />
            <Face mood={mood} x={60} y={62} />
            {level === 2 && <Bow x={82} y={44} color="#ffd166" />}
            {big && <Crown x={60} y={26} />}
          </>
        )}
        {species === "sprout" && (
          <>
            <path d="M60 36 C54 22 44 18 36 22 C40 30 50 36 60 36Z" fill={s.accent} />
            <path d="M60 38 C66 24 76 20 84 24 C80 32 70 38 60 38Z" fill={s.color} />
            <line x1="60" y1="38" x2="60" y2="50" stroke={s.accent} strokeWidth="3" strokeLinecap="round" />
            <rect x="34" y="48" width="52" height="48" rx="22" fill={s.color} />
            <Face mood={mood} x={60} y={68} gap={8} />
            <path d="M36 96 h48 l-4 10 h-40z" fill="#e59a6a" />
            {level === 2 && <Bow x={60} y={46} color="#ff8fab" />}
            {big && <Crown x={60} y={30} />}
          </>
        )}
        {species === "puff" && (
          <>
            <circle cx="42" cy="66" r="18" fill={s.color} />
            <circle cx="60" cy="56" r="22" fill={s.color} />
            <circle cx="78" cy="66" r="18" fill={s.color} />
            <rect x="28" y="66" width="64" height="22" rx="11" fill={s.color} />
            <path d="M44 42 l-4 -14 l12 8z M76 42 l4 -14 l-12 8z" fill={s.accent} />
            <Face mood={mood} x={60} y={64} />
            <path d="M52 76 q2 3 4 0 M64 76 q2 3 4 0" stroke="#3b2f3a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {level === 2 && <Bow x={82} y={48} color="#b48cff" />}
            {big && <Crown x={60} y={30} />}
          </>
        )}
      </g>
    </svg>
  );
}
