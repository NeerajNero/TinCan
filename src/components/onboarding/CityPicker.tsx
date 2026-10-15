"use client";

import { MapPin, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { searchCities, type CityResult } from "@/lib/geocode";
import type { CityPick } from "@/lib/types";

interface CityPickerProps {
  value: CityPick | null;
  onChange: (pick: CityPick | null) => void;
  autoFocus?: boolean;
}

/** Type a city, pick a match from Open-Meteo; stores name + lat/lng + time zone. */
export function CityPicker({ value, onChange, autoFocus }: CityPickerProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  // Results are cleared in `handleQueryChange`; this effect only fetches.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        setResults(await searchCities(q, controller.signal));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      setFailed(false);
    }
  }

  function pick(r: CityResult) {
    onChange({ city: r.city, region: r.region, lat: r.lat, lng: r.lng, tz: r.tz });
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>City</Label>
        <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
          <MapPin size={18} aria-hidden className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.city}</p>
            <p className="truncate text-xs text-muted">
              {value.region ? `${value.region} · ` : ""}
              {value.tz}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="tap rounded-full px-3 text-sm font-bold text-muted"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>City</Label>
      <div className="relative">
        <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <Input
          id={id}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Where are you?"
          autoComplete="off"
          autoFocus={autoFocus}
          className="pl-11"
          aria-busy={searching}
        />
      </div>
      {failed && (
        <p role="alert" className="text-sm text-muted">
          Couldn&apos;t look that up. Check your connection and try again.
        </p>
      )}
      {results.length > 0 && (
        <ul className="card divide-y divide-border overflow-hidden p-0" aria-label="Matching places">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className={cn("tap flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2")}
              >
                <MapPin size={16} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.city}</span>
                  <span className="block truncate text-xs text-muted">{r.region || r.tz}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!searching && !failed && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted">No places found — try the nearest big city.</p>
      )}
    </div>
  );
}
