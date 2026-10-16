/**
 * The streak plant: ten growth stages drawn as one inline SVG. Each stage adds
 * height, leaves and eventually flowers; `wilted` droops everything and fades
 * the greens (but the stage itself never goes backwards).
 */

export interface PlantStage {
  /** Stem height in SVG units. */
  stem: number;
  leaves: number;
  bud: boolean;
  flower: boolean;
  /** Little side flowers at the very top stages. */
  extraFlowers: number;
}

export const PLANT_STAGES: readonly PlantStage[] = [
  { stem: 10, leaves: 1, bud: false, flower: false, extraFlowers: 0 },
  { stem: 18, leaves: 1, bud: false, flower: false, extraFlowers: 0 },
  { stem: 26, leaves: 2, bud: false, flower: false, extraFlowers: 0 },
  { stem: 34, leaves: 2, bud: false, flower: false, extraFlowers: 0 },
  { stem: 42, leaves: 3, bud: false, flower: false, extraFlowers: 0 },
  { stem: 50, leaves: 3, bud: true, flower: false, extraFlowers: 0 },
  { stem: 56, leaves: 4, bud: true, flower: false, extraFlowers: 0 },
  { stem: 62, leaves: 4, bud: false, flower: true, extraFlowers: 0 },
  { stem: 68, leaves: 5, bud: false, flower: true, extraFlowers: 1 },
  { stem: 74, leaves: 6, bud: false, flower: true, extraFlowers: 2 },
];

export const PLANT_STAGE_NAMES = [
  "Seedling",
  "Sprout",
  "Little shoot",
  "Leafy",
  "Growing",
  "Budding",
  "Almost there",
  "In bloom",
  "Flourishing",
  "Full bloom",
] as const;

interface PlantSvgProps {
  /** 1–10. */
  stage: number;
  wilted?: boolean;
  className?: string;
}

const BASE_X = 60;
const SOIL_Y = 96;

export function PlantSvg({ stage, wilted = false, className }: PlantSvgProps) {
  const s = PLANT_STAGES[Math.min(PLANT_STAGES.length, Math.max(1, Math.round(stage))) - 1] ?? PLANT_STAGES[0]!;
  const topY = SOIL_Y - s.stem;

  const green = wilted ? "#b9a86a" : "#5fbf8a";
  const greenDark = wilted ? "#9c8b50" : "#3f9c6b";
  const petal = wilted ? "#d9a0a8" : "#ff8fab";
  const petalCore = wilted ? "#e3c17a" : "#ffd166";

  // Wilted: the stem leans and leaves hang.
  const lean = wilted ? 14 : 0;
  const stemPath = wilted
    ? `M${BASE_X} ${SOIL_Y} C ${BASE_X} ${SOIL_Y - s.stem * 0.6}, ${BASE_X + lean} ${topY + 6}, ${BASE_X + lean + 6} ${topY + 10}`
    : `M${BASE_X} ${SOIL_Y} C ${BASE_X - 2} ${SOIL_Y - s.stem * 0.5}, ${BASE_X + 2} ${SOIL_Y - s.stem * 0.8}, ${BASE_X} ${topY}`;
  const tipX = wilted ? BASE_X + lean + 6 : BASE_X;
  const tipY = wilted ? topY + 10 : topY;

  const leaves = Array.from({ length: s.leaves }, (_, i) => {
    const t = (i + 1) / (s.leaves + 1);
    const y = SOIL_Y - s.stem * t;
    const side = i % 2 === 0 ? -1 : 1;
    const x = BASE_X + (wilted ? lean * t : 0);
    const size = 8 + Math.min(6, s.stem / 12);
    const angle = side * (wilted ? 70 : 35);
    return (
      <ellipse
        key={i}
        cx={x + side * size * 0.9}
        cy={y}
        rx={size}
        ry={size * 0.5}
        fill={green}
        stroke={greenDark}
        strokeWidth={1.2}
        transform={`rotate(${angle} ${x} ${y})`}
      />
    );
  });

  return (
    <svg
      viewBox="0 0 120 130"
      role="img"
      aria-label={`${PLANT_STAGE_NAMES[PLANT_STAGES.indexOf(s)]}${wilted ? ", a bit droopy" : ""}`}
      className={className}
    >
      {/* pot */}
      <path d="M34 98 L86 98 L80 124 Q60 128 40 124 Z" fill="#e59a6a" />
      <rect x="30" y="92" width="60" height="10" rx="5" fill="#f2b088" />
      {/* soil */}
      <ellipse cx="60" cy="97" rx="24" ry="4" fill="#7a5236" />

      {/* stem */}
      <path d={stemPath} fill="none" stroke={greenDark} strokeWidth={3} strokeLinecap="round" />
      {leaves}

      {/* bud */}
      {s.bud && (
        <g transform={`translate(${tipX} ${tipY})`}>
          <ellipse cx="0" cy="-4" rx="5" ry="7" fill={petal} stroke={greenDark} strokeWidth={1} />
          <path d="M-5 -1 Q0 6 5 -1" fill={green} />
        </g>
      )}

      {/* flower */}
      {s.flower && <Flower x={tipX} y={tipY - 2} r={9} petal={petal} core={petalCore} wilted={wilted} />}
      {Array.from({ length: s.extraFlowers }, (_, i) => {
        const side = i === 0 ? -1 : 1;
        const t = 0.55 + i * 0.15;
        const y = SOIL_Y - s.stem * t;
        return (
          <Flower
            key={i}
            x={BASE_X + side * 18 + (wilted ? lean * t : 0)}
            y={y + (wilted ? 8 : 0)}
            r={6}
            petal={petal}
            core={petalCore}
            wilted={wilted}
          />
        );
      })}
    </svg>
  );
}

function Flower({ x, y, r, petal, core, wilted }: { x: number; y: number; r: number; petal: string; core: string; wilted: boolean }) {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 + (wilted ? 30 : 0)) * (Math.PI / 180);
    return <circle key={i} cx={x + Math.cos(a) * r * 0.8} cy={y + Math.sin(a) * r * 0.8} r={r * 0.55} fill={petal} />;
  });
  return (
    <g transform={wilted ? `rotate(25 ${x} ${y})` : undefined}>
      {petals}
      <circle cx={x} cy={y} r={r * 0.45} fill={core} />
    </g>
  );
}
