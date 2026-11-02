"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { touchLastOpen } from "@/lib/db/users";
import { digestGreeting, digestItems, type DigestInput } from "@/lib/digest";
import { swallow } from "@/lib/swallow";

/** The card writes `lastOpenAt` after this long on screen, so the next open starts from there. */
const DIGEST_SETTLE_MS = 30_000;

interface DigestCardProps {
  uid: string;
  friendName: string;
  input: DigestInput;
  /** `users/{me}.lastOpenAt` as captured when Home mounted (ms), or null. */
  sinceMs: number | null;
  now: number;
}

/**
 * Home's in-app digest (phase 27b): one friendly sentence about what happened
 * since the last open, built from the same items as the morning push
 * (`lib/digest.digestItems`), each a chip that deep-links. Hidden when nothing
 * happened; dismissing it (or 30 s on screen) moves `lastOpenAt` forward.
 */
export function DigestCard({ uid, friendName, input, sinceMs, now }: DigestCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const items = digestItems(input, friendName);
  const show = items.length > 0 && !dismissed;

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => touchLastOpen(uid).catch(swallow), DIGEST_SETTLE_MS);
    return () => clearTimeout(t);
  }, [show, uid]);

  if (!show) return null;
  const dismiss = () => {
    setDismissed(true);
    touchLastOpen(uid).catch(swallow);
  };

  return (
    <Card className="flex flex-col gap-2 p-4" style={{ "--accent": "var(--accent-home)" } as React.CSSProperties} aria-label="Since you were last here">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-heading text-base font-semibold">☀️ {digestGreeting(sinceMs, now)}</span>
          <span className="text-muted"> — {items.length === 1 ? "one thing" : `${items.length} things`} happened:</span>
        </p>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="tap -m-2 grid size-9 shrink-0 place-items-center rounded-full text-muted">
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Link key={item.key} href={item.url} onClick={dismiss} className="tap inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold">
            <span aria-hidden>{item.emoji}</span>
            <span className="truncate">{item.text}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
