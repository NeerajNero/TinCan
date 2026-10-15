"use client";

import { useEffect, useState } from "react";

import { fetchWeather, isWeatherFresh, readWeatherCache, WEATHER_TTL_MS, type Weather } from "@/lib/weather";

/**
 * Current weather for a point. Served from the 30-minute localStorage cache
 * when fresh; otherwise fetched, then refreshed on a 30-minute timer.
 */
export function useWeather(lat: number | null, lng: number | null): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(() =>
    lat !== null && lng !== null ? readWeatherCache(lat, lng) : null,
  );

  useEffect(() => {
    if (lat === null || lng === null) return;
    const controller = new AbortController();

    const load = () => {
      const cached = readWeatherCache(lat, lng);
      if (isWeatherFresh(cached)) {
        setWeather(cached);
        return;
      }
      fetchWeather(lat, lng, controller.signal)
        .then((w) => {
          if (!controller.signal.aborted) setWeather(w);
        })
        .catch(() => {
          // Keep whatever we had; the next tick will retry.
        });
    };

    // Defer the first load to a task so the effect body stays side-effect-only.
    const first = setTimeout(load, 0);
    const timer = setInterval(load, WEATHER_TTL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      controller.abort();
    };
  }, [lat, lng]);

  return weather;
}
