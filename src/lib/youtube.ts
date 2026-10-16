/** YouTube helpers: id parsing, oEmbed title lookup (no key), IFrame API loader. */

export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
      if (m) return m;
    }
  } catch {
    // not a URL
  }
  return null;
}

export interface YouTubeMeta {
  title: string;
  thumb: string;
}

export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`oembed_${res.status}`);
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  return { title: data.title ?? "YouTube video", thumb: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
}

/* ── IFrame API (loaded once) ──────────────────────────────────────────── */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  loadVideoById(id: string, startSeconds?: number): void;
  cueVideoById(id: string, startSeconds?: number): void;
  destroy(): void;
  getVideoData?: () => { video_id?: string };
}
interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT as YTNamespace);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return loading;
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;
