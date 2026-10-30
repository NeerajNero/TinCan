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
  const scale = inner / 100;
  const can = (x, y, tilt) => `
    <g transform="translate(${x} ${y}) rotate(${tilt})">
      <rect x="-13" y="-20" width="26" height="40" rx="7" fill="#f4f6fb"/>
      <rect x="-13" y="-10" width="26" height="20" fill="#dfe6f3"/>
      <rect x="-13" y="-6" width="26" height="12" fill="#fff6e8"/>
      <path d="M0 2 C -4 -1 -7 -3 -5 -6 C -4 -8 -1 -8 0 -6 C 1 -8 4 -8 5 -6 C 7 -3 4 -1 0 2 Z" fill="#ff6f91"/>
      <ellipse cx="0" cy="-20" rx="13" ry="4.5" fill="#eef2fa"/>
      <ellipse cx="0" cy="-20" rx="9" ry="2.6" fill="#cfd8ea"/>
      <path d="M-13 20 a13 4.5 0 0 0 26 0" fill="#b7c3dc"/>
      <rect x="-10" y="-11" width="3" height="24" rx="1.5" fill="#fff" opacity="0.7"/>
    </g>`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BG}"/>` : ""}
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <!-- the string, sagging between two cans -->
    <path d="M30 40 C 42 62, 58 62, 70 40" fill="none" stroke="#fff3c4" stroke-width="3.4" stroke-linecap="round"/>
    ${can(24, 58, -14)}
    ${can(76, 58, 14)}
    <!-- a little sparkle where the words travel -->
    <circle cx="50" cy="50" r="2.6" fill="#fff3c4"/>
    <circle cx="44" cy="47" r="1.4" fill="#fff3c4" opacity="0.8"/>
    <circle cx="56" cy="47" r="1.4" fill="#fff3c4" opacity="0.8"/>
  </g>
</svg>`;
}

/** Monochrome badge for Android's status bar: white silhouette on transparent. */
function badgeSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="96" height="96">
  <path d="M30 40 C 42 62, 58 62, 70 40" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <g transform="translate(24 58) rotate(-14)"><rect x="-13" y="-20" width="26" height="40" rx="7" fill="#fff"/><ellipse cx="0" cy="-20" rx="13" ry="4.5" fill="#fff"/></g>
  <g transform="translate(76 58) rotate(14)"><rect x="-13" y="-20" width="26" height="40" rx="7" fill="#fff"/><ellipse cx="0" cy="-20" rx="13" ry="4.5" fill="#fff"/></g>
</svg>`;
}

/**
 * Home-screen shortcut icons (manifest `shortcuts`): a full-bleed tab colour
 * with a plain white glyph inside the maskable safe zone. Vector only, so the
 * output never depends on the build machine's emoji fonts.
 */
const SHORTCUTS = {
  chat: { bg: "#6fb6ff", glyph: `<path d="M26 30 h48 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-30 l-14 11 v-11 h-4 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 z" fill="#fff"/><circle cx="40" cy="51" r="3.5" fill="#6fb6ff"/><circle cx="50" cy="51" r="3.5" fill="#6fb6ff"/><circle cx="60" cy="51" r="3.5" fill="#6fb6ff"/>` },
  ping: { bg: "#ff8fab", glyph: `<circle cx="50" cy="52" r="8" fill="#fff"/><path d="M34 38 a22 22 0 0 0 0 28 M66 38 a22 22 0 0 1 0 28" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M24 29 a36 36 0 0 0 0 46 M76 29 a36 36 0 0 1 0 46" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.7"/>` },
  word: { bg: "#ffb454", glyph: ["#6aaa64", "#c9b458", "#fff", "#fff", "#6aaa64", "#c9b458", "#c9b458", "#fff", "#6aaa64"].map((c, i) => `<rect x="${27 + (i % 3) * 16}" y="${29 + Math.floor(i / 3) * 16}" width="13" height="13" rx="3" fill="${c}"/>`).join("") },
  pet: { bg: "#b48cff", glyph: `<ellipse cx="50" cy="62" rx="15" ry="12" fill="#fff"/><ellipse cx="32" cy="46" rx="6" ry="8" fill="#fff" transform="rotate(-20 32 46)"/><ellipse cx="44" cy="36" rx="6" ry="8" fill="#fff"/><ellipse cx="56" cy="36" rx="6" ry="8" fill="#fff"/><ellipse cx="68" cy="46" rx="6" ry="8" fill="#fff" transform="rotate(20 68 46)"/>` },
};

function shortcutSvg({ bg, glyph }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="96" height="96"><rect width="100" height="100" fill="${bg}"/><g>${glyph}</g></svg>`;
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

await sharp(Buffer.from(badgeSvg())).resize(96, 96).png().toFile(path.join(root, "public/icons/badge-96.png"));
console.log("✓ public/icons/badge-96.png");

for (const [name, spec] of Object.entries(SHORTCUTS)) {
  const file = `public/icons/shortcut-${name}-96.png`;
  await sharp(Buffer.from(shortcutSvg(spec))).resize(96, 96).png().toFile(path.join(root, file));
  console.log("✓", file);
}

// Favicon: Next picks up src/app/icon.svg.
await writeFile(path.join(root, "src/app/icon.svg"), tinCanSvg({ bg: true, pad: 0.04 }).trim() + "\n");
console.log("✓ src/app/icon.svg");
