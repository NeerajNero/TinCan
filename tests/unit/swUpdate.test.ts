import { describe, expect, it, vi } from "vitest";

import { createUpdateController, UPDATE_CHECK_MIN_MS, type ContainerLike, type RegistrationLike, type WorkerLike } from "@/lib/swUpdate";

class Emitter {
  private listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, l: () => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(l));
  }
  removeEventListener(type: string, l: () => void) {
    this.listeners.get(type)?.delete(l);
  }
  fire(type: string) {
    for (const l of this.listeners.get(type) ?? []) l();
  }
}
class FakeWorker extends Emitter implements WorkerLike {
  messages: unknown[] = [];
  constructor(public state: string) {
    super();
  }
  postMessage(m: unknown) {
    this.messages.push(m);
  }
  become(state: string) {
    this.state = state;
    this.fire("statechange");
  }
}
class FakeRegistration extends Emitter implements RegistrationLike {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = new FakeWorker("activated");
  updates = 0;
  update = vi.fn(async () => {
    this.updates += 1;
  });
  /** The browser found a new worker: installing → installed (waiting). */
  arrive(): FakeWorker {
    const w = new FakeWorker("installing");
    this.installing = w;
    this.fire("updatefound");
    return w;
  }
  settle(w: FakeWorker) {
    this.installing = null;
    this.waiting = w;
    w.become("installed");
  }
}
class FakeContainer extends Emitter implements ContainerLike {
  controller: unknown = {};
  constructor(public reg: FakeRegistration | undefined) {
    super();
  }
  getRegistration = async () => this.reg;
}

function setup(reg = new FakeRegistration(), t = 0) {
  const container = new FakeContainer(reg);
  const reload = vi.fn();
  let now = t;
  const ctl = createUpdateController({ container, reload, now: () => now });
  const states: boolean[] = [];
  ctl.subscribe((s) => states.push(s.waiting));
  return { ctl, container, reg, reload, states, tick: (ms: number) => (now += ms) };
}

describe("app update controller", () => {
  it("offers a worker that was already waiting when the app launched (no event ever fires for it)", async () => {
    const reg = new FakeRegistration();
    reg.waiting = new FakeWorker("installed");
    const { ctl, states } = setup(reg);
    expect(await ctl.check()).toBe("waiting");
    expect(states).toContain(true);
    expect(ctl.state().waiting).toBe(true);
  });

  it("checks on launch, then at most once an hour, and forces on demand", async () => {
    const { ctl, reg, tick } = setup();
    expect(await ctl.check()).toBe("none");
    expect(reg.updates).toBe(1);
    tick(UPDATE_CHECK_MIN_MS - 1);
    await ctl.check();
    expect(reg.updates).toBe(1);
    await ctl.check({ force: true });
    expect(reg.updates).toBe(2);
    tick(UPDATE_CHECK_MIN_MS);
    await ctl.check();
    expect(reg.updates).toBe(3);
  });

  it("notices a worker that installs after the check (updatefound → installed)", async () => {
    const { ctl, reg, states } = setup();
    await ctl.check();
    expect(states.at(-1)).toBe(false);
    const w = reg.arrive();
    expect(ctl.state().waiting).toBe(false); // still installing
    reg.settle(w);
    expect(ctl.state().waiting).toBe(true);
    expect(states.at(-1)).toBe(true);
  });

  it("sees a worker that finished installing during the check", async () => {
    const reg = new FakeRegistration();
    reg.update = vi.fn(async () => {
      reg.waiting = new FakeWorker("installed");
    });
    const { ctl } = setup(reg);
    expect(await ctl.check()).toBe("waiting");
  });

  it("Reload posts SKIP_WAITING and reloads exactly once when the new worker takes control", async () => {
    const reg = new FakeRegistration();
    const w = new FakeWorker("installed");
    reg.waiting = w;
    const { ctl, container, reload } = setup(reg);
    await ctl.check();
    expect(ctl.apply()).toBe(true);
    expect(w.messages).toEqual([{ type: "SKIP_WAITING" }]);
    container.fire("controllerchange");
    container.fire("controllerchange");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads on a controller change it didn't ask for (first install, a claim)", async () => {
    const { ctl, container, reload } = setup();
    await ctl.check();
    container.fire("controllerchange");
    expect(reload).not.toHaveBeenCalled();
    expect(ctl.apply()).toBe(false);
  });

  it("reports unavailable without a service worker container or registration", async () => {
    const none = createUpdateController({ container: null, reload: vi.fn() });
    expect(await none.check()).toBe("unavailable");
    const unregistered = createUpdateController({ container: new FakeContainer(undefined), reload: vi.fn() });
    expect(await unregistered.check()).toBe("unavailable");
  });

  it("marks checking while update() runs so a second tap is disabled", async () => {
    const reg = new FakeRegistration();
    let release: () => void = () => undefined;
    reg.update = vi.fn(() => new Promise<void>((res) => (release = res)));
    const { ctl } = setup(reg);
    const seen: boolean[] = [];
    ctl.subscribe((s) => seen.push(s.checking));
    const p = ctl.check();
    await new Promise((r) => setTimeout(r, 0));
    expect(ctl.state().checking).toBe(true);
    release();
    await p;
    expect(ctl.state().checking).toBe(false);
    expect(seen).toEqual([true, false]);
  });
});
