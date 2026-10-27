/**
 * Three original pets, drawn parametrically: a jelly blob, a sprout with a
 * leaf, and a puffy cloud-cat. Four moods each, and three level looks
 * (plain → a bow → bigger with a tiny crown).
 *
 * Every sprite is built from the same named parts (breath › body, eyes ›
 * eyeL/eyeR, mouth, cheeks, accessory). Pass `parts` (animation controls
 * keyed by part) and each one animates on its own; without it the sprite is
 * static (adopt picker).
 */
import { m, type useAnimationControls } from "framer-motion";

import type { PetMood, PetSpecies } from "@/lib/types";

export const PET_SPECIES: Record<PetSpecies, { name: string; blurb: string; color: string; accent: string }> = {
  blob: { name: "Blob", blurb: "A wobbly jelly who loves snacks", color: "#ff8fab", accent: "#ff6b8f" },
  sprout: { name: "Sprout", blurb: "A tiny seedling with big feelings", color: "#5fd3a4", accent: "#3fb889" },
  puff: { name: "Puff", blurb: "A cloud-cat that purrs in the rain", color: "#9ccbff", accent: "#6fb6ff" },
};

export const PET_PARTS = ["breath", "body", "eyes", "eyeL", "eyeR", "mouth", "cheeks", "accessory"] as const;
export type PetPart = (typeof PET_PARTS)[number];
export type PartControls = Record<PetPart, ReturnType<typeof useAnimationControls>>;

interface Props {
  species: PetSpecies;
  mood: PetMood;
  level: number;
  size?: number;
  className?: string;
  parts?: PartControls;
  /** Milestone mode: the day's accessory replaces whatever the level gives. */
  accessory?: PetAccessory | null;
}
export type PetAccessory = "party" | "diya" | "colours" | "santa";

const INK = "#3b2f3a";
// SVG parts transform around their own box; breathing pivots on the feet
// (framer's originX/originY, which it turns into transform-origin itself).
const CENTER = { transformBox: "fill-box", originX: 0.5, originY: 0.5 } as const;
const FEET = { transformBox: "fill-box", originX: 0.5, originY: 1 } as const;

/** One named, separately animatable part. */
function Part({ name, parts, origin = CENTER, children }: { name: PetPart; parts?: PartControls; origin?: typeof CENTER | typeof FEET; children: React.ReactNode }) {
  return (
    <m.g data-part={name} animate={parts?.[name]} style={origin}>
      {children}
    </m.g>
  );
}

function Face({ mood, x, y, gap = 9, parts }: { mood: PetMood; x: number; y: number; gap?: number; parts?: PartControls }) {
  const asleep = mood === "sleeping";
  const eye = (cx: number) => (asleep ? <path d={`M${cx - 3} ${y} q3 3 6 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" /> : <circle cx={cx} cy={y} r="2.8" fill={INK} />);
  const mouth = asleep
    ? `M${x - 4} ${y + 8} q4 2 8 0`
    : mood === "happy"
      ? `M${x - 6} ${y + 7} q6 6 12 0`
      : mood === "hungry"
        ? `M${x - 5} ${y + 9} a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0`
        : `M${x - 6} ${y + 10} q6 -5 12 0`;
  return (
    <>
      <Part name="eyes" parts={parts}>
        <Part name="eyeL" parts={parts}>
          {eye(x - gap)}
        </Part>
        <Part name="eyeR" parts={parts}>
          {eye(x + gap)}
        </Part>
      </Part>
      {mood === "sad" && <path d={`M${x + gap + 1} ${y + 4} q1 5 -1 8`} stroke="#6fb6ff" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <Part name="mouth" parts={parts}>
        <path d={mouth} stroke={INK} strokeWidth={asleep ? 2 : 2.2} fill={mood === "hungry" ? INK : "none"} strokeLinecap="round" />
      </Part>
      <Part name="cheeks" parts={parts}>
        <circle cx={x - gap - 7} cy={y + 6} r="3" fill="#ff8fab" opacity=".55" />
        <circle cx={x + gap + 7} cy={y + 6} r="3" fill="#ff8fab" opacity=".55" />
      </Part>
    </>
  );
}

function Bow({ x, y, color }: { x: number; y: number; color: string }) {
  return <path d={`M${x} ${y} l-9 -6 v12 z M${x} ${y} l9 -6 v12 z`} fill={color} stroke={INK} strokeWidth="1" />;
}
function Crown({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 11} ${y + 6} l0 -12 l6 6 l5 -9 l5 9 l6 -6 l0 12 z`} fill="#ffd166" stroke="#e0a800" strokeWidth="1.2" strokeLinejoin="round" />;
}

/** The milestone-day party hat: a striped cone with a pompom, sitting where the crown goes. */
function PartyHat({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 11} ${y + 8} L${x} ${y - 16} L${x + 11} ${y + 8} z`} fill="#ff8fab" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M${x - 6} ${y - 3} L${x + 6} ${y - 3} M${x - 9} ${y + 3} L${x + 9} ${y + 3}`} stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={x} cy={y - 16} r="3.2" fill="#6fb6ff" stroke={INK} strokeWidth="1" />
    </g>
  );
}

/** Christmas: a red hat with a white trim and pompom. */
function SantaHat({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 12} ${y + 7} C${x - 8} ${y - 10} ${x + 2} ${y - 18} ${x + 13} ${y - 12} C${x + 8} ${y - 4} ${x + 4} ${y} ${x + 10} ${y + 7} z`} fill="#e24b5a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <rect x={x - 14} y={y + 5} width="26" height="5" rx="2.5" fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx={x + 13} cy={y - 12} r="3.4" fill="#fff" stroke={INK} strokeWidth="1" />
    </g>
  );
}

/** Diwali: a small clay lamp by the feet with a flickering-looking flame. */
function Diya({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 9} ${y} q9 8 18 0 l-2 4 h-14 z`} fill="#e59a6a" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d={`M${x} ${y - 10} c3 3 3 7 0 9 c-3 -2 -3 -6 0 -9 z`} fill="#ffb454" stroke="#e0a800" strokeWidth="1" />
      <circle cx={x} cy={y - 5} r="1.3" fill="#fff6d6" />
    </g>
  );
}

/** Holi: colour smudges on the body. */
function ColourSmudges({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.85">
      <ellipse cx={x - 14} cy={y + 6} rx="5" ry="3.2" fill="#ff8fab" transform={`rotate(-20 ${x - 14} ${y + 6})`} />
      <ellipse cx={x + 12} cy={y + 2} rx="4.5" ry="3" fill="#6fb6ff" transform={`rotate(15 ${x + 12} ${y + 2})`} />
      <ellipse cx={x + 2} cy={y + 16} rx="4" ry="2.6" fill="#ffd166" />
      <ellipse cx={x - 6} cy={y - 9} rx="3.5" ry="2.4" fill="#5fd3a4" transform={`rotate(30 ${x - 6} ${y - 9})`} />
    </g>
  );
}

/** Bow at level 2, crown from level 3; an empty group at level 1 so it can still pop in later. A festival accessory replaces them for the day. */
function Accessory({ level, bow, crown, accessory, parts }: { level: number; bow: { x: number; y: number; color: string }; crown: { x: number; y: number }; accessory?: PetAccessory | null; parts?: PartControls }) {
  return (
    <Part name="accessory" parts={parts}>
      {level === 2 && !accessory && <Bow {...bow} />}
      {level >= 3 && !accessory && <Crown {...crown} />}
      {accessory === "party" && <PartyHat x={crown.x} y={crown.y} />}
      {accessory === "santa" && <SantaHat x={crown.x} y={crown.y} />}
      {accessory === "diya" && <Diya x={crown.x + 34} y={96} />}
      {accessory === "colours" && <ColourSmudges x={crown.x} y={crown.y + 36} />}
    </Part>
  );
}

export function PetSprite({ species, mood, level, size = 120, className, parts, accessory = null }: Props) {
  const s = PET_SPECIES[species];
  const big = level >= 3;
  const scale = big ? 1.12 : 1;
  const droop = mood === "sad" || mood === "hungry" ? 3 : 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`${s.name}, ${mood}`} overflow="visible">
      <g transform={`translate(60 62) scale(${scale}) translate(-60 -62)`}>
        <Part name="breath" parts={parts} origin={FEET}>
          {species === "blob" && (
            <>
              <Part name="body" parts={parts}>
                <path d={`M30 ${74 + droop} C30 42 44 30 60 30 C76 30 90 42 90 ${74 + droop} C90 92 76 98 60 98 C44 98 30 92 30 ${74 + droop}Z`} fill={s.color} />
                <ellipse cx="48" cy="48" rx="7" ry="4" fill="#fff" opacity=".6" />
              </Part>
              <Face mood={mood} x={60} y={62} parts={parts} />
              <Accessory level={level} accessory={accessory} bow={{ x: 82, y: 44, color: "#ffd166" }} crown={{ x: 60, y: 26 }} parts={parts} />
            </>
          )}
          {species === "sprout" && (
            <>
              <Part name="body" parts={parts}>
                <path d="M60 36 C54 22 44 18 36 22 C40 30 50 36 60 36Z" fill={s.accent} />
                <path d="M60 38 C66 24 76 20 84 24 C80 32 70 38 60 38Z" fill={s.color} />
                <line x1="60" y1="38" x2="60" y2="50" stroke={s.accent} strokeWidth="3" strokeLinecap="round" />
                <rect x="34" y="48" width="52" height="48" rx="22" fill={s.color} />
                <path d="M36 96 h48 l-4 10 h-40z" fill="#e59a6a" />
              </Part>
              <Face mood={mood} x={60} y={68} gap={8} parts={parts} />
              <Accessory level={level} accessory={accessory} bow={{ x: 60, y: 46, color: "#ff8fab" }} crown={{ x: 60, y: 30 }} parts={parts} />
            </>
          )}
          {species === "puff" && (
            <>
              <Part name="body" parts={parts}>
                <circle cx="42" cy="66" r="18" fill={s.color} />
                <circle cx="60" cy="56" r="22" fill={s.color} />
                <circle cx="78" cy="66" r="18" fill={s.color} />
                <rect x="28" y="66" width="64" height="22" rx="11" fill={s.color} />
                <path d="M44 42 l-4 -14 l12 8z M76 42 l4 -14 l-12 8z" fill={s.accent} />
                <path d="M52 76 q2 3 4 0 M64 76 q2 3 4 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </Part>
              <Face mood={mood} x={60} y={64} parts={parts} />
              <Accessory level={level} accessory={accessory} bow={{ x: 82, y: 48, color: "#b48cff" }} crown={{ x: 60, y: 30 }} parts={parts} />
            </>
          )}
        </Part>
      </g>
    </svg>
  );
}
