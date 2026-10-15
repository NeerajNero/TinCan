// Generates the PWA icon set from an inline tin-can SVG.
// Usage: pnpm icons
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const BG = "#ff8fab"; // Home accent — matches theme_color in the manifest

/** @param {{ bg: boolean; pad: number }} opts  pad = fraction of canvas kept clear on each side */
function tinCanSvg({ bg, pad }) {
  const size = 512;
  const inset = size * pad;
  const inner = size - inset * 2;
  // The artwork is drawn in a 100×100 box and scaled into the safe area.
  const scale = inner / 100;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ""}
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <!-- string -->
    <path d="M50 8 C 62 14, 40 22, 50 30" fill="none" stroke="#fff3c4" stroke-width="3.2" stroke-linecap="round"/>
    <!-- can body -->
    <rect x="24" y="28" width="52" height="60" rx="12" fill="#f4f6fb"/>
    <rect x="24" y="40" width="52" height="36" fill="#dfe6f3"/>
    <rect x="24" y="46" width="52" height="24" fill="#c9d4ea"/>
    <!-- label -->
    <rect x="24" y="48" width="52" height="20" fill="#fff6e8"/>
    <!-- heart on the label -->
    <path d="M50 65 C 44 60, 38 56, 41 51 C 43 48, 48 48.5, 50 52 C 52 48.5, 57 48, 59 51 C 62 56, 56 60, 50 65 Z" fill="#ff6f91"/>
    <!-- lid -->
    <ellipse cx="50" cy="29" rx="26" ry="8" fill="#eef2fa"/>
    <ellipse cx="50" cy="29" rx="19" ry="5" fill="#cfd8ea"/>
    <!-- bottom rim -->
    <path d="M24 84 a26 8 0 0 0 52 0" fill="#b7c3dc"/>
    <!-- shine -->
    <rect x="30" y="42" width="5" height="40" rx="2.5" fill="#ffffff" opacity="0.7"/>
  </g>
</svg>`;
}

const jobs = [
  // Transparent-background "any" icons with a soft rounded tile behind the art.
  { file: "public/icons/icon-192.png", size: 192, bg: true, pad: 0.06 },
  { file: "public/icons/icon-512.png", size: 512, bg: true, pad: 0.06 },
  // Maskable: full-bleed background, art inside the 80% safe zone.
  { file: "public/icons/maskable-192.png", size: 192, bg: true, pad: 0.16 },
  { file: "public/icons/maskable-512.png", size: 512, bg: true, pad: 0.16 },
  // Apple touch icon (Next serves src/app/apple-icon.png automatically).
  { file: "src/app/apple-icon.png", size: 180, bg: true, pad: 0.08 },
];

await mkdir(path.join(root, "public/icons"), { recursive: true });

for (const job of jobs) {
  const svg = Buffer.from(tinCanSvg({ bg: job.bg, pad: job.pad }));
  await sharp(svg).resize(job.size, job.size).png().toFile(path.join(root, job.file));
  console.log("✓", job.file);
}

// Favicon: Next picks up src/app/icon.svg.
await writeFile(path.join(root, "src/app/icon.svg"), tinCanSvg({ bg: true, pad: 0.04 }).trim() + "\n");
console.log("✓ src/app/icon.svg");
