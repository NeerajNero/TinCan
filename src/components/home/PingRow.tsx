"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { increment, updateDoc } from "@/lib/firebase/fs";

import { pairRef } from "@/lib/db/refs";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { sendPing } from "@/lib/rtdb";
import { BASE_PING_KINDS, PINGS, type PingKind } from "@/lib/types";

/** Four bouncy ping buttons. Sending bounces the button and flashes "Sent!". */
export function PingRow({ friendUid, friendName }: { friendUid: string; friendName: string }) {
  const { uid, me, pair } = usePair();
  const preset = useRelationship();
  const kinds: PingKind[] = preset.extraPing ? [...BASE_PING_KINDS, preset.extraPing] : [...BASE_PING_KINDS];
  const [sent, setSent] = useState<PingKind | null>(null);

  async function ping(kind: PingKind) {
    setSent(kind);
    setTimeout(() => setSent((s) => (s === kind ? null : s)), 1200);
    try {
      await sendPing(friendUid, uid, kind);
      await notify("ping", {
        toUid: friendUid,
        title: me.nickname,
        body: `${PINGS[kind].emoji} ${me.nickname} ${PINGS[kind].sentence}`,
        data: { kind },
      });
      const total = (pair.counters?.pings ?? 0) + 1;
      void updateDoc(pairRef(), { "counters.pings": increment(1) }).catch(() => undefined);
      if (total >= 100 && !pair.garden?.stickers?.["pings-100"]) void recordTogetherEvent("pings-100", uid);
    } catch {
      setSent(null);
    }
  }

  return (
    <section aria-label={`Send ${friendName} a ping`} className={kinds.length === 5 ? "grid grid-cols-5 gap-1.5" : "grid grid-cols-4 gap-2"}>
      {kinds.map((kind) => {
        const isSent = sent === kind;
        return (
          <motion.button
            key={kind}
            type="button"
            onClick={() => ping(kind)}
            aria-label={PINGS[kind].label}
            whileTap={{ scale: 0.85 }}
            animate={isSent ? { y: [0, -14, 0], rotate: [0, -8, 8, 0] } : { y: 0, rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="card tap flex flex-col items-center gap-1 rounded-[24px] py-3"
          >
            <span className="text-3xl" aria-hidden>
              {PINGS[kind].emoji}
            </span>
            <span className="text-[11px] font-bold leading-tight text-muted">{isSent ? "Sent!" : PINGS[kind].label}</span>
          </motion.button>
        );
      })}
    </section>
  );
}
