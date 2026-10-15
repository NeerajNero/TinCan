"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { bumpTally, flipNext, respond, setPick, subscribeDeck, type DeckNode } from "@/lib/db/decks";
import { cardIndexAt, convoCard, dareCard, DECK_META, nhieCard, truthCard, wyrCard, type DeckKind } from "@/lib/decks";
import { notify } from "@/lib/notify";

export function DeckScreen({ kind }: { kind: DeckKind }) {
  const { uid, me, friend, friendUid } = usePair();
  const [node, setNode] = useState<DeckNode | null | undefined>(undefined);
  const [nudged, setNudged] = useState(false);
  const meta = DECK_META[kind];
  const friendName = friend?.nickname ?? "your friend";

  useEffect(() => {
    const unsub = subscribeDeck(kind, setNode);
    return () => unsub();
  }, [kind]);

  const cardIndex = node ? cardIndexAt(kind, node.seed, node.index) : null;
  const responses = node?.responses ?? {};
  const mine = responses[uid];
  const theirs = friendUid ? responses[friendUid] : undefined;
  const both = Boolean(mine && theirs);

  // Tally once per card when both have answered (whoever answered second does it).
  const talliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!node || !both || !friendUid) return;
    const key = `${node.seed}:${node.index}`;
    if (talliedFor.current === key) return;
    talliedFor.current = key;
    if (kind === "wyr") void bumpTally(kind, { compared: 1, agreed: mine === theirs ? 1 : 0 });
    if (kind === "nhie") void bumpTally(kind, { points: { [uid]: mine === "have" ? 1 : 0, [friendUid]: theirs === "have" ? 1 : 0 } });
  }, [node, both, kind, mine, theirs, uid, friendUid]);

  function nudge() {
    if (!friendUid || nudged) return;
    setNudged(true);
    void notify("invite", { toUid: friendUid, body: `wants to play ${meta.name} ${meta.emoji}`, data: { url: `/play/deck/${kind}` } });
    setTimeout(() => setNudged(false), 60_000);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji={meta.emoji}
        title={meta.name}
        back="/play"
        screenName={meta.name}
        action={
          <Button variant="soft" onClick={nudge} disabled={!friendUid || nudged} className="px-3 py-2 text-sm">
            {nudged ? "Nudged" : "Nudge"}
          </Button>
        }
      />

      {node === undefined && <Card className="py-10 text-center text-muted">Shuffling…</Card>}
      {node === null && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-6xl" aria-hidden>
            {meta.emoji}
          </span>
          <p className="text-muted">{meta.blurb}. Flip the first card?</p>
          <Button onClick={() => void flipNext(kind, uid, kind === "tod" ? { turn: uid } : {})}>Flip a card</Button>
        </Card>
      )}

      {node && cardIndex !== null && (
        <AnimatePresence mode="wait">
          <motion.div key={`${node.seed}-${node.index}`} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.25 }}>
            {kind === "wyr" && <WyrCardView index={cardIndex} mine={mine} theirs={theirs} both={both} friendName={friendName} onPick={(v) => void respond(kind, uid, v)} />}
            {kind === "nhie" && <NhieCardView index={cardIndex} mine={mine} theirs={theirs} both={both} friendName={friendName} onPick={(v) => void respond(kind, uid, v)} />}
            {kind === "tod" && (
              <TodCardView
                index={cardIndex}
                node={node}
                uid={uid}
                friendUid={friendUid}
                myName={me.nickname}
                friendName={friendName}
                onPick={(pick) => void setPick(kind, pick, node.turn ?? uid)}
              />
            )}
            {kind === "convo" && <ConvoCardView index={cardIndex} />}
          </motion.div>
        </AnimatePresence>
      )}

      {node && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted">
            Card {node.index + 1} · flipped by {node.flippedBy === uid ? "you" : friendName}
            {kind === "wyr" && node.tally?.compared ? ` · agreed ${node.tally.agreed ?? 0}/${node.tally.compared}` : ""}
            {kind === "nhie" && node.tally?.points ? ` · ${me.nickname} ${node.tally.points[uid] ?? 0} · ${friendName} ${friendUid ? (node.tally.points[friendUid] ?? 0) : 0}` : ""}
          </p>
          <Button
            onClick={() => void flipNext(kind, uid, kind === "tod" ? { turn: node.turn && friendUid ? (node.turn === uid ? friendUid : uid) : uid } : {})}
            disabled={(kind === "wyr" || kind === "nhie") && Boolean(mine) && !both}
            className="px-4 py-2 text-sm"
          >
            {kind === "tod" ? "Done · next" : "Next card"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Choice({ label, picked, revealTheirs, theirsPicked, onPick, disabled }: { label: string; picked: boolean; revealTheirs: boolean; theirsPicked: boolean; onPick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={picked}
      className={cn(
        "tap relative flex-1 rounded-2xl px-3 py-4 text-left text-[15px] font-semibold transition-colors",
        picked ? "bg-[var(--accent)] text-white" : "bg-surface-2",
        revealTheirs && theirsPicked && !picked && "ring-2 ring-[var(--accent-memories)]",
      )}
    >
      {label}
      {revealTheirs && theirsPicked && <span className="absolute -top-2 -right-1 rounded-full bg-[var(--accent-memories)] px-2 py-0.5 text-[10px] font-bold text-white">them</span>}
    </button>
  );
}

function WyrCardView({ index, mine, theirs, both, friendName, onPick }: { index: number; mine?: string; theirs?: string; both: boolean; friendName: string; onPick: (v: "A" | "B") => void }) {
  const card = wyrCard(index);
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">Would you rather…</p>
      <div className="flex flex-col gap-2">
        <Choice label={card.a} picked={mine === "A"} revealTheirs={both} theirsPicked={theirs === "A"} onPick={() => onPick("A")} disabled={Boolean(mine)} />
        <p className="text-center text-xs font-bold text-muted">or</p>
        <Choice label={card.b} picked={mine === "B"} revealTheirs={both} theirsPicked={theirs === "B"} onPick={() => onPick("B")} disabled={Boolean(mine)} />
      </div>
      <p className="text-center text-sm text-muted">
        {!mine ? "Pick one" : !theirs ? `Waiting for ${friendName}…` : mine === theirs ? "Same! 🎉" : "Different picks 👀"}
      </p>
    </Card>
  );
}

function NhieCardView({ index, mine, theirs, both, friendName, onPick }: { index: number; mine?: string; theirs?: string; both: boolean; friendName: string; onPick: (v: "have" | "never") => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-heading text-xl font-semibold leading-snug">{nhieCard(index)}</p>
      <div className="flex gap-2">
        <Choice label="I have 🙋" picked={mine === "have"} revealTheirs={both} theirsPicked={theirs === "have"} onPick={() => onPick("have")} disabled={Boolean(mine)} />
        <Choice label="Never 😇" picked={mine === "never"} revealTheirs={both} theirsPicked={theirs === "never"} onPick={() => onPick("never")} disabled={Boolean(mine)} />
      </div>
      <p className="text-center text-sm text-muted">{!mine ? "Confess?" : !theirs ? `Waiting for ${friendName}…` : theirs === "have" && mine === "have" ? "Both guilty 😂" : theirs === "have" ? `${friendName} has!` : mine === "have" ? "Only you 🙈" : "Both innocent"}</p>
    </Card>
  );
}

function TodCardView({ index, node, uid, friendUid, myName, friendName, onPick }: { index: number; node: DeckNode; uid: string; friendUid: string | null; myName: string; friendName: string; onPick: (p: "truth" | "dare") => void }) {
  const turn = node.turn ?? uid;
  const myTurn = turn === uid;
  const [spinning, setSpinning] = useState(false);
  const [face, setFace] = useState<"truth" | "dare">("truth");

  function spin() {
    if (spinning) return;
    setSpinning(true);
    let i = 0;
    const id = setInterval(() => {
      setFace((f) => (f === "truth" ? "dare" : "truth"));
      i++;
      if (i > 10) {
        clearInterval(id);
        const pick = Math.random() < 0.5 ? "truth" : "dare";
        setFace(pick);
        setSpinning(false);
        onPick(pick);
      }
    }, 90);
  }

  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{myTurn ? "Your turn" : `${friendName}'s turn`}</p>
      {!node.pick ? (
        <>
          <motion.span className="text-6xl" animate={spinning ? { rotate: [0, 360] } : { rotate: 0 }} transition={{ duration: 0.9, repeat: spinning ? Infinity : 0, ease: "linear" }} aria-hidden>
            {face === "truth" ? "🗣️" : "🎯"}
          </motion.span>
          <p className="font-heading text-2xl font-semibold">{spinning ? (face === "truth" ? "Truth…" : "Dare…") : "Spin for truth or dare"}</p>
          {myTurn && (
            <Button onClick={spin} disabled={spinning}>
              Spin
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wide">{node.pick}</span>
          <p className="font-heading text-xl font-semibold leading-snug">{node.pick === "truth" ? truthCard(index) : dareCard(index)}</p>
          <p className="text-sm text-muted">{myTurn ? "Answer in chat, then tap Done" : `${friendName} is on it. Judge generously.`}</p>
        </>
      )}
      {friendUid && <p className="text-[11px] text-muted">Next up: {turn === uid ? friendName : myName}</p>}
    </Card>
  );
}

function ConvoCardView({ index }: { index: number }) {
  const card = convoCard(index);
  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <span className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide", card.depth === "deep" ? "bg-[var(--accent-memories)]/20" : "bg-accent-soft")}>{card.depth}</span>
      <p className="font-heading text-2xl font-semibold leading-snug">{card.text}</p>
    </Card>
  );
}
