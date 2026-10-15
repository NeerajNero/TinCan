"use client";

import { motion } from "framer-motion";

import { Card } from "@/components/ui/Card";
import { useRelationship } from "@/hooks/useRelationship";

/** Shown while pair/main still has only one uid. */
export function WaitingCard() {
  const preset = useRelationship();
  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <motion.div
        aria-hidden
        className="text-6xl"
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        📞
      </motion.div>
      <h2 className="text-xl font-semibold">Waiting for the other {preset.pairNoun === "family" ? "half" : preset.pairNoun.replace(/s$/, "")} {preset.emoji}</h2>
      <p className="max-w-xs text-muted">
        The other end of the string is still loose. Once they sign in with their Google account, this screen fills up.
      </p>
    </Card>
  );
}
