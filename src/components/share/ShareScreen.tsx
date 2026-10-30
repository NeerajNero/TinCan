"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Splash } from "@/components/ui/Splash";
import { usePair } from "@/hooks/usePair";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { addMemories } from "@/lib/db/memories";
import { sendMedia, sendText } from "@/lib/db/messages";
import { PlaylistFullError, savePlaylistItem } from "@/lib/db/playlists";
import { loadVideo } from "@/lib/db/watch";
import { compressImage } from "@/lib/media/compress";
import { uploadImages } from "@/lib/media/uploadImages";
import { notify } from "@/lib/notify";
import { safeThumb } from "@/lib/safeUrl";
import { classifyShare, shareChatText, type ShareClassification } from "@/lib/share";
import { clearShareStash, readShareStash, type ShareStash } from "@/lib/shareStash";
import { errorMessage } from "@/lib/swallow";
import { fetchYouTubeMeta } from "@/lib/youtube";

type Phase = { kind: "loading" } | { kind: "explainer" } | { kind: "ready"; stash: ShareStash; share: ShareClassification };

/**
 * `/share` — what Android's share sheet lands on. With a stash: a preview and
 * the destinations for that kind of content; without one: how to share into
 * Tincan. Every action calls the same helpers the screens use, clears the
 * stash and goes to that screen.
 */
export function ShareScreen() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { toast } = useToast();
  const { uid, friendUid, friend } = usePair();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    let live = true;
    readShareStash(id).then((stash) => {
      if (!live) return;
      if (!stash) {
        setPhase({ kind: "explainer" });
        return;
      }
      const share = classifyShare(stash.meta);
      setPhase(share.kind === "empty" ? { kind: "explainer" } : { kind: "ready", stash, share });
      setComment(share.kind === "images" ? "" : shareChatText(share));
      setTitle(share.title);
      if (share.videoId) fetchYouTubeMeta(share.videoId).then((m) => live && setTitle(m.title)).catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, [id]);

  const previews = useMemo(() => (phase.kind === "ready" ? phase.stash.files.map((f) => URL.createObjectURL(f)) : []), [phase]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function run(key: string, action: () => Promise<string>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setProgress(0);
    try {
      const target = await action();
      await clearShareStash(id);
      router.replace(target);
    } catch (err) {
      setError(err instanceof PlaylistFullError ? err.message : errorMessage(err, "That didn't work — try again?"));
      setBusy(null);
    }
  }

  if (phase.kind === "loading") return <Splash label="Unpacking…" inline />;

  if (phase.kind === "explainer" || !friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader emoji="📤" title="Share to Tincan" back="/" />
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="text-6xl" aria-hidden>
            🥫
          </span>
          <p className="font-heading text-xl font-semibold">Share something to Tincan from another app</p>
          <p className="max-w-xs text-sm text-muted">
            In YouTube, your gallery or a browser, tap Share and pick Tincan. Links and photos come here, and you choose: chat, watch or listen together, a playlist, or Memories.
          </p>
          {!friendUid && <p className="text-xs text-muted">Sharing unlocks once your friend has joined.</p>}
          {id && <p className="text-xs text-muted">This share was already used or has expired.</p>}
          <Button variant="soft" onClick={() => router.replace("/")} className="mt-1">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const { share, stash } = phase;
  const friendName = friend?.nickname ?? "your friend";
  const videoId = share.videoId;
  const thumb = videoId ? safeThumb(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`) : null;
  const sendTextToChat = async () => {
    const text = comment.trim();
    if (!text) throw new Error("Nothing to send");
    const messageId = await sendText(uid, text, null);
    await notify("message", { toUid: friendUid, body: text, data: { messageId } });
    return "/chat";
  };

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="📤" title="Share to Tincan" back="/" />

      {share.kind === "youtube" && videoId && (
        <>
          <Card className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- derived YouTube thumbnail, never next/image */}
            {thumb && <img src={thumb} alt="" width={96} height={54} className="h-[54px] w-24 shrink-0 rounded-xl object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{title || "YouTube video"}</span>
              <span className="block text-xs text-muted">YouTube</span>
            </span>
          </Card>
          <Destinations
            busy={busy}
            items={[
              { key: "watch", emoji: "📺", label: "Play in Watch", onPick: () => run("watch", async () => (await loadVideo("watch", uid, videoId, title || "YouTube video", `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`), "/play/watch")) },
              { key: "listen", emoji: "🎧", label: "Play in Listen", onPick: () => run("listen", async () => (await loadVideo("listen", uid, videoId, title || "YouTube video", `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`), "/play/listen")) },
              { key: "save-watch", emoji: "⭐", label: "Save to Watch playlist", onPick: () => run("save-watch", async () => (await savePlaylistItem("watch", uid, { videoId, title: title || "YouTube video", addedBy: uid, addedAt: Date.now() }), toast({ emoji: "⭐", title: "Saved to the Watch playlist", vibrate: false }), "/play/watch")) },
              { key: "save-listen", emoji: "⭐", label: "Save to Listen playlist", onPick: () => run("save-listen", async () => (await savePlaylistItem("listen", uid, { videoId, title: title || "YouTube video", addedBy: uid, addedAt: Date.now() }), toast({ emoji: "⭐", title: "Saved to the Listen playlist", vibrate: false }), "/play/listen")) },
              { key: "chat", emoji: "💬", label: "Send to chat", onPick: () => run("chat", sendTextToChat) },
            ]}
          />
        </>
      )}

      {(share.kind === "link" || share.kind === "text") && (
        <Card className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Message to {friendName}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={5} maxLength={2000} className="w-full resize-none rounded-2xl bg-surface-2 px-3 py-2 text-base font-normal outline-none focus:ring-2 focus:ring-[var(--accent)]" aria-label="Message" />
          </label>
          <Button onClick={() => void run("chat", sendTextToChat)} disabled={busy !== null || !comment.trim()}>
            {busy === "chat" ? "Sending…" : "💬 Send to chat"}
          </Button>
        </Card>
      )}

      {share.kind === "images" && (
        <>
          <Card className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img key={src} src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder={stash.files.length > 1 ? "Caption for the first one (optional)" : "Caption (optional)"} aria-label="Caption" />
            {busy && <p className="text-xs text-muted" aria-live="polite">Uploading… {Math.round(progress * 100)}%</p>}
          </Card>
          <Destinations
            busy={busy}
            items={[
              {
                key: "chat",
                emoji: "💬",
                label: stash.files.length > 1 ? `Send ${stash.files.length} photos to chat` : "Send to chat",
                onPick: () =>
                  run("chat", async () => {
                    const files = stash.files;
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i]!;
                      const { blob, w, h } = await compressImage(file);
                      const up = await uploadToCloudinary(blob, { kind: "image", onProgress: (f) => setProgress((i + f) / files.length) });
                      const caption = i === 0 ? comment.trim() : "";
                      const messageId = await sendMedia(uid, "image", { url: up.url, publicId: up.publicId, variants: up.variants, w: up.w ?? w, h: up.h ?? h, bytes: up.bytes }, caption);
                      await notify("message", { toUid: friendUid, body: caption ? `📷 ${caption}` : "📷 Photo", data: { messageId } });
                    }
                    return "/chat";
                  }),
              },
              {
                key: "memories",
                emoji: "📸",
                label: "Save to Memories",
                onPick: () =>
                  run("memories", async () => {
                    const items = await uploadImages(stash.files, setProgress);
                    await addMemories(uid, items, comment, new Date(), null);
                    toast({ emoji: "📸", title: stash.files.length > 1 ? `${stash.files.length} photos saved to Memories` : "Saved to Memories", vibrate: false });
                    return "/memories/photos";
                  }),
              },
            ]}
          />
        </>
      )}

      {error && <p className="text-center text-sm font-bold text-red-500">{error}</p>}
    </div>
  );
}

function Destinations({ items, busy }: { items: Array<{ key: string; emoji: string; label: string; onPick: () => void }>; busy: string | null }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Where to">
      {items.map((it) => (
        <button key={it.key} type="button" onClick={it.onPick} disabled={busy !== null} className="card tap flex items-center gap-3 rounded-[20px] px-4 py-3 text-left disabled:opacity-60">
          <span className="text-2xl" aria-hidden>
            {it.emoji}
          </span>
          <span className="flex-1 font-semibold">{busy === it.key ? "Working…" : it.label}</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </button>
      ))}
    </div>
  );
}
