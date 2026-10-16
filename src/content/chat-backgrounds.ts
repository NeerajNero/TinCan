/**
 * Built-in chat backgrounds. Each is CSS only: a gradient plus a tiny inline
 * SVG pattern (well under 2 KB as a data URI), with a light and a dark variant.
 * The "photo" option is handled by the picker (a memory rendered by Cloudinary).
 */
import type { ResolvedTheme } from "@/lib/theme";

export type ChatBgId = "plain" | "gradient" | "doodles" | "dots" | "paper" | "night" | "hearts" | "tincans";

export interface ChatBackground {
  id: ChatBgId;
  name: string;
  emoji: string;
  style: (theme: ResolvedTheme) => React.CSSProperties;
}

/** Encode a small SVG as a data URI (only the characters a URL can't carry). */
const svgUri = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s+/g, " ").trim()}")`;

const tile = (size: number, body: string) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);

const pick = <T,>(theme: ResolvedTheme, light: T, dark: T) => (theme === "dark" ? dark : light);

/* Pattern bodies, parameterised by ink colour (an rgba string). */
const doodles = (ink: string) =>
  tile(
    140,
    `<g fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M22 30c0-6 10-6 10 0 0 5-10 10-10 10s-10-5-10-10c0-6 10-6 10 0z"/>` +
      `<path d="M98 18l3 8 8 1-6 6 2 8-7-4-7 4 2-8-6-6 8-1z"/>` +
      `<path d="M50 90c8-12 20-12 28 0M58 100c4-5 10-5 14 0"/>` +
      `<path d="M104 86c4 0 6-4 10-4s6 4 10 4"/><circle cx="118" cy="110" r="5"/>` +
      `<path d="M14 118c6-10 14-10 20 0M30 60c0 8 12 8 12 0"/>` +
      `</g>`,
  );
const dots = (ink: string) => tile(24, `<circle cx="12" cy="12" r="1.6" fill="${ink}"/>`);
const paper = (ink: string, faint: string) =>
  tile(28, `<path d="M0 27.5h28" stroke="${ink}" stroke-width="1"/><path d="M27.5 0v28" stroke="${faint}" stroke-width="1"/>`);
const stars = (ink: string, bright: string) =>
  tile(
    160,
    `<g fill="${ink}"><circle cx="20" cy="30" r="1.2"/><circle cx="70" cy="12" r="0.9"/><circle cx="120" cy="40" r="1.4"/><circle cx="150" cy="90" r="0.8"/>` +
      `<circle cx="40" cy="110" r="1"/><circle cx="95" cy="140" r="1.3"/><circle cx="10" cy="150" r="0.7"/><circle cx="135" cy="125" r="0.9"/></g>` +
      `<path d="M60 70l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="${bright}"/><path d="M110 95l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="${bright}"/>`,
  );
const hearts = (ink: string) =>
  tile(
    56,
    `<g fill="${ink}"><path d="M14 20c0-4 6-4 6 0 0 3-6 7-6 7s-6-4-6-7c0-4 6-4 6 0z"/>` +
      `<path d="M42 44c0-3 4.5-3 4.5 0 0 2.2-4.5 5-4.5 5s-4.5-2.8-4.5-5c0-3 4.5-3 4.5 0z"/></g>`,
  );
const tincans = (ink: string) =>
  tile(
    120,
    `<g fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round">` +
      `<rect x="18" y="22" width="16" height="22" rx="3"/><ellipse cx="26" cy="22" rx="8" ry="3"/>` +
      `<path d="M34 30c20-10 32 10 52 2"/>` +
      `<rect x="86" y="24" width="16" height="22" rx="3"/><ellipse cx="94" cy="24" rx="8" ry="3"/>` +
      `<path d="M30 92c6 4 12-4 18 0s12-4 18 0"/></g>`,
  );

export const CHAT_BACKGROUNDS: readonly ChatBackground[] = [
  { id: "plain", name: "Plain", emoji: "⬜", style: () => ({ background: "var(--bg)" }) },
  {
    id: "gradient",
    name: "Soft gradient",
    emoji: "🌅",
    style: (t) => ({
      background: pick(
        t,
        "linear-gradient(160deg, #ffe4ec 0%, #fff7f1 45%, #e3f0ff 100%)",
        "linear-gradient(160deg, #1b2144 0%, #141a2e 50%, #1a2a3a 100%)",
      ),
    }),
  },
  {
    id: "doodles",
    name: "Doodles",
    emoji: "✏️",
    style: (t) => ({
      backgroundColor: pick(t, "#fff7f1", "#141a2e"),
      backgroundImage: doodles(pick(t, "rgba(59,47,58,0.14)", "rgba(238,240,255,0.14)")),
      backgroundSize: "140px 140px",
    }),
  },
  {
    id: "dots",
    name: "Dots",
    emoji: "🔵",
    style: (t) => ({
      backgroundColor: pick(t, "#fdf3ec", "#161d33"),
      backgroundImage: dots(pick(t, "rgba(59,47,58,0.18)", "rgba(238,240,255,0.16)")),
      backgroundSize: "24px 24px",
    }),
  },
  {
    id: "paper",
    name: "Paper",
    emoji: "📄",
    style: (t) => ({
      backgroundColor: pick(t, "#fffaf3", "#171d32"),
      backgroundImage: paper(pick(t, "rgba(111,182,255,0.28)", "rgba(133,196,255,0.2)"), pick(t, "rgba(255,143,171,0.16)", "rgba(255,159,186,0.12)")),
      backgroundSize: "28px 28px",
    }),
  },
  {
    id: "night",
    name: "Night sky",
    emoji: "🌙",
    style: (t) => ({
      backgroundColor: pick(t, "#e9e4ff", "#0f1430"),
      backgroundImage: `${stars(pick(t, "rgba(90,70,160,0.45)", "rgba(238,240,255,0.7)"), pick(t, "rgba(255,180,84,0.8)", "rgba(255,214,102,0.95)"))}, ${pick(
        t,
        "linear-gradient(180deg, #e9e4ff 0%, #fbe9f0 100%)",
        "linear-gradient(180deg, #0f1430 0%, #1b1f4a 100%)",
      )}`,
      backgroundSize: "160px 160px, 100% 100%",
    }),
  },
  {
    id: "hearts",
    name: "Hearts",
    emoji: "💗",
    style: (t) => ({
      backgroundColor: pick(t, "#fff1f5", "#1b1626"),
      backgroundImage: hearts(pick(t, "rgba(255,143,171,0.35)", "rgba(255,159,186,0.28)")),
      backgroundSize: "56px 56px",
    }),
  },
  {
    id: "tincans",
    name: "Tin cans",
    emoji: "🥫",
    style: (t) => ({
      backgroundColor: pick(t, "#f1f7ff", "#131b2f"),
      backgroundImage: tincans(pick(t, "rgba(59,47,58,0.16)", "rgba(238,240,255,0.16)")),
      backgroundSize: "120px 120px",
    }),
  },
];

export const CHAT_BG_BY_ID: Record<string, ChatBackground> = Object.fromEntries(CHAT_BACKGROUNDS.map((b) => [b.id, b]));
export const DEFAULT_CHAT_BG: ChatBgId = "plain";
