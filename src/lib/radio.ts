/**
 * Radio stations (src/content/radio.json) and what the page, the CSP and the
 * service worker need to know about them. Pure, with relative imports only:
 * csp.ts (repo root) and src/app/sw.ts import it too.
 */
import stations from "../content/radio.json";

export interface Station {
  id: string;
  name: string;
  genre: string;
  region: "India" | "World";
  /** Shown as a chip on Indian stations. */
  language?: string;
  format: "mp3" | "aac" | "hls";
  url: string;
  /** Hosts the stream redirects to or serves segments from, when not the url's own. */
  hosts?: string[];
  attribution: string;
  verified: boolean;
}

export const STATIONS = stations as Station[];

const origin = (url: string) => new URL(url).origin;
const unique = (xs: string[]) => Array.from(new Set(xs));
const allOrigins = (s: Station) => [origin(s.url), ...(s.hosts ?? []).map((h) => `https://${h}`)];

/** Every origin <audio> may load from (native HLS follows redirects and loads segments as media). */
export const RADIO_MEDIA_ORIGINS = unique(STATIONS.flatMap(allOrigins));

/** Origins hls.js fetches (playlists and segments over fetch/XHR): HLS stations only. */
export const RADIO_HLS_ORIGINS = unique(STATIONS.filter((s) => s.format === "hls").flatMap(allOrigins));

/** Hostnames the service worker must never intercept. */
export const RADIO_HOSTNAMES = new Set(RADIO_MEDIA_ORIGINS.map((o) => new URL(o).hostname));

/**
 * How to play a station here: `src` for anything the <audio> element handles
 * itself (mp3/aac, and HLS where the browser plays it natively, as Android
 * Chrome does), `hls.js` for HLS elsewhere.
 */
export function playbackMode(station: Pick<Station, "format">, canPlayHls: string): "src" | "hls.js" {
  return station.format === "hls" && !canPlayHls ? "hls.js" : "src";
}

export const LAST_STATION_KEY = (uid: string) => `tincan.radio.last.${uid}`;
