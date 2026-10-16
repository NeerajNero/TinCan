"use client";

import { useAnimationControls, useReducedMotion, type Transition } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { useToast, type ToastInput } from "@/components/toast/ToastProvider";
import { PET_PARTS, type PartControls, type PetPart } from "@/content/pets";
import type { IncomingPing } from "@/hooks/useIncomingPings";
import { usePair } from "@/hooks/usePair";
import { useVisible } from "@/hooks/useVisible";
import { consumeMyPetWrite, feedPet, pettedPet, tuckInPet, wakePet } from "@/lib/db/pet";
import { petStats } from "@/lib/pet";
import { between, capParticles, EXCITED_MS, heldHappiness, pickReaction, tapBurst, petEvents, type Reaction } from "@/lib/petLife";
import { playSound } from "@/lib/sounds";
import { swallow } from "@/lib/swallow";
import type { PetDoc, PetMood } from "@/lib/types";

type Controls = ReturnType<typeof useAnimationControls>;
type Stats = ReturnType<typeof petStats>;
export type PetSequence = "feed" | "sleep" | "wake" | "levelUp";

export interface PetParticle {
  id: number;
  emoji: string;
  /** Start offset from the stage centre and travel, in px. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  /** Font-size multiplier (crumbs are tiny). */
  scale: number;
}

const REST = { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1 };
const HOLD_MS = 400;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const t = (duration: number, extra: Transition = {}): Transition => ({ duration, ease: "easeInOut", ...extra });

interface Options {
  pet: PetDoc | null;
  stats: Stats | null;
  level: number;
  /** Home widget: same motion, smaller, no particles. */
  compact?: boolean;
  /** Stage size in px; whole-body moves scale with it. */
  size: number;
  /** Called on every real tap (not the click that ends a long-press), e.g. the Play mini-game counter. */
  onTap?: () => void;
}

/** What the motion needs from the app: who's who, the writes, and the live signals. Swappable for the e2e harness. */
export interface PetEnv {
  friendName: string;
  ping: IncomingPing | null;
  toast: (t: ToastInput) => void;
  /** The four writes; each is called once, at its point in the sequence. */
  write: { feed: (pet: PetDoc) => void; tuckIn: () => void; wake: () => void; petted: (happiness: number) => void };
  /** True (once) when this device wrote that pet value itself. */
  isMine: (key: string) => boolean;
}

/** The app's env: Firestore writes, the pair, the toast stack and incoming pings. */
export function usePetLife(opts: Options) {
  const { uid, me, friend } = usePair();
  const { toast } = useToast();
  const { ping } = useLiveEvents();
  const write = useMemo<PetEnv["write"]>(
    () => ({
      feed: (pet) => void feedPet(pet, uid, me.nickname).catch(swallow),
      tuckIn: () => void tuckInPet().catch(swallow),
      wake: () => void wakePet().catch(swallow),
      petted: (v) => void pettedPet(v).catch(swallow),
    }),
    [uid, me.nickname],
  );
  return usePetMotion(opts, { friendName: friend?.nickname ?? "Your friend", ping, toast, write, isMine: consumeMyPetWrite });
}

/**
 * Everything that makes the pet feel alive, for one mounted stage: idle
 * loops, tap reactions, the excited burst, long-press petting, the feed /
 * sleep / wake / level-up sequences (writes land at the end, or at the chomp
 * for feed), the friend's actions replayed with a toast, and hug pings.
 * Motion only; stats still come from `lib/pet`.
 */
export function usePetMotion({ pet, stats, level, compact = false, size, onTap }: Options, { friendName, ping, toast, write: writeNow, isMine }: PetEnv) {
  // Writes go through a ref so a cut-short sequence (or unmount) uses the latest env without re-arming effects.
  const writes = useRef(writeNow);
  useEffect(() => {
    writes.current = writeNow;
  }, [writeNow]);
  const visible = useVisible();
  const reduced = useReducedMotion() ?? false;
  const k = size / 180;

  /* ── controls: the HTML actor, the food prop and each named sprite part ── */
  const actor = useAnimationControls();
  const food = useAnimationControls();
  const breath = useAnimationControls();
  const body = useAnimationControls();
  const eyes = useAnimationControls();
  const eyeL = useAnimationControls();
  const eyeR = useAnimationControls();
  const mouth = useAnimationControls();
  const cheeks = useAnimationControls();
  const accessory = useAnimationControls();
  const parts = useMemo<PartControls>(() => ({ breath, body, eyes, eyeL, eyeR, mouth, cheeks, accessory }), [breath, body, eyes, eyeL, eyeR, mouth, cheeks, accessory]);

  /* ── display overrides while a sequence runs ── */
  const [seq, setSeq] = useState<PetSequence | null>(null);
  const [moodOverride, setMoodOverride] = useState<PetMood | null>(null);
  const [dimOverride, setDimOverride] = useState<boolean | null>(null);
  const [frozen, setFrozen] = useState<{ hunger?: number; happiness?: number } | null>(null);
  const [petJoy, setPetJoy] = useState<number | null>(null);
  const [particles, setParticles] = useState<PetParticle[]>([]);
  const [confetti, setConfetti] = useState(0);
  const [levelShown, setLevelShown] = useState(level);

  const token = useRef(0);
  const busy = useRef(false); // a sequence, petting or the excited burst owns the parts
  const pendingCommit = useRef<(() => void) | null>(null);
  const lastReaction = useRef<Reaction | null>(null);
  const taps = useRef<number[]>([]);
  const excitedUntil = useRef(0);
  const particleId = useRef(0);
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mood: PetMood = moodOverride ?? stats?.mood ?? "happy";
  const sleepingNow = mood === "sleeping";
  const live = Boolean(pet && stats);

  const all = useCallback((fn: (c: Controls, name: PetPart | "actor") => void) => {
    fn(actor, "actor");
    for (const p of PET_PARTS) fn(parts[p], p);
  }, [actor, parts]);
  const stopAll = useCallback(() => all((c) => c.stop()), [all]);
  const restAll = useCallback((duration = 0.25) => all((c) => void c.start({ ...REST, transition: t(duration) }).catch(swallow)), [all]);

  /** Particles float up from the head; `crumbs` fall from the mouth instead. */
  const spawn = useCallback(
    (emoji: string | string[], n: number, spread = 1, crumbs = false) => {
      if (compact || reduced) return;
      const list = Array.isArray(emoji) ? emoji : [emoji];
      const added: PetParticle[] = Array.from({ length: n }, (_, i) => {
        const a = crumbs ? between(Math.PI * 0.25, Math.PI * 0.75) : between(-Math.PI * 0.9, -Math.PI * 0.1);
        const r = between(50, 90) * k * spread;
        const at = crumbs ? { x: between(0, 16) * k, y: 18 * k } : { x: between(-30, 30) * k, y: between(-50, -10) * k };
        return { id: ++particleId.current, emoji: list[i % list.length] ?? "✨", ...at, dx: Math.cos(a) * r, dy: Math.sin(a) * r, delay: i * 0.04, scale: crumbs ? 0.4 : 1 };
      });
      setParticles((alive) => capParticles(alive, added));
    },
    [compact, reduced, k],
  );
  const dropParticle = useCallback((id: number) => setParticles((alive) => alive.filter((p) => p.id !== id)), []);

  /* ── sequences ─────────────────────────────────────────────────────── */
  const flushCommit = useCallback(() => {
    const c = pendingCommit.current;
    pendingCommit.current = null;
    c?.();
  }, []);

  /** Starts a sequence: any running one is cut short (its write still happens). */
  const begin = useCallback(
    (kind: PetSequence, commit: (() => void) | null) => {
      flushCommit();
      if (overrideTimer.current) clearTimeout(overrideTimer.current);
      pendingCommit.current = commit;
      busy.current = true;
      setSeq(kind);
      stopAll();
      return ++token.current;
    },
    [flushCommit, stopAll],
  );
  const alive = useCallback((tok: number) => token.current === tok, []);
  const finish = useCallback(
    (tok: number, after: PetMood | null) => {
      if (!alive(tok)) return;
      flushCommit();
      busy.current = false;
      setSeq(null);
      setFrozen(null);
      setDimOverride(null);
      restAll(0.4);
      // Hold the end mood a beat so the snapshot can catch up without a flicker.
      setMoodOverride(after);
      overrideTimer.current = setTimeout(() => setMoodOverride(null), 1000);
    },
    [alive, flushCommit, restAll],
  );

  const feedSeq = useCallback(
    async (own: boolean, before: Stats) => {
      if (!pet) return;
      const commit = own ? () => writes.current.feed(pet) : null;
      if (reduced) {
        commit?.();
        return;
      }
      const tok = begin("feed", commit);
      if (!own) setFrozen({ hunger: before.hunger });
      setMoodOverride(before.mood);
      void food.start({ x: [70 * k, 24 * k], y: [-40 * k, 12 * k], opacity: [0, 1], scale: [0.6, 1], rotate: [-30, 0], transition: t(0.5, { ease: "easeOut" }) });
      void actor.start({ rotate: [0, 7], x: [0, 6 * k], transition: t(0.35, { delay: 0.25 }) });
      await wait(600);
      if (!alive(tok)) return;
      playSound("petFeed");
      for (let i = 0; i < 3; i++) {
        void mouth.start({ scaleY: [1, 1.9, 0.6, 1], scaleX: [1, 1.2, 1, 1], transition: t(0.22) });
        void food.start({ scale: 1 - (i + 1) * 0.28, transition: t(0.15) });
        spawn("🍪", 3, 0.6, true);
        await wait(230);
        if (!alive(tok)) return;
      }
      void food.start({ opacity: 0, transition: t(0.1) });
      // The bar animates to full over the closing beat.
      flushCommit();
      setFrozen(null);
      setMoodOverride(null);
      void actor.start({ rotate: [7, -6, 5, -3, 0], x: [6 * k, 0], transition: t(0.6) });
      void eyes.start({ scaleY: [1, 0.35, 0.35, 1], transition: t(0.6) });
      spawn("💗", 1);
      await wait(700);
      finish(tok, null);
    },
    [pet, reduced, begin, food, actor, mouth, eyes, k, alive, spawn, flushCommit, finish],
  );

  const sleepSeq = useCallback(
    async (own: boolean, before: PetMood) => {
      const commit = own ? () => writes.current.tuckIn() : null;
      if (own) playSound("petSleep");
      if (reduced) {
        commit?.();
        return;
      }
      const tok = begin("sleep", commit);
      setMoodOverride(before);
      setDimOverride(false);
      void mouth.start({ scale: [1, 1.9, 1.9, 1], transition: t(0.6) });
      void eyes.start({ scaleY: [1, 0.5, 0.5], transition: t(0.6) });
      void actor.start({ scaleY: [1, 1.06, 1], transition: t(0.6) });
      await wait(600);
      if (!alive(tok)) return;
      void eyes.start({ scaleY: [0.5, 0.1], transition: t(0.35) });
      await wait(300);
      if (!alive(tok)) return;
      void actor.start({ y: [0, 6 * k], scaleY: [1, 0.94], transition: t(0.55, { ease: "easeOut" }) });
      await wait(600);
      finish(tok, "sleeping");
    },
    [reduced, begin, mouth, eyes, actor, k, alive, finish],
  );

  const wakeSeq = useCallback(
    async (own: boolean, after: PetMood) => {
      const commit = own ? () => writes.current.wake() : null;
      if (own) playSound("petWake");
      if (reduced) {
        commit?.();
        return;
      }
      const tok = begin("wake", commit);
      setMoodOverride("sleeping");
      setDimOverride(true);
      void actor.start({ scaleY: [1, 1.12, 1], scaleX: [1, 0.94, 1], transition: t(0.5) });
      await wait(450);
      if (!alive(tok)) return;
      setMoodOverride(after);
      void eyes.start({ scaleY: [0.1, 1, 0.1, 1], transition: t(0.4) });
      await wait(450);
      if (!alive(tok)) return;
      void actor.start({ x: [0, -5 * k, 5 * k, -4 * k, 4 * k, 0], transition: t(0.4) });
      await wait(300);
      if (!alive(tok)) return;
      spawn(["✨", "⭐"], 6);
      await wait(300);
      finish(tok, after);
    },
    [reduced, begin, actor, eyes, k, alive, spawn, finish],
  );

  const levelSeq = useCallback(
    async (from: number, to: number) => {
      const count = () => {
        let n = from;
        const id = setInterval(() => {
          n += 1;
          setLevelShown(Math.min(n, to));
          if (n >= to) clearInterval(id);
        }, 220);
      };
      if (reduced) {
        setLevelShown(to);
        return;
      }
      const tok = begin("levelUp", null);
      playSound("win");
      if (!compact) setConfetti((c) => c + 1);
      accessory.set({ scale: 0 });
      void actor.start({ rotate: [0, 360], scale: [1, 1.15, 1], transition: t(0.7) });
      count();
      await wait(450);
      if (!alive(tok)) return;
      void accessory.start({ scale: [0, 1.35, 0.9, 1], transition: t(0.55, { ease: "easeOut" }) });
      spawn(["✨", "⭐", "🎉"], 8, 1.3);
      await wait(700);
      if (alive(tok)) actor.set({ rotate: 0 });
      finish(tok, null);
    },
    [reduced, compact, begin, accessory, actor, alive, spawn, finish],
  );

  /* ── tap reactions ─────────────────────────────────────────────────── */
  const reactions = useMemo<Record<Reaction, () => void>>(
    () => ({
      bounce: () => void actor.start({ y: [0, -24 * k, 0, -8 * k, 0], scaleY: [1, 0.9, 1.05, 0.98, 1], transition: t(0.55) }),
      wiggle: () => void actor.start({ rotate: [0, -10, 10, -7, 7, 0], transition: t(0.5) }),
      spin: () => void actor.start({ rotate: [0, 360], transition: t(0.6) }).then(() => actor.set({ rotate: 0 })),
      hop: () => {
        void actor.start({ y: [0, -30 * k, 0], scaleX: [1, 0.92, 1.06, 1], transition: t(0.5) });
        spawn(["✨", "⭐"], 4);
      },
      wink: () => {
        void eyeR.start({ scaleY: [1, 0.1, 0.1, 1], transition: t(0.45) });
        void mouth.start({ scale: [1, 1.15, 1], transition: t(0.45) });
        void actor.start({ rotate: [0, -5, 0], transition: t(0.45) });
      },
      blush: () => {
        void cheeks.start({ scale: [1, 1.7, 1.7, 1], transition: t(0.65) });
        void eyes.start({ scaleY: [1, 0.4, 0.4, 1], transition: t(0.65) });
        void actor.start({ scale: [1, 0.96, 1], transition: t(0.65) });
      },
      tilt: () => {
        void actor.start({ rotate: [0, 14, 14, 0], transition: t(0.6) });
        void eyes.start({ x: [0, 2, 2, 0], transition: t(0.6) });
      },
      squish: () => void actor.start({ scaleX: [1, 1.2, 0.92, 1.04, 1], scaleY: [1, 0.8, 1.08, 0.98, 1], transition: t(0.5) }),
      heartHop: () => {
        void actor.start({ y: [0, -26 * k, 0], transition: t(0.55, { ease: "easeOut" }) });
        spawn("💗", 3);
      },
      giggle: () => {
        void actor.start({ x: [0, -4 * k, 4 * k, -4 * k, 4 * k, -2 * k, 0], transition: t(0.5) });
        void mouth.start({ scaleY: [1, 1.3, 0.9, 1.3, 1], transition: t(0.5) });
        void eyes.start({ scaleY: [1, 0.5, 0.5, 1], transition: t(0.5) });
      },
    }),
    [actor, eyes, eyeR, mouth, cheeks, k, spawn],
  );

  const react = useCallback(
    (r: Reaction) => {
      if (reduced || busy.current) return;
      lastReaction.current = r;
      reactions[r]();
    },
    [reduced, reactions],
  );

  const excite = useCallback(async () => {
    excitedUntil.current = Date.now() + EXCITED_MS;
    busy.current = true;
    const tok = ++token.current;
    spawn(["✨", "⭐", "💫"], 12, 1.4);
    void eyes.start({ scale: [1, 1.25], transition: t(0.2) });
    void actor.start({ y: [0, -18 * k, 0], rotate: [0, -6, 6, 0], transition: t(0.5, { repeat: 5 }) });
    await wait(EXCITED_MS);
    if (!alive(tok)) return;
    busy.current = false;
    restAll(0.3);
  }, [spawn, eyes, actor, k, alive, restAll]);

  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const tap = useCallback(() => {
    if (!live || seq) return;
    onTapRef.current?.();
    playSound("petTap");
    try {
      navigator.vibrate?.(10);
    } catch {
      // no haptics
    }
    if (reduced) return;
    if (sleepingNow) {
      void actor.start({ scaleX: [1, 1.06, 1], scaleY: [1, 0.95, 1], transition: t(0.5) });
      return;
    }
    const now = Date.now();
    if (now < excitedUntil.current) {
      spawn("✨", 2);
      return;
    }
    const burst = tapBurst(taps.current, now);
    taps.current = burst.excited ? [] : burst.taps;
    if (burst.excited) {
      void excite();
      return;
    }
    react(pickReaction(lastReaction.current));
  }, [live, seq, reduced, sleepingNow, actor, spawn, excite, react]);

  /* ── long-press petting ────────────────────────────────────────────── */
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; tick: ReturnType<typeof setInterval> | null; start: number; from: number; value: number; active: boolean; suppressClick: boolean }>({
    timer: null,
    tick: null,
    start: 0,
    from: 0,
    value: 0,
    active: false,
    suppressClick: false,
  });

  const startPetting = useCallback(() => {
    if (!stats) return;
    const h = hold.current;
    h.active = true;
    h.suppressClick = true;
    h.start = Date.now();
    h.from = stats.happiness;
    h.value = stats.happiness;
    busy.current = true;
    ++token.current;
    stopAll();
    if (!reduced) {
      void actor.start({ rotate: [-4, 4], transition: t(0.45, { repeat: Infinity, repeatType: "mirror" }) });
      void eyes.start({ scaleY: 0.35, transition: t(0.2) });
      void cheeks.start({ scale: 1.4, transition: t(0.3) });
    }
    let n = 0;
    h.tick = setInterval(() => {
      h.value = heldHappiness(h.from, Date.now() - h.start);
      setPetJoy(h.value);
      if (++n % 5 === 0) spawn("💗", 1, 0.8);
    }, 100);
  }, [stats, reduced, stopAll, actor, eyes, cheeks, spawn]);

  const release = useCallback(() => {
    const h = hold.current;
    if (h.timer) clearTimeout(h.timer);
    h.timer = null;
    if (!h.active) return;
    h.active = false;
    if (h.tick) clearInterval(h.tick);
    h.tick = null;
    busy.current = false;
    restAll(0.3);
    // One write for the whole hold, only if it actually helped.
    if (h.value - h.from >= 1) writes.current.petted(h.value);
    setTimeout(() => setPetJoy(null), 400);
  }, [restAll]);

  const bind = useMemo(
    () => ({
      onPointerDown: () => {
        const h = hold.current;
        h.suppressClick = false;
        if (!live || seq || sleepingNow) return;
        h.timer = setTimeout(startPetting, HOLD_MS);
      },
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onClick: () => {
        if (hold.current.suppressClick) {
          hold.current.suppressClick = false;
          return;
        }
        tap();
      },
    }),
    [live, seq, sleepingNow, startPetting, release, tap],
  );

  /* ── own actions ───────────────────────────────────────────────────── */
  const feed = useCallback(() => {
    if (!seq && stats && !stats.sleeping) void feedSeq(true, stats);
  }, [seq, stats, feedSeq]);
  const tuckIn = useCallback(() => {
    if (!seq && stats && !stats.sleeping) void sleepSeq(true, stats.mood);
  }, [seq, stats, sleepSeq]);
  const wake = useCallback(() => {
    if (!seq && pet && stats?.sleeping) void wakeSeq(true, petStats({ ...pet, sleepAt: 0 }).mood);
  }, [seq, pet, stats, wakeSeq]);

  /* ── idle life: breathing, blinks, glances, fidgets, mood idles ────── */
  useEffect(() => {
    if (!live || reduced || !visible) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const every = (min: number, max: number, fn: () => void) => {
      const loop = () =>
        after(between(min, max), () => {
          if (!busy.current) fn();
          loop();
        });
      loop();
    };
    const breathe = () => {
      const dur = sleepingNow ? 4.5 : mood === "sad" ? 4 : 3;
      if (!busy.current) {
        const extra = mood === "happy" ? { y: [0, -2, 0] } : mood === "sad" ? { y: [0, 2.5, 0], rotate: [0, -2, 0] } : {};
        void breath.start({ scaleY: sleepingNow ? [1, 1.05, 1] : [1, 1.035, 1], ...extra, transition: t(dur) });
      }
      after(dur * 1000, breathe);
    };
    breathe();
    if (!sleepingNow) {
      every(3000, 6000, () => void eyes.start({ scaleY: [1, 0.1, 1], transition: t(0.18) }));
      every(7000, 13000, () => {
        const dx = between(-3, 3);
        void eyes.start({ x: [0, dx, dx, 0], transition: t(1.2) });
      });
      every(15000, 30000, () => {
        const r = pickReaction(lastReaction.current, Math.random);
        reactions[r === "spin" || r === "hop" ? "wiggle" : r]();
      });
      if (mood === "hungry")
        every(5000, 9000, () => {
          void body.start({ x: [0, -1.5, 1.5, -1.5, 1.5, 0], transition: t(0.4) });
          // Feed sits below the pet: right on Home, left on the pet page.
          const gx = compact ? 3 : -3;
          void eyes.start({ x: [0, gx, gx, 0], y: [0, 3, 3, 0], transition: t(1.4, { delay: 0.4 }) });
        });
    }
    return () => {
      timers.forEach(clearTimeout);
      breath.stop();
    };
  }, [live, reduced, visible, sleepingNow, mood, compact, breath, eyes, body, reactions]);

  /* ── the friend's actions, replayed here ───────────────────────────── */
  const prevPet = useRef<PetDoc | null>(null);
  useEffect(() => {
    const prev = prevPet.current;
    prevPet.current = pet;
    if (!prev || !pet) return;
    const events = petEvents(prev, pet, isMine);
    if (!events.length) return;
    const name = friendName;
    const before = petStats(prev);
    for (const e of events) {
      if (e === "feed") void feedSeq(false, before);
      else if (e === "sleep") void sleepSeq(false, before.mood);
      else if (e === "wake") void wakeSeq(false, petStats(pet).mood);
      else react("heartHop");
    }
    if (!visible) return;
    const e = events[0];
    const line = e === "feed" ? `${name} fed ${pet.name} 🍪` : e === "sleep" ? `${name} tucked ${pet.name} in 🌙` : e === "wake" ? `${name} woke ${pet.name} up ☀️` : `${name} played with ${pet.name} 🎾`;
    // Shares the chat toast's key so the "fed" system message collapses into it.
    toast({ key: "message", emoji: "🐾", title: line, url: "/pet", vibrate: false });
    // Only pet changes trigger this; the sequences are stable enough per snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet]);

  /* ── a received hug → heart hop (after Home's full-screen overlay) ── */
  const lastHug = useRef<string | null>(null);
  const hugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ping || ping.kind !== "hug" || lastHug.current === ping.nonce) return;
    lastHug.current = ping.nonce;
    // Not cleared when the ping is dismissed: Home's overlay going away is the cue.
    hugTimer.current = setTimeout(() => react("heartHop"), compact ? 2600 : 300);
  }, [ping, compact, react]);
  useEffect(
    () => () => {
      if (hugTimer.current) clearTimeout(hugTimer.current);
    },
    [],
  );

  /* ── level-ups ─────────────────────────────────────────────────────── */
  const prevLevel = useRef(level);
  useEffect(() => {
    const from = prevLevel.current;
    prevLevel.current = level;
    if (level > from) void levelSeq(from, level);
    else setLevelShown(level);
  }, [level, levelSeq]);

  /* ── unmount: a cut-short sequence still writes ────────────────────── */
  useEffect(
    () => () => {
      ++token.current;
      flushCommit();
      const h = hold.current;
      if (h.timer) clearTimeout(h.timer);
      if (h.tick) clearInterval(h.tick);
      if (h.active && h.value - h.from >= 1) writes.current.petted(h.value);
      h.active = false;
    },
    [flushCommit],
  );

  return {
    actor,
    food,
    parts,
    mood,
    hunger: frozen?.hunger ?? stats?.hunger ?? 0,
    happiness: petJoy ?? frozen?.happiness ?? stats?.happiness ?? 0,
    dimmed: dimOverride ?? mood === "sleeping",
    busy: seq !== null,
    particles,
    dropParticle,
    confetti,
    levelShown,
    reduced,
    bind,
    feed,
    tuckIn,
    wake,
  };
}

export type PetLife = ReturnType<typeof usePetLife>;
