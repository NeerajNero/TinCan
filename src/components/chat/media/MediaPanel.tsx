"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { STICKERS } from "@/content/stickers";
import { cn } from "@/lib/cn";
import { COMPOSER_EMOJI } from "@/lib/emoji";
import { giphyEnabled, GiphyRateLimited, searchGifs, type Gif } from "@/lib/giphy";

type Tab = "emoji" | "stickers" | "gifs";

interface MediaPanelProps {
  onEmoji: (emoji: string) => void;
  onSticker: (id: string) => void;
  onGif: (gif: Gif) => void;
}

/** Emoji · Stickers · GIFs (GIFs only with a GIPHY key). Sits under the composer. */
export function MediaPanel({ onEmoji, onSticker, onGif }: MediaPanelProps) {
  const [tab, setTab] = useState<Tab>("emoji");
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "emoji", label: "Emoji" },
    { key: "stickers", label: "Stickers" },
    ...(giphyEnabled ? [{ key: "gifs" as const, label: "GIFs" }] : []),
  ];

  return (
    <div className="flex h-64 flex-col border-t border-border bg-surface">
      <div role="tablist" className="flex gap-1 px-3 pt-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("tap rounded-full px-3 py-1 text-sm font-bold", tab === t.key ? "bg-accent-soft text-text" : "text-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "emoji" && (
          <div className="grid grid-cols-8 gap-0.5">
            {COMPOSER_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => onEmoji(e)} aria-label={`Insert ${e}`} className="tap grid place-items-center rounded-xl text-2xl hover:bg-surface-2">
                {e}
              </button>
            ))}
          </div>
        )}
        {tab === "stickers" && (
          <div className="grid grid-cols-4 gap-1">
            {STICKERS.map((s) => (
              <button key={s.id} type="button" onClick={() => onSticker(s.id)} aria-label={`Send ${s.label} sticker`} className="tap grid place-items-center rounded-2xl p-1 hover:bg-surface-2">
                <s.Svg width={72} height={72} />
              </button>
            ))}
          </div>
        )}
        {tab === "gifs" && <GifTab onGif={onGif} />}
      </div>
    </div>
  );
}

function GifTab({ onGif }: { onGif: (gif: Gif) => void }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [failed, setFailed] = useState<"error" | "resting" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchGifs(query, controller.signal)
        .then((g) => {
          setGifs(g);
          setFailed(null);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setFailed(err instanceof GiphyRateLimited ? "resting" : "error");
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search GIPHY"
        aria-label="Search GIFs"
        className="tap w-full rounded-full border border-border bg-surface-2 px-4 text-sm focus:outline-none"
      />
      {failed === "resting" && <p className="text-center text-xs text-muted">GIF search is resting, try again in a bit ☕</p>}
      {failed === "error" && <p className="text-center text-xs text-muted">GIPHY didn&apos;t answer. Try again?</p>}
      <div className="grid grid-cols-3 gap-1">
        {gifs.map((g) => (
          <button key={g.id} type="button" onClick={() => onGif(g)} aria-label={`Send GIF: ${g.title}`} className="tap overflow-hidden rounded-xl bg-surface-2">
            <Image src={g.previewUrl} alt="" width={120} height={100} unoptimized className="h-24 w-full object-cover" />
          </button>
        ))}
      </div>
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-muted">Powered by GIPHY</p>
    </div>
  );
}
