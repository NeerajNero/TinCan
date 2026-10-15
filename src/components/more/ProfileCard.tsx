"use client";

import Image from "next/image";
import { useState } from "react";

import { CityPicker } from "@/components/onboarding/CityPicker";
import { EditableRow } from "@/components/more/EditableRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { usePair } from "@/hooks/usePair";
import { setCity, setNickname } from "@/lib/db/users";
import type { CityPick } from "@/lib/types";

const NICKNAME_MAX = 24;

/** Google avatar + editable nickname and city. */
export function ProfileCard() {
  const { user } = useAuth();
  const { uid, me } = usePair();
  const photo = me.photoURL ?? user?.photoURL ?? null;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-4 px-2 pt-1 pb-2">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={56}
            height={56}
            unoptimized
            referrerPolicy="no-referrer"
            className="size-14 rounded-full bg-surface-2 object-cover"
          />
        ) : (
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
            🙂
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-semibold">{me.nickname}</p>
          <p className="truncate text-sm text-muted">{me.name || me.email}</p>
        </div>
      </div>

      <EditableRow emoji="🏷️" label="Nickname" value={me.nickname}>
        {(close) => <NicknameEditor uid={uid} initial={me.nickname} onDone={close} />}
      </EditableRow>

      <EditableRow emoji="📍" label="City" value={me.city} hint={me.tz}>
        {(close) => <CityEditor uid={uid} onDone={close} />}
      </EditableRow>
    </Card>
  );
}

function NicknameEditor({ uid, initial, onDone }: { uid: string; initial: string; onDone: () => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initial && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await setNickname(uid, trimmed);
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
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, NICKNAME_MAX))}
        maxLength={NICKNAME_MAX}
        aria-label="Nickname"
        autoFocus
      />
      <Button type="submit" disabled={!canSave} className="shrink-0 px-4">
        {busy ? "…" : "Save"}
      </Button>
    </form>
  );
}

function CityEditor({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [pick, setPick] = useState<CityPick | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      await setCity(uid, pick);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CityPicker value={pick} onChange={setPick} autoFocus />
      {pick && (
        <Button onClick={save} disabled={busy} className="self-end px-5">
          {busy ? "Saving…" : "Save city"}
        </Button>
      )}
    </>
  );
}
