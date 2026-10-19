/**
 * A tiny in-memory log for More → Diagnostics: the last 20 console errors,
 * Firebase warnings, uncaught errors, unhandled rejections, CSP
 * violations, YouTube player errors and rejected Firebase reads/writes on this
 * device. Nothing leaves the phone unless you press "Copy diagnostics".
 * Installed once, as early as possible (Providers).
 */
export interface DiagEntry {
  at: number;
  kind: "error" | "warn" | "uncaught" | "rejection" | "csp" | "player" | "write" | "read";
  text: string;
}

/** A Firestore or RTDB operation the backend refused (rules, offline, bad shape). */
export interface FirebaseFailure {
  kind: "write" | "read";
  /** set, update, remove, push, transaction, setDoc, addDoc, onValue, onSnapshot… */
  op: string;
  /** Document or node path, never a full URL. */
  path: string;
  /** `permission-denied` (Firestore) or `PERMISSION_DENIED` (RTDB), else the error's code or name. */
  code: string;
}

const MAX = 20;
const entries: DiagEntry[] = [];
const failureListeners = new Set<(f: FirebaseFailure) => void>();
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

/** The error code Firebase attached, else the error's name; never the message (it may hold data). */
export function firebaseErrorCode(err: unknown): string {
  const e = err as { code?: unknown; name?: unknown } | null;
  if (e && typeof e.code === "string" && e.code) return e.code.replace(/^(firestore|database)\//, "");
  if (e && typeof e.name === "string" && e.name) return e.name;
  return "unknown";
}

/** True for a rules rejection from either database. */
export const isPermissionDenied = (code: string): boolean => /permission[-_]denied/i.test(code);

/**
 * Record a rejected Firebase operation as a `[write]` / `[read]` line
 * ("update trivia/abc → PERMISSION_DENIED") and tell the dev toast.
 * Called by the SDK wrappers in `lib/firebase/fs.ts` and `lib/firebase/rt.ts`.
 */
export function noteFirebaseFailure(kind: FirebaseFailure["kind"], op: string, path: string, err: unknown): void {
  const failure: FirebaseFailure = { kind, op, path: path.slice(0, 200), code: firebaseErrorCode(err) };
  push(kind, `${op} ${failure.path} → ${failure.code}`);
  failureListeners.forEach((l) => l(failure));
}

/** Development only: `WriteFailureToasts` shows permission-denied as a toast. */
export function subscribeFirebaseFailures(listener: (f: FirebaseFailure) => void): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

export const diagEntries = (): readonly DiagEntry[] => entries.slice();
