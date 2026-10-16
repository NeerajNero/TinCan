/** GIPHY search, only when NEXT_PUBLIC_GIPHY_API_KEY is set. Rating pg. */
import { z } from "zod/mini";

import { publicEnv } from "@/lib/env";

export const giphyEnabled = Boolean(publicEnv.giphyKey);

const image = z.object({ url: z.string(), width: z.string(), height: z.string() });
const schema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      title: z.optional(z.string()),
      images: z.object({ fixed_height: image, fixed_width_small: z.optional(image), fixed_height_small: z.optional(image) }),
    }),
  ),
});

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

let trendingCache: Gif[] | null = null;

export class GiphyRateLimited extends Error {
  constructor() {
    super("giphy_rate_limited");
  }
}

/** Search, or trending for an empty query (trending is fetched once per session). */
export async function searchGifs(query: string, signal?: AbortSignal): Promise<Gif[]> {
  if (!giphyEnabled) return [];
  const q = query.trim();
  if (!q && trendingCache) return trendingCache;
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}`);
  url.searchParams.set("api_key", publicEnv.giphyKey);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("limit", "24");
  url.searchParams.set("rating", "pg");
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new GiphyRateLimited();
  if (!res.ok) throw new Error(`giphy_${res.status}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new Error("giphy_bad_response");
  const gifs = parsed.data.data.map((g) => ({
    id: g.id,
    title: g.title ?? "GIF",
    url: g.images.fixed_height.url,
    w: Number(g.images.fixed_height.width),
    h: Number(g.images.fixed_height.height),
    previewUrl: (g.images.fixed_height_small ?? g.images.fixed_width_small ?? g.images.fixed_height).url,
  }));
  if (!q) trendingCache = gifs;
  return gifs;
}
