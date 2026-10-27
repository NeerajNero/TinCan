"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { Card } from "@/components/ui/Card";
import { CloudImage } from "@/components/ui/CloudImage";
import { Sheet } from "@/components/ui/Sheet";
import { usePair } from "@/hooks/usePair";
import { questionAt } from "@/lib/daily";
import { dateKeyToLocalDate } from "@/lib/dates";
import { fetchOnThisDay, hasContent, readOnThisDayCache, type OnThisDayItem, type OnThisDayPhoto } from "@/lib/db/onThisDay";

/** Exactly a year and a month ago: photos, the question, a journal entry, both moods. Hidden when empty. */
export function OnThisDayCard({ today }: { today: string }) {
  const { uid, me, friend, pair } = usePair();
  const roomTz = pair.roomTz;
  const [items, setItems] = useState<OnThisDayItem[] | null>(() => readOnThisDayCache(today));
  const [viewing, setViewing] = useState<OnThisDayPhoto | null>(null);
  const [reading, setReading] = useState<{ title: string; body: React.ReactNode } | null>(null);

  useEffect(() => {
    if (readOnThisDayCache(today)) return;
    let live = true;
    fetchOnThisDay(today, roomTz)
      .then((res) => live && setItems(res))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [today, roomTz]);

  const nameOf = (id: string) => (id === uid ? "You" : (friend?.nickname ?? "Friend"));
  const shown = (items ?? []).filter(hasContent);
  if (shown.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3" style={{ "--accent": "var(--accent-memories)" } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          📆
        </span>
        <p className="font-heading text-lg font-semibold">On this day</p>
      </div>
      {shown.map((item) => (
        <div key={item.span} className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {item.label} · {format(dateKeyToLocalDate(item.dateKey), "EEE d MMM yyyy")}
          </p>
          {item.photos.length > 0 && (
            <div className="flex gap-2">
              {item.photos.map((p) => (
                <button key={p.id} type="button" onClick={() => setViewing(p)} aria-label={p.caption || "Open photo"} className="tap h-24 flex-1 overflow-hidden rounded-2xl bg-surface-2">
                  <CloudImage media={p} alt={p.caption} w={p.w} h={p.h} sizes="33vw" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {item.question && (
            <button
              type="button"
              onClick={() =>
                setReading({
                  title: "💭 " + questionAt(item.question!.index),
                  body: (
                    <>
                      {Object.entries(item.question!.answers).map(([who, text]) => (
                        <p key={who} className="rounded-2xl bg-surface-2 px-3 py-2 text-left text-sm">
                          <span className="font-bold">{nameOf(who)}: </span>
                          {text}
                        </p>
                      ))}
                    </>
                  ),
                })
              }
              className="tap rounded-2xl bg-surface-2 px-3 py-2 text-left text-sm"
            >
              💭 <span className="font-semibold">{questionAt(item.question.index)}</span>
              <span className="block text-xs text-muted">{Object.keys(item.question.answers).map(nameOf).join(" and ")} answered</span>
            </button>
          )}
          {item.journal && (
            <button
              type="button"
              onClick={() => setReading({ title: `${item.journal!.mood || "📓"} ${nameOf(item.journal!.authorId)} wrote`, body: <p className="whitespace-pre-wrap text-left text-sm">{item.journal!.text}</p> })}
              className="tap rounded-2xl bg-surface-2 px-3 py-2 text-left text-sm"
            >
              {item.journal.mood || "📓"} <span className="font-semibold">{nameOf(item.journal.authorId)} wrote:</span> <span className="text-muted">{item.journal.text.slice(0, 90)}{item.journal.text.length > 90 ? "…" : ""}</span>
            </button>
          )}
          {Object.keys(item.moods).length > 0 && (
            <p className="px-1 text-sm">
              {Object.entries(item.moods)
                .map(([who, emoji]) => `${emoji} ${who === uid ? me.nickname : nameOf(who)}`)
                .join(" · ")}
            </p>
          )}
        </div>
      ))}
      <ImageViewer media={viewing} caption={viewing?.caption} onClose={() => setViewing(null)} />
      <Sheet open={reading !== null} onClose={() => setReading(null)} label={reading?.title ?? "Memory"} className="flex flex-col gap-2 px-5 pb-2">
        <p className="font-heading text-lg font-semibold">{reading?.title}</p>
        {reading?.body}
      </Sheet>
    </Card>
  );
}
