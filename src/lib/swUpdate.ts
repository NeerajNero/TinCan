/**
 * App updates, end to end. A new deploy installs a new service worker that
 * then *waits* (the worker no longer skips waiting on its own): nothing takes
 * over mid-session until the user taps Reload. This controller owns that:
 *
 * - `check()` asks the browser for a new worker (`registration.update()`),
 *   throttled to once an hour unless forced (launch runs it at once);
 * - a waiting worker is detected whether it was already waiting when the app
 *   launched (`registration.waiting` on mount, which fires no event), is
 *   installing now (`updatefound` → `statechange` to "installed"), or appears
 *   after a check; subscribers hear about it every time;
 * - `apply()` posts SKIP_WAITING to the waiting worker and reloads once when
 *   it takes control (`controllerchange`); any other controller change
 *   (first install) never reloads.
 *
 * The browser pieces are injected so the whole flow is unit-tested with fakes.
 */

export const UPDATE_CHECK_MIN_MS = 60 * 60_000;

interface Listenable {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}
export interface WorkerLike extends Listenable {
  state: string;
  postMessage(message: unknown): void;
}
export interface RegistrationLike extends Listenable {
  installing: WorkerLike | null;
  waiting: WorkerLike | null;
  active: WorkerLike | null;
  update(): Promise<unknown>;
}
export interface ContainerLike extends Listenable {
  controller: unknown;
  getRegistration(scope: string): Promise<RegistrationLike | undefined>;
}

export type CheckResult = "waiting" | "none" | "unavailable";
interface UpdateState {
  waiting: boolean;
  checking: boolean;
}

export interface UpdateController {
  /** Look for a new worker. `force` ignores the hourly throttle (More → Check for updates). */
  check(opts?: { force?: boolean }): Promise<CheckResult>;
  /** Fires after every check and on every state change, with the current state. */
  subscribe(listener: (state: UpdateState) => void): () => void;
  state(): UpdateState;
  /** Activate the waiting worker and reload once it controls the page. */
  apply(): boolean;
  dispose(): void;
}

interface Deps {
  /** `navigator.serviceWorker`, or null when unsupported / disabled (dev). */
  container: ContainerLike | null;
  reload: () => void;
  now?: () => number;
  scope?: string;
}

export function createUpdateController({ container, reload, now = Date.now, scope = "/" }: Deps): UpdateController {
  const listeners = new Set<(state: UpdateState) => void>();
  let waiting = false;
  let checking = false;
  let lastCheck: number | null = null;
  let applied = false;
  let reloaded = false;
  let registration: Promise<RegistrationLike | undefined> | null = null;
  let watched: RegistrationLike | null = null;
  const cleanups: Array<() => void> = [];

  const emit = () => {
    const s = { waiting, checking };
    for (const l of listeners) l(s);
  };
  const setWaiting = (next: boolean) => {
    if (waiting === next) return;
    waiting = next;
    emit();
  };

  /** A worker that reached "installed" while another one is active is an update waiting. */
  const track = (reg: RegistrationLike, worker: WorkerLike | null) => {
    if (!worker) return;
    const onState = () => {
      if (worker.state === "installed" && reg.waiting === worker) setWaiting(true);
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", onState);
        if (reg.waiting === null) setWaiting(false);
      }
    };
    worker.addEventListener("statechange", onState);
    cleanups.push(() => worker.removeEventListener("statechange", onState));
    onState();
  };

  const watch = (reg: RegistrationLike) => {
    if (watched === reg) return;
    watched = reg;
    if (reg.waiting) setWaiting(true); // already waiting when the app launched: no event will ever say so
    track(reg, reg.installing);
    const onUpdateFound = () => track(reg, reg.installing);
    reg.addEventListener("updatefound", onUpdateFound);
    cleanups.push(() => reg.removeEventListener("updatefound", onUpdateFound));
  };

  const getRegistration = () => {
    if (!container) return Promise.resolve(undefined);
    registration ??= container.getRegistration(scope).catch(() => undefined);
    return registration;
  };

  if (container) {
    const onControllerChange = () => {
      if (!applied || reloaded) return;
      reloaded = true;
      reload();
    };
    container.addEventListener("controllerchange", onControllerChange);
    cleanups.push(() => container.removeEventListener("controllerchange", onControllerChange));
  }

  return {
    async check({ force = false } = {}) {
      const reg = await getRegistration();
      if (!reg) return "unavailable";
      watch(reg);
      const due = force || lastCheck === null || now() - lastCheck >= UPDATE_CHECK_MIN_MS;
      if (due && !checking) {
        checking = true;
        lastCheck = now();
        emit();
        try {
          await reg.update();
        } catch {
          // offline or the worker URL failed: nothing new to report
        }
        checking = false;
        if (reg.waiting) waiting = true;
      }
      emit();
      return waiting ? "waiting" : "none";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    state: () => ({ waiting, checking }),
    apply() {
      const worker = watched?.waiting ?? null;
      if (!worker) return false;
      applied = true;
      worker.postMessage({ type: "SKIP_WAITING" });
      return true;
    },
    dispose() {
      for (const c of cleanups.splice(0)) c();
      listeners.clear();
      watched = null;
    },
  };
}

let shared: UpdateController | null = null;

/** The app-wide controller (null container under `next dev` or without service workers). */
export function getUpdateController(): UpdateController {
  shared ??= createUpdateController({
    container: typeof navigator !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV !== "development" ? (navigator.serviceWorker as unknown as ContainerLike) : null,
    reload: () => window.location.reload(),
  });
  return shared;
}

/** This page's build id, as baked in by `next.config.ts`. */
export const APP_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Ask a worker which build it came from (the worker answers VERSION messages). */
export function workerBuild(worker: ServiceWorker | null | undefined, timeoutMs = 1500): Promise<string> {
  if (!worker) return Promise.resolve("—");
  return new Promise<string>((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve("no answer (older worker?)"), timeoutMs);
    ch.port1.onmessage = (e) => {
      clearTimeout(t);
      resolve(String((e.data as { build?: string }).build ?? "?"));
    };
    try {
      worker.postMessage({ type: "VERSION" }, [ch.port2]);
    } catch {
      clearTimeout(t);
      resolve("unreachable");
    }
  });
}
