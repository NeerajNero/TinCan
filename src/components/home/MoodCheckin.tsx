"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { setMood } from "@/lib/db/home";
import { MOOD_EMOJI, type MoodDoc } from "@/lib/types";

interface MoodCheckinProps {
  myToday: string;
  myMood: MoodDoc | null;
  friendMood: MoodDoc | null;
  friendName: string | null;
}

/** Eight emoji + an optional one-liner; mine on the left, theirs on the right. Editable all day. */
export function MoodCheckin({ myToday, myMood, friendMood, friendName }: MoodCheckinProps) {
  const { uid } = usePair();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const showPicker = !myMood || editing;

  async function pick(emoji: string) {
    setBusy(true);
    try {
      await setMood(myToday, uid, emoji, note || myMood?.note || "");
      setEditing(false);
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">How&apos;s today?</h2>
        {myMood && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="tap px-2 text-sm font-bold text-muted">
            Change
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MoodBubble who="You" mood={myMood} placeholder="Pick one below" />
        {friendName && <MoodBubble who={friendName} mood={friendMood} placeholder="Not checked in yet" />}
      </div>

      {showPicker && (
        <div className="flex flex-col gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 80))}
            placeholder={myMood?.note || "One line about today (optional)"}
            maxLength={80}
            aria-label="Mood note"
          />
          <div role="group" aria-label="Pick a mood" className="grid grid-cols-8 gap-1">
            {MOOD_EMOJI.map((emoji) => (
              <m.button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                disabled={busy}
                aria-label={`Mood ${emoji}`}
                whileTap={{ scale: 0.8 }}
                className={cn(
                  "tap grid place-items-center rounded-2xl text-2xl hover:bg-surface-2",
                  myMood?.emoji === emoji && "bg-accent-soft",
                )}
              >
                {emoji}
              </m.button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function MoodBubble({ who, mood, placeholder }: { who: string; mood: MoodDoc | null; placeholder: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <m.span
        key={mood?.emoji ?? "none"}
        aria-hidden
        className="text-3xl"
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 16 }}
      >
        {mood?.emoji ?? "·"}
      </m.span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{who}</p>
        <p className={cn("truncate text-sm", mood ? "font-semibold" : "text-muted")}>{mood ? mood.note || "Checked in" : placeholder}</p>
      </div>
    </div>
  );
}
