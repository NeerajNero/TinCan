/**
 * A tiny in-memory log for More → Diagnostics: the last 20 console errors,
 * Firebase warnings, uncaught errors, unhandled rejections, CSP
 * violations and YouTube player errors on this device. Nothing leaves the phone unless you press
 * "Copy diagnostics". Installed once, as early as possible (Providers).
 */
export interface DiagEntry {
  at: number;
  kind: "error" | "warn" | "uncaught" | "rejection" | "csp" | "player";
  text: string;
}

const MAX = 20;
const entries: DiagEntry[] = [];
let installed = false;

function stringify(parts: unknown[]): string {
  return parts
    .map((p) => (p instanceof Error ? `${p.name}: ${p.message}` : typeof p === "string" ? p : (() => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    })()))
    .join(" ")
    .slice(0, 400);
}

function push(kind: DiagEntry["kind"], text: string) {
  entries.push({ at: Date.now(), kind, text });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
}

export function installDiagLog(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    push("error", stringify(args));
    origError(...args);
  };
  // Warnings are noisy; keep only Firebase's (connection and permission problems surface there).
  console.warn = (...args: unknown[]) => {
    const text = stringify(args);
    if (/firebase|firestore|database/i.test(text)) push("warn", text);
    origWarn(...args);
  };
  window.addEventListener("error", (e) => push("uncaught", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => push("rejection", stringify([e.reason])));
  document.addEventListener("securitypolicyviolation", (e) => push("csp", `${e.effectiveDirective} blocked ${e.blockedURI || "(inline)"}`));
}

/** Record a line directly (e.g. YouTube player error codes), without going through the console. */
export function noteDiag(kind: DiagEntry["kind"], text: string): void {
  push(kind, text.slice(0, 400));
}

export const diagEntries = (): readonly DiagEntry[] => entries.slice();
