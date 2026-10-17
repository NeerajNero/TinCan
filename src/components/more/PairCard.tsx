"use client";

import { format } from "date-fns";
import { useState } from "react";

import { EditableRow } from "@/components/more/EditableRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { RELATIONSHIPS } from "@/content/relationships";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { createSystemMessage } from "@/lib/chat/system";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate, isDateKey } from "@/lib/dates";
import { setFriendsSince, setNextMeetup, setRelationship } from "@/lib/db/pair";
import { renamePet } from "@/lib/db/pet";
import { swallow } from "@/lib/swallow";
import type { NextMeetup } from "@/lib/types";

function prettyDate(key: string | null | undefined): string | null {
  return key && isDateKey(key) ? format(dateKeyToLocalDate(key), "d MMM yyyy") : null;
}

/** Us two: who's on the other end, friends-since, next meetup, and the pet's name (phase 12). */
export function PairCard() {
  const { me, pair, friend } = usePair();
  const preset = useRelationship();

  const meetupValue = pair.nextMeetup
    ? [prettyDate(pair.nextMeetup.date), pair.nextMeetup.label || pair.nextMeetup.place].filter(Boolean).join(" · ")
    : null;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <h2 className="px-2 pt-1 text-lg font-semibold">Us two</h2>

      <div className="flex items-center gap-3 px-2 py-1.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
          {friend ? "🫶" : "📞"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">Friend</span>
          <span className="block truncate font-semibold">
            {friend ? `${friend.nickname} · ${friend.city}` : "Waiting for them to sign in"}
          </span>
        </span>
      </div>

      <EditableRow emoji={preset.emoji} label="We are" value={`${preset.label} · ${preset.pairNoun}`}>
        {(close) => (
          <RelationshipPicker
            current={preset.id}
            onPick={async (id) => {
              if (id === preset.id) return close();
              const next = RELATIONSHIPS.find((r) => r.id === id);
              await setRelationship(id);
              if (next) createSystemMessage("relationship", `${next.emoji} ${me.nickname} changed us to ${next.label}`, { who: me.nickname, relationship: next.id }).catch(swallow);
              close();
            }}
          />
        )}
      </EditableRow>

      <EditableRow emoji="🧵" label={preset.sinceLabel} value={prettyDate(pair.friendsSince)} placeholder="Pick a date">
        {(close) => <FriendsSinceEditor initial={pair.friendsSince} onDone={close} />}
      </EditableRow>

      <EditableRow emoji="✈️" label="Next meetup" value={meetupValue} placeholder="Nothing planned yet">
        {(close) => <MeetupEditor initial={pair.nextMeetup} onDone={close} />}
      </EditableRow>

      <EditableRow emoji="🐾" label="Pet name" value={pair.pet?.name ?? null} placeholder="Adopt one on Home first" disabled={!pair.pet}>
        {(close) => <PetNameEditor initial={pair.pet?.name ?? ""} onDone={close} />}
      </EditableRow>
    </Card>
  );
}

function FriendsSinceEditor({ initial, onDone }: { initial: string | null; onDone: () => void }) {
  const [date, setDate] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const valid = isDateKey(date);
  const canSave = valid && date !== initial && !busy;

  async function save(value: string | null) {
    setBusy(true);
    try {
      await setFriendsSince(value);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) void save(date);
      }}
    >
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Friends since" max="9999-12-31" />
      <div className="flex justify-end gap-2">
        {initial && (
          <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
            Clear
          </Button>
        )}
        <Button type="submit" disabled={!canSave} className="px-5">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function MeetupEditor({ initial, onDone }: { initial: NextMeetup | null; onDone: () => void }) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [busy, setBusy] = useState(false);
  const canSave = isDateKey(date) && !busy;

  async function save(value: NextMeetup | null) {
    setBusy(true);
    try {
      await setNextMeetup(value);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) void save({ date, label: label.trim(), place: place.trim() });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetup-date">When</Label>
        <Input id="meetup-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max="9999-12-31" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetup-label">What</Label>
        <Input
          id="meetup-label"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          placeholder="Beach weekend"
          maxLength={40}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetup-place">Where</Label>
        <Input
          id="meetup-place"
          value={place}
          onChange={(e) => setPlace(e.target.value.slice(0, 60))}
          placeholder="Goa"
          maxLength={60}
        />
      </div>
      <div className="flex justify-end gap-2">
        {initial && (
          <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
            Clear
          </Button>
        )}
        <Button type="submit" disabled={!canSave} className="px-5">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function RelationshipPicker({ current, onPick }: { current: string; onPick: (id: string) => void | Promise<void> }) {
  return (
    <div role="radiogroup" aria-label="Relationship" className="grid grid-cols-2 gap-1.5">
      {RELATIONSHIPS.map((r) => (
        <button
          key={r.id}
          type="button"
          role="radio"
          aria-checked={current === r.id}
          onClick={() => void onPick(r.id)}
          className={cn("tap flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold", current === r.id ? "bg-accent-soft" : "bg-surface-2 text-muted hover:text-text")}
        >
          <span className="text-xl" aria-hidden>
            {r.emoji}
          </span>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function PetNameEditor({ initial, onDone }: { initial: string; onDone: () => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initial && !busy;
  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await renamePet(trimmed);
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value.slice(0, 24))} maxLength={24} aria-label="Pet name" autoFocus />
      <Button type="submit" disabled={!canSave} className="shrink-0 px-4">
        {busy ? "…" : "Save"}
      </Button>
    </form>
  );
}
