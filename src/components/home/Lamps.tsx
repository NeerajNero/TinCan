"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { notify } from "@/lib/notify";
import { lampPath, lightLamp } from "@/lib/rtdb";
import { LAMP_COLORS, type LampNode } from "@/lib/types";

const COLOR_KEY = "tincan-lamp-color";
const LONG_PRESS_MS = 450;

function readColor(): string {
  try {
    const v = localStorage.getItem(COLOR_KEY);
    return LAMP_COLORS.some((c) => c.hex === v) ? (v as string) : LAMP_COLORS[0].hex;
  } catch {
    return LAMP_COLORS[0].hex;
  }
}

function isLit(lamp: LampNode | null, now: Date): lamp is LampNode {
  return Boolean(lamp && lamp.on && lamp.until > now.getTime());
}

/** Two friendship lamps. Tap mine → theirs glows for 10 min; long-press mine to pick a colour. */
export function Lamps({ friendUid, friendName }: { friendUid: string; friendName: string }) {
  const { uid, me } = usePair();
  const now = useNow(1000);
  const { value: myLamp } = useRtdbValue<LampNode>(lampPath(uid));
  const { value: friendLamp } = useRtdbValue<LampNode>(lampPath(friendUid));
  const [color, setColor] = useState(readColor);
  const [picking, setPicking] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  async function light(hex: string) {
    try {
      await lightLamp(friendUid, hex);
      await notify("lamp", { toUid: friendUid, title: me.nickname, body: `💡 ${me.nickname} lit your lamp` });
    } catch {
      // The lamp just stays dark; nothing to recover.
    }
  }

  function pickColor(hex: string) {
    setColor(hex);
    try {
      localStorage.setItem(COLOR_KEY, hex);
    } catch {
      // fine
    }
    setPicking(false);
    void light(hex);
  }

  function onPressStart() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setPicking(true);
      try {
        navigator.vibrate?.(20);
      } catch {
        // no haptics
      }
    }, LONG_PRESS_MS);
  }
  function onPressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  function onClick() {
    if (longPressed.current) return;
    void light(color);
  }

  const mineLit = isLit(myLamp, now);
  const theirsLit = isLit(friendLamp, now);

  return (
    <Card className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Lamp
          label="Your lamp"
          hint={mineLit ? `${friendName} lit it` : "Tap to light theirs"}
          lit={mineLit}
          color={mineLit ? myLamp.color : color}
          interactive
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerLeave={onPressEnd}
          onPointerCancel={onPressEnd}
          onClick={onClick}
          onContextMenu={(e) => e.preventDefault()}
        />
        <Lamp
          label={`${friendName}'s lamp`}
          hint={theirsLit ? "Glowing for them" : "Dark right now"}
          lit={theirsLit}
          color={theirsLit ? friendLamp.color : color}
        />
      </div>

      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            key="picker"
            role="radiogroup"
            aria-label="Lamp colour"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 pt-1">
              {LAMP_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={color === c.hex}
                  aria-label={c.label}
                  onClick={() => pickColor(c.hex)}
                  className={cn(
                    "tap grid place-items-center rounded-full transition-transform",
                    color === c.hex && "scale-110",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("block size-8 rounded-full border-2", color === c.hex ? "border-text" : "border-transparent")}
                    style={{ background: c.hex }}
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="px-1 text-center text-xs text-muted">Hold your lamp to choose a colour.</p>
    </Card>
  );
}

interface LampFaceProps {
  label: string;
  hint: string;
  lit: boolean;
  color: string;
}

function LampFace({ label, hint, lit, color }: LampFaceProps) {
  return (
    <>
      <motion.div
        aria-hidden
        className="grid size-20 place-items-center rounded-full border-4"
        animate={{
          background: lit ? color : "var(--surface)",
          borderColor: lit ? color : "var(--border)",
          boxShadow: lit ? `0 0 36px 10px ${color}66, 0 0 90px 20px ${color}33` : "0 0 0 0 transparent",
        }}
        transition={{ duration: 0.5 }}
      >
        <span className="text-3xl">{lit ? "💡" : "🔅"}</span>
      </motion.div>
      <span className="text-sm font-bold">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </>
  );
}

const LAMP_CLASS = "flex flex-col items-center gap-2 rounded-[24px] bg-surface-2 px-2 py-4 select-none";

interface LampProps extends LampFaceProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  interactive?: boolean;
}

function Lamp({ label, hint, lit, color, interactive, className, ...props }: LampProps) {
  if (!interactive) {
    return (
      <div className={cn(LAMP_CLASS, className)}>
        <LampFace label={label} hint={hint} lit={lit} color={color} />
      </div>
    );
  }
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      aria-label={`${label}: ${hint}`}
      className={cn(LAMP_CLASS, "tap cursor-pointer touch-none", className)}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      <LampFace label={label} hint={hint} lit={lit} color={color} />
    </motion.button>
  );
}
