"use client";

import { m } from "framer-motion";
import { useRef, useState } from "react";

import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { pairRef } from "@/lib/db/refs";
import { increment, updateDoc } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { PING_COOLDOWN_MS, pingAllowed, pingNow } from "@/lib/pings";
import { sendPing } from "@/lib/rtdb";
import { swallow } from "@/lib/swallow";
import { BASE_PING_KINDS, PINGS, type PingKind } from "@/lib/types";

/** Bouncy ping buttons. A tap sends, flashes "Sent!" with a shrinking ring, and rests the row for 5 s. */
export function PingRow({ friendUid, friendName }: { friendUid: string; friendName: string }) {
  const { uid, me, pair } = usePair();
  const preset = useRelationship();
  const kinds: PingKind[] = preset.extraPing ? [...BASE_PING_KINDS, preset.extraPing] : [...BASE_PING_KINDS];
  const [sent, setSent] = useState<PingKind | null>(null);
  const [cooling, setCooling] = useState(false);
  const lastSentAt = useRef<number | null>(null);

  async function ping(kind: PingKind) {
    if (cooling || !pingAllowed(lastSentAt.current)) return;
    lastSentAt.current = pingNow();
    setSent(kind);
    setCooling(true);
    setTimeout(() => {
      setSent((s) => (s === kind ? null : s));
      setCooling(false);
    }, PING_COOLDOWN_MS);
    try {
      await sendPing(friendUid, uid, kind);
      await notify("ping", {
        toUid: friendUid,
        title: me.nickname,
        body: `${PINGS[kind].emoji} ${me.nickname} ${PINGS[kind].sentence}`,
        data: { kind },
      });
      const total = (pair.counters?.pings ?? 0) + 1;
      void updateDoc(pairRef(), { "counters.pings": increment(1), [`counters.pingCounts.${kind}`]: increment(1) }).catch(swallow);
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
          <m.button
            key={kind}
            type="button"
            onClick={() => ping(kind)}
            disabled={cooling}
            aria-label={PINGS[kind].label}
            whileTap={{ scale: 0.85 }}
            animate={isSent ? { y: [0, -14, 0], rotate: [0, -8, 8, 0] } : { y: 0, rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="card tap relative flex flex-col items-center gap-1 rounded-[24px] py-3 disabled:opacity-60"
          >
            {isSent && (
              <svg className="pointer-events-none absolute inset-1" viewBox="0 0 100 100" aria-hidden>
                <m.rect x="3" y="3" width="94" height="94" rx="22" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 1 }} animate={{ pathLength: 0 }} transition={{ duration: PING_COOLDOWN_MS / 1000, ease: "linear" }} />
              </svg>
            )}
            <span className="text-3xl" aria-hidden>
              {PINGS[kind].emoji}
            </span>
            <span className="text-[11px] font-bold leading-tight text-muted">{isSent ? "Sent!" : PINGS[kind].label}</span>
          </m.button>
        );
      })}
    </section>
  );
}
