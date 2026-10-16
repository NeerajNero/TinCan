import { describe, expect, it } from "vitest";

import { buildCsp, buildWorkerCsp, FIRESTORE_PROBE_IMG } from "../../csp";

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

  it("keeps scripts strict", () => {
    expect(directive(csp, "script-src")).toContain("'nonce-abc'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
  });

  it("gives the worker every host it caches", () => {
    const worker = buildWorkerCsp();
    for (const h of ["https://res.cloudinary.com", "https://*.giphy.com", "https://i.ytimg.com", "https://tile.openstreetmap.org"]) expect(directive(worker, "connect-src")).toContain(h);
  });
});
