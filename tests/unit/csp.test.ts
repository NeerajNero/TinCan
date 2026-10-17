import { describe, expect, it } from "vitest";

import { buildCsp, buildPermissionsPolicy, buildWorkerCsp, FIRESTORE_PROBE_IMG } from "../../csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `))?.split(" ").slice(1) ?? [];

describe("CSP", () => {
  const csp = buildCsp({ nonce: "abc", projectId: "proj", databaseUrl: "https://proj-default-rtdb.asia-southeast1.firebasedatabase.app" });

  it("lets the Realtime Database fall back to long-polling (scripts + disconnect iframe)", () => {
    // Without these, a phone whose WebSocket failed once stays offline forever.
    for (const d of ["script-src", "frame-src"]) {
      expect(directive(csp, d)).toContain("https://*.firebasedatabase.app");
      expect(directive(csp, d)).toContain("https://*.firebaseio.com");
      expect(directive(csp, d)).toContain("https://proj-default-rtdb.asia-southeast1.firebasedatabase.app");
    }
    expect(directive(csp, "connect-src")).toContain("wss://*.firebasedatabase.app");
  });

  it("allows Firestore's connectivity probe image, path-limited, in both policies", () => {
    // The WebChannel transport loads www.google.com/images/cleardot.gif to decide on long-polling.
    expect(FIRESTORE_PROBE_IMG).toBe("https://www.google.com/images/");
    expect(directive(csp, "img-src")).toContain(FIRESTORE_PROBE_IMG);
    expect(directive(csp, "img-src")).not.toContain("https://www.google.com");
    expect(directive(buildWorkerCsp(), "img-src")).toContain(FIRESTORE_PROBE_IMG);
    expect(directive(buildWorkerCsp(), "img-src")).not.toContain("https://www.google.com");
  });

  it("lets the YouTube IFrame API and player embed load", () => {
    for (const h of ["https://www.youtube.com", "https://s.ytimg.com"]) expect(directive(csp, "script-src")).toContain(h);
    // 'strict-dynamic' would make browsers ignore those host entries.
    expect(directive(csp, "script-src")).not.toContain("'strict-dynamic'");
    for (const h of ["https://www.youtube.com", "https://www.youtube-nocookie.com"]) expect(directive(csp, "frame-src")).toContain(h);
    for (const h of ["https://i.ytimg.com", "https://*.ytimg.com"]) expect(directive(csp, "img-src")).toContain(h);
  });

  it("delegates playback features to the YouTube iframe and nothing else", () => {
    const pp = buildPermissionsPolicy();
    for (const f of ["autoplay", "encrypted-media", "fullscreen", "picture-in-picture"]) {
      expect(pp).toContain(`${f}=(self "https://www.youtube-nocookie.com" "https://www.youtube.com")`);
    }
    expect(pp).toContain("microphone=(self)");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("geolocation=()");
  });

  it("keeps scripts strict", () => {
    expect(directive(csp, "script-src")).toContain("'nonce-abc'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
  });

  it("lets <audio> play every radio stream, and hls.js fetch only the HLS hosts", () => {
    const csp = buildCsp({ nonce: "n" });
    const media = directive(csp, "media-src");
    const connect = directive(csp, "connect-src");
    // All India Radio: WAVES redirects to a fixed CloudFront host per stream; the rest are on one distribution.
    const air = ["https://radio.wavespb.com", "https://d1tmej9eu7kw5c.cloudfront.net", "https://d1cvqgmbcpg5yn.cloudfront.net", "https://d3r9rhourdc02u.cloudfront.net"];
    for (const h of [...air, "https://stream.radioparadise.com", "https://icecast.radiofrance.fr"]) expect(media).toContain(h);
    for (const h of air) expect(connect).toContain(h);
    // mp3 streams play through <audio> only; nothing fetches them.
    expect(connect).not.toContain("https://stream.radioparadise.com");
    expect(connect).not.toContain("https://icecast.radiofrance.fr");
    // Exact hosts, never a CloudFront wildcard.
    expect([...media, ...connect].some((h) => h.includes("*.cloudfront.net"))).toBe(false);
  });

  it("gives the worker every host it caches", () => {
    const worker = buildWorkerCsp();
    for (const h of ["https://res.cloudinary.com", "https://*.giphy.com", "https://i.ytimg.com", "https://tile.openstreetmap.org"]) expect(directive(worker, "connect-src")).toContain(h);
  });
});
