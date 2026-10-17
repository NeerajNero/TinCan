import { describe, expect, it } from "vitest";

import { playbackMode, RADIO_HOSTNAMES, STATIONS } from "@/lib/radio";

describe("radio stations", () => {
  it("has the six All India Radio channels, official streams only, as HLS", () => {
    const india = STATIONS.filter((s) => s.region === "India");
    expect(india.map((s) => s.id)).toEqual(["air-vividh-bharati", "air-fm-gold", "air-fm-rainbow", "air-raagam", "air-kannada", "air-telugu"]);
    for (const s of india) {
      expect(s.attribution).toBe("All India Radio / Prasar Bharati");
      expect(s.language).toBeTruthy();
      expect(s.format).toBe("hls");
      expect(new URL(s.url).host).toMatch(/^(radio\.wavespb\.com|d3r9rhourdc02u\.cloudfront\.net)$/);
    }
  });

  it("every station is https with a unique id, region and format", () => {
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(STATIONS.length);
    for (const s of STATIONS) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(["India", "World"]).toContain(s.region);
      expect(["mp3", "aac", "hls"]).toContain(s.format);
    }
  });

  it("plays HLS natively when the browser can, through hls.js otherwise", () => {
    expect(playbackMode({ format: "hls" }, "maybe")).toBe("src");
    expect(playbackMode({ format: "hls" }, "probably")).toBe("src");
    expect(playbackMode({ format: "hls" }, "")).toBe("hls.js");
    expect(playbackMode({ format: "mp3" }, "")).toBe("src");
  });

  it("the worker skips every stream host, redirect targets included", () => {
    for (const h of ["radio.wavespb.com", "d1tmej9eu7kw5c.cloudfront.net", "d1cvqgmbcpg5yn.cloudfront.net", "d3r9rhourdc02u.cloudfront.net", "stream.radioparadise.com"]) expect(RADIO_HOSTNAMES.has(h)).toBe(true);
    expect(RADIO_HOSTNAMES.has("res.cloudinary.com")).toBe(false);
  });
});
