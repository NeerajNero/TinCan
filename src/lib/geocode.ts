/**
 * City search via the Open-Meteo geocoding API (free, no key).
 * https://open-meteo.com/en/docs/geocoding-api
 */
import { z } from "zod";

import type { CityPick } from "@/lib/types";

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

const resultSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  country: z.string().optional(),
  admin1: z.string().optional(),
});

const responseSchema = z.object({ results: z.array(resultSchema).optional() });

export interface CityResult extends CityPick {
  id: number;
}

/** Up to five matching places for a free-text query. Empty query → no request. */
export async function searchCities(query: string, signal?: AbortSignal): Promise<CityResult[]> {
  const name = query.trim();
  if (name.length < 2) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocode_${res.status}`);
  const parsed = responseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("geocode_bad_response");

  return (parsed.data.results ?? []).map((r) => ({
    id: r.id,
    city: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lng: r.longitude,
    tz: r.timezone,
  }));
}
