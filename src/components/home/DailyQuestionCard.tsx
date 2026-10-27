"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { questionFor } from "@/lib/daily";
import { answerDaily } from "@/lib/db/daily";
import { notify } from "@/lib/notify";

/** Today's prompt (ROOM_TZ). My answer is editable all day; theirs is blurred until I've answered. */
export function DailyQuestionCard({ today, friendUid, friendName, party = false }: { today: string; friendUid: string | null; friendName: string | null; party?: boolean }) {
  const { uid } = usePair();
  const { daily: docData } = useLiveEvents();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const question = questionFor(today);
  const mine = docData?.answers?.[uid]?.text ?? null;
  const theirs = friendUid ? (docData?.answers?.[friendUid]?.text ?? null) : null;
  const showBox = mine === null || editing;

  async function save() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const first = mine === null;
      await answerDaily(today, uid, text);
      setEditing(false);
      setDraft("");
      if (first && friendUid) void notify("daily-answer", { toUid: friendUid });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          💭
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{party && "🎉 "}Today&apos;s question</p>
          <p className="font-heading text-lg font-semibold leading-snug">{question}</p>
        </div>
      </div>

      {showBox ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            placeholder={mine ?? "Your answer…"}
            rows={2}
            aria-label="Your answer"
            className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!draft.trim() || busy} className="px-5">
              {busy ? "Saving…" : mine ? "Update" : "Answer"}
            </Button>
          </div>
        </form>
      ) : (
        <AnswerRow who="You" text={mine ?? ""} onEdit={() => { setDraft(mine ?? ""); setEditing(true); }} />
      )}

      {friendUid && (
        <div className="relative">
          <AnswerRow who={friendName ?? "Friend"} text={theirs ?? `${friendName ?? "They"} hasn't answered yet`} muted={theirs === null} blurred={mine === null && theirs !== null} />
          {mine === null && theirs !== null && (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center text-sm font-bold">
              Answer to reveal 👀
            </m.p>
          )}
        </div>
      )}
    </Card>
  );
}

function AnswerRow({ who, text, muted, blurred, onEdit }: { who: string; text: string; muted?: boolean; blurred?: boolean; onEdit?: () => void }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2.5", blurred && "select-none blur-sm")} aria-hidden={blurred}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{who}</p>
        <p className={cn("text-sm whitespace-pre-wrap", muted ? "text-muted" : "font-semibold")}>{text}</p>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="tap px-2 text-xs font-bold text-muted">
          Edit
        </button>
      )}
    </div>
  );
}
