/**
 * GIFs through our own GET /api/gif: the GIPHY key stays on the server, and
 * GIPHY sees the query from Vercel, not from the phone. The 500 ms debounce
 * lives in the GIF tab; trending is cached for the session here and for ten
 * minutes on the server.
 */
import { authedFetch } from "@/lib/api";

export interface Gif {
  id: string;
  title: string;
  /** What gets sent. */
  url: string;
  w: number;
  h: number;
  /** Small preview for the picker grid. */
  previewUrl: string;
}

export class GiphyRateLimited extends Error {
  constructor() {
    super("giphy_rate_limited");
  }
}

let status: Promise<boolean> | null = null;

/** Whether the server has a GIPHY key; asked once per session. */
export function giphyAvailable(): Promise<boolean> {
  status ??= authedFetch("/api/gif?mode=status")
    .then(async (res) => (res.ok ? Boolean(((await res.json()) as { enabled?: boolean }).enabled) : false))
    .catch(() => {
      status = null;
      return false;
    });
  return status;
}

let trendingCache: Gif[] | null = null;

/** Search, or trending for an empty query. */
export async function searchGifs(query: string, signal?: AbortSignal): Promise<Gif[]> {
  const q = query.trim();
  if (!q && trendingCache) return trendingCache;
  const res = await authedFetch(`/api/gif${q ? `?q=${encodeURIComponent(q.slice(0, 80))}` : ""}`, { signal });
  if (res.status === 429) throw new GiphyRateLimited();
  if (!res.ok) throw new Error(`gif_${res.status}`);
  const { gifs = [] } = (await res.json()) as { gifs?: Gif[] };
  if (!q) trendingCache = gifs;
  return gifs;
}
