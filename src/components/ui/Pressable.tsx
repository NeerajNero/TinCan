"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sounds";

export interface PressableProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  /** Key-click under the Sounds toggle (off by default). */
  click?: boolean;
  /** Scale while held. */
  pressedScale?: number;
}

/**
 * A key or option button with press feedback: the pressed look lands on
 * pointerdown and lifts on pointerup / cancel / leave (a 90 ms spring to 0.94),
 * a 10 ms haptic on press and an optional key-click; `touch-action:
 * manipulation`, no text selection, no long-press callout. A disabled (or
 * used) button gives none of it, so the caller styles that state to read as
 * such. Reduced motion drops the scale and keeps everything else.
 */
export function Pressable({ click = false, pressedScale = 0.94, disabled, className, children, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, ...props }: PressableProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <m.button
      type="button"
      disabled={disabled}
      className={cn("pressable", className)}
      animate={{ scale: pressed && !reduce && !disabled ? pressedScale : 1 }}
      transition={{ type: "spring", duration: 0.09, bounce: 0 }}
      onPointerDown={(e) => {
        if (!disabled) {
          setPressed(true);
          haptic("tap");
          if (click) playSound("key");
        }
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        release();
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        release();
        onPointerLeave?.(e);
      }}
      {...props}
    >
      {children}
    </m.button>
  );
}
