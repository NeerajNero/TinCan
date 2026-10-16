"use client";

import { m, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "ghost";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  children?: React.ReactNode;
}

const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[0_8px_20px_-10px_var(--accent)]",
  soft: "bg-accent-soft text-text",
  ghost: "bg-transparent text-text hover:bg-surface-2",
};

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "tap inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading text-base font-semibold",
        "disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </m.button>
  );
}
