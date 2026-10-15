"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useRef, useState } from "react";

import ideas from "@/content/hangout-ideas.json";
import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { sendText } from "@/lib/db/messages";
import { notify } from "@/lib/notify";
import { randomSeed, seededOrder } from "@/lib/seeded";

const SEGMENTS = 12;
const COLORS = ["#ff8fab", "#ffb454", "#6fb6ff", "#5fd3a4", "#b48cff", "#ffd166"];

function sample(seed: number): string[] {
  return seededOrder(ideas.length, seed).slice(0, SEGMENTS).map((i) => ideas[i]);
}

export function WheelScreen() {
  const { uid, friendUid } = usePair();
  const [seed, setSeed] = useState(randomSeed);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [posted, setPosted] = useState(false);
  const controls = useAnimationControls();
  const rotation = useRef(0);
  const items = sample(seed);

  async function spin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setPosted(false);
    const target = Math.floor(Math.random() * SEGMENTS);
    const segment = 360 / SEGMENTS;
    // Pointer at the top: land the centre of `target` under it.
    const final = 360 * 5 + (360 - (target * segment + segment / 2));
    const from = rotation.current % 360;
    await controls.start({ rotate: [from, from + final], transition: { duration: 4.2, ease: [0.12, 0.8, 0.2, 1] } });
    rotation.current = from + final;
    setResult(target);
    setSpinning(false);
    try {
      navigator.vibrate?.([30, 40, 30]);
    } catch {
      // no haptics
    }
  }

  async function lets() {
    if (result === null || posted) return;
    const text = `🎡 Let's: ${items[result]}`;
    setPosted(true);
    const id = await sendText(uid, text, null);
    if (friendUid) void notify("message", { toUid: friendUid, body: text, data: { messageId: id } });
  }

  const r = 150;
  const cx = 160;
  const cy = 160;
  const seg = (2 * Math.PI) / SEGMENTS;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="🎡"
        title="Hangout wheel"
        back="/play"
        action={
          <Button variant="soft" onClick={() => { if (!spinning) { setSeed(randomSeed()); setResult(null); } }} disabled={spinning} className="px-3 py-2 text-sm">
            Reshuffle
          </Button>
        }
      />
      <div className="relative mx-auto w-full max-w-[320px]">
        <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-2 text-3xl" aria-hidden>
          🔻
        </div>
        <motion.svg viewBox="0 0 320 320" className="w-full drop-shadow-lg" animate={controls} style={{ originX: "50%", originY: "50%" }} aria-label="Hangout wheel">
          {items.map((idea, i) => {
            const a0 = -Math.PI / 2 + i * seg;
            const a1 = a0 + seg;
            const x0 = cx + r * Math.cos(a0);
            const y0 = cy + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1);
            const y1 = cy + r * Math.sin(a1);
            const mid = a0 + seg / 2;
            const tx = cx + r * 0.62 * Math.cos(mid);
            const ty = cy + r * 0.62 * Math.sin(mid);
            return (
              <g key={i}>
                <path d={`M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="2" />
                <text x={tx} y={ty} fontSize="9" fontWeight="700" fill="#3b2f3a" textAnchor="middle" transform={`rotate(${(mid * 180) / Math.PI} ${tx} ${ty})`}>
                  {idea.length > 22 ? `${idea.slice(0, 21)}…` : idea}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r="22" fill="#fff" stroke="#3b2f3a" strokeWidth="3" />
          <text x={cx} y={cy + 6} fontSize="18" textAnchor="middle">
            🥫
          </text>
        </motion.svg>
      </div>
      <Button onClick={spin} disabled={spinning} className="self-center px-8">
        {spinning ? "Spinning…" : "Spin"}
      </Button>
      {result !== null && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">The wheel says</p>
          <p className="font-heading text-xl font-semibold leading-snug">{items[result]}</p>
          <Button onClick={lets} disabled={posted} className="px-6">
            {posted ? "Sent to chat ✓" : "Let's!"}
          </Button>
        </Card>
      )}
    </div>
  );
}
