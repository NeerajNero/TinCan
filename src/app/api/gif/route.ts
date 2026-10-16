import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, guard, GuardError } from "@/lib/server/guard";

const querySchema = z
  .object({
    q: z.string().max(80).optional(),
    mode: z.enum(["status"]).optional(),
  })
  .strict();

const image = z.object({ url: z.string(), width: z.string(), height: z.string() });
const giphySchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      images: z.object({ fixed_height: image, fixed_width_small: image.optional(), fixed_height_small: image.optional() }),
    }),
  ),
});

const GIPHY_MEDIA = /^https:\/\/media\d*\.giphy\.com\//;
const TRENDING_TTL_MS = 10 * 60 * 1000;
let trending: { at: number; gifs: Gif[] } | null = null;

interface Gif {
  id: string;
  title: string;
  url: string;
  w: number;
  h: number;
  previewUrl: string;
}

/**
 * GET /api/gif — GIPHY search (`?q=`) or trending (no `q`), rating pg, behind
 * the shared guard so the key (GIPHY_API_KEY) never reaches the browser.
 * Trending is cached per server instance for 10 minutes. `?mode=status`
 * tells the client whether GIFs are available at all.
 */
export async function GET(req: Request) {
  try {
    await guard(req, "gif");
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) throw new GuardError(400, "bad_request", "gif query");
    const key = process.env.GIPHY_API_KEY;
    if (parsed.data.mode === "status") return NextResponse.json({ enabled: Boolean(key) });
    if (!key) return NextResponse.json({ enabled: false, gifs: [] });

    const q = parsed.data.q?.trim() ?? "";
    if (!q && trending && Date.now() - trending.at < TRENDING_TTL_MS) return NextResponse.json({ enabled: true, gifs: trending.gifs });

    const url = new URL(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}`);
    url.searchParams.set("api_key", key);
    if (q) url.searchParams.set("q", q);
    url.searchParams.set("limit", "24");
    url.searchParams.set("rating", "pg");
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 429) throw new GuardError(429, "rate_limited", "giphy 429");
    if (!res.ok) throw new GuardError(502, "upstream_error", `giphy ${res.status}`);
    const body = giphySchema.safeParse(await res.json());
    if (!body.success) throw new GuardError(502, "upstream_error", "giphy shape");

    const gifs: Gif[] = body.data.data
      .map((g) => ({
        id: g.id,
        title: g.title || "GIF",
        url: g.images.fixed_height.url,
        w: Number(g.images.fixed_height.width),
        h: Number(g.images.fixed_height.height),
        previewUrl: (g.images.fixed_height_small ?? g.images.fixed_width_small ?? g.images.fixed_height).url,
      }))
      .filter((g) => GIPHY_MEDIA.test(g.url) && GIPHY_MEDIA.test(g.previewUrl));
    if (!q) trending = { at: Date.now(), gifs };
    return NextResponse.json({ enabled: true, gifs });
  } catch (err) {
    return errorResponse(err, "gif");
  }
}
