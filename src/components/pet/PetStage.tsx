"use client";

import { AnimatePresence, m } from "framer-motion";

import { PetSprite, type PetAccessory } from "@/content/pets";
import type { PetLife } from "@/hooks/usePetLife";
import type { PetDoc } from "@/lib/types";

interface Props {
  life: PetLife;
  pet: PetDoc;
  level: number;
  size: number;
  /** Home widget: no particles. */
  compact?: boolean;
  /** Milestone mode: the day's accessory. */
  accessory?: PetAccessory | null;
}

/**
 * The tappable pet: an HTML "actor" for whole-body moves around the
 * part-animated SVG, the food prop, the sleeping zzz, the sad cloud and (full
 * size only) the particle layer. Tap reacts, hold pets.
 */
export function PetStage({ life, pet, level, size, compact = false, accessory = null }: Props) {
  const k = size / 180;
  return (
    <button
      type="button"
      {...life.bind}
      aria-label={`${pet.name}: tap to play, hold to pet`}
      className="relative grid shrink-0 touch-manipulation select-none place-items-center [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]"
      style={{ width: size, height: size }}
    >
      <m.div animate={life.actor} style={{ originX: 0.5, originY: 1 }} className="pointer-events-none">
        <PetSprite species={pet.species} mood={life.mood} level={level} size={size} parts={life.parts} accessory={accessory} />
      </m.div>

      <m.span aria-hidden animate={life.food} initial={{ opacity: 0 }} className="pointer-events-none absolute top-[56%] left-1/2 -mt-[0.5em] -ml-[0.5em] leading-none" style={{ fontSize: 34 * k }}>
        🍪
      </m.span>

      <AnimatePresence>
        {life.mood === "sleeping" && (
          <m.span key="zzz" aria-hidden className="pointer-events-none absolute top-[8%] right-[12%] font-heading font-bold text-[#b48cff]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 16 * k + 4 }}>
            {life.reduced
              ? "z"
              : [0, 1, 2].map((i) => (
                  <m.span key={i} className="absolute" animate={{ opacity: [0, 1, 0], y: [0, -28 * k], x: [0, 10 * k], scale: [0.6, 1.1] }} transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: "easeOut" }}>
                    z
                  </m.span>
                ))}
          </m.span>
        )}
        {life.mood === "sad" && (
          <m.span
            key="cloud"
            aria-hidden
            className="pointer-events-none absolute top-[2%] left-[18%] leading-none"
            style={{ fontSize: 22 * k + 4 }}
            initial={{ opacity: 0, y: 6 }}
            animate={life.reduced ? { opacity: 0.85, y: 0 } : { opacity: 0.85, y: 0, x: [0, 6 * k, 0] }}
            exit={{ opacity: 0 }}
            transition={{ x: { duration: 5, repeat: Infinity, ease: "easeInOut" }, default: { duration: 0.5 } }}
          >
            🌧️
          </m.span>
        )}
      </AnimatePresence>

      {!compact && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {life.particles.map((p) => (
            <m.span
              key={p.id}
              data-particle
              className="absolute top-1/2 left-1/2 -mt-[0.5em] -ml-[0.5em] leading-none"
              style={{ fontSize: 20 * p.scale }}
              initial={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
              animate={{ x: p.x + p.dx, y: p.y + p.dy, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.8] }}
              transition={{ duration: 0.9, delay: p.delay, ease: "easeOut" }}
              onAnimationComplete={() => life.dropParticle(p.id)}
            >
              {p.emoji}
            </m.span>
          ))}
        </span>
      )}
    </button>
  );
}

/** Night-time veil over a card while the pet sleeps (opacity only). Parent needs `relative`; the veil inherits its radius, so particles aren't clipped. */
export function PetDim({ on }: { on: boolean }) {
  return <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[#141a33]" initial={false} animate={{ opacity: on ? 0.22 : 0 }} transition={{ duration: 0.6 }} />;
}

/** The level number, popping each time it counts up. */
export function LevelBadge({ value, prefix }: { value: number; prefix: string }) {
  return (
    <m.span key={value} className="inline-block" initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
      {prefix} {value}
    </m.span>
  );
}
