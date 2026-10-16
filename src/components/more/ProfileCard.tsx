"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";

import { ProgressRing } from "@/components/chat/media/ProgressRing";
import { EditableRow } from "@/components/more/EditableRow";
import { CityPicker } from "@/components/onboarding/CityPicker";
import { Avatar, BIO_MAX } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { removeAvatar, setBio, setCity, setNickname, uploadAvatar } from "@/lib/db/users";
import type { CityPick } from "@/lib/types";

const NICKNAME_MAX = 24;

/** Avatar (tap to change) + editable nickname, bio and city. */
export function ProfileCard() {
  const { uid, me } = usePair();
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickAvatar(list: FileList | null) {
    const file = list?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    setProgress(0);
    try {
      await uploadAvatar(uid, me, file, setProgress);
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("Cloudinary") ? err.message : "Couldn't upload that photo. Try another?");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-4 px-2 pt-1 pb-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={progress !== null}
          aria-label="Change profile photo"
          className="tap relative shrink-0 rounded-full"
        >
          <Avatar user={me} size={64} />
          <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white shadow" aria-hidden>
            <Camera size={13} />
          </span>
          {progress !== null && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/30">
              <ProgressRing fraction={progress} size={40} />
            </span>
          )}
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-semibold">{me.nickname}</p>
          <p className="truncate text-sm text-muted">{me.bio || me.name || me.email}</p>
          {me.avatar && (
            <button type="button" onClick={() => void removeAvatar(uid, me)} className="tap -ml-1 px-1 text-xs font-bold text-muted">
              Use Google photo instead
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="px-2 text-xs text-red-500">
          {error}
        </p>
      )}

      <EditableRow emoji="🏷️" label="Nickname" value={me.nickname}>
        {(close) => <NicknameEditor uid={uid} initial={me.nickname} onDone={close} />}
      </EditableRow>

      <EditableRow emoji="💬" label="Bio" value={me.bio || null} placeholder="A line about you">
        {(close) => <BioEditor uid={uid} initial={me.bio ?? ""} onDone={close} />}
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

function BioEditor({ uid, initial, onDone }: { uid: string; initial: string; onDone: () => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = value.trim();
  const canSave = trimmed !== initial.trim() && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await setBio(uid, trimmed);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, BIO_MAX))}
        maxLength={BIO_MAX}
        placeholder="Chai person. Night owl. Misses you."
        aria-label="Bio"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {value.length}/{BIO_MAX}
        </span>
        <Button type="submit" disabled={!canSave} className="px-5">
          {busy ? "…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
