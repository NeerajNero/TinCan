/**
 * Current weather from the Open-Meteo forecast API (free, no key), cached in
 * localStorage so a city is fetched at most once every 30 minutes.
 */
import { z } from "zod/mini";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const WEATHER_TTL_MS = 30 * 60 * 1000;

const schema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
  }),
});

export interface Weather {
  tempC: number;
  code: number;
  isDay: boolean;
  emoji: string;
  label: string;
  /** Epoch ms when fetched. */
  at: number;
}

/** WMO weather interpretation codes → emoji + short label. */
function describeWeatherCode(code: number, isDay: boolean): { emoji: string; label: string } {
  if (code === 0) return { emoji: isDay ? "☀️" : "🌙", label: "Clear" };
  if (code === 1) return { emoji: isDay ? "🌤️" : "🌙", label: "Mostly clear" };
  if (code === 2) return { emoji: isDay ? "⛅" : "☁️", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Foggy" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "Showers" };
  if (code === 85 || code === 86) return { emoji: "🌨️", label: "Snow showers" };
  if (code === 95) return { emoji: "⛈️", label: "Thunderstorm" };
  if (code === 96 || code === 99) return { emoji: "⛈️", label: "Hail storm" };
  return { emoji: "🌡️", label: "Weather" };
}

const cacheKey = (lat: number, lng: number) => `tincan-weather:${lat.toFixed(2)},${lng.toFixed(2)}`;

export function readWeatherCache(lat: number, lng: number): Weather | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Weather;
    return typeof parsed.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeWeatherCache(lat: number, lng: number, weather: Weather) {
  try {
    localStorage.setItem(cacheKey(lat, lng), JSON.stringify(weather));
  } catch {
    // Storage unavailable — we'll just refetch next time.
  }
}

export function isWeatherFresh(weather: Weather | null, now = Date.now()): weather is Weather {
  return weather !== null && now - weather.at < WEATHER_TTL_MS;
}

/** Fetches current conditions, honouring the cache unless `force`. */
export async function fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<Weather> {
  const cached = readWeatherCache(lat, lng);
  if (isWeatherFresh(cached)) return cached;

  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather_${res.status}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new Error("weather_bad_response");

  const { temperature_2m, weather_code, is_day } = parsed.data.current;
  const isDay = is_day === 1;
  const weather: Weather = {
    tempC: Math.round(temperature_2m),
    code: weather_code,
    isDay,
    ...describeWeatherCode(weather_code, isDay),
    at: Date.now(),
  };
  writeWeatherCache(lat, lng, weather);
  return weather;
}
