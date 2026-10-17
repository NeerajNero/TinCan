"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { movePlaylistItem, PlaylistFullError, removePlaylistItem, savePlaylistItem, subscribePlaylist } from "@/lib/db/playlists";
import type { PlaylistItem, PlaylistRoom } from "@/lib/playlist";
import { errorMessage, swallow } from "@/lib/swallow";

const UNDO_MS = 4000;

/**
 * The room's saved playlist (one Firestore listener, attached while the screen
 * is mounted) plus edits that report through toasts: "full" on the 51st save,
 * and an Undo toast after a removal.
 */
export function usePlaylist(room: PlaylistRoom, uid: string) {
  const [items, setItems] = useState<PlaylistItem[] | null>(null);
  const { toast } = useToast();

  useEffect(() => subscribePlaylist(room, setItems), [room]);

  const save = useCallback(
    async (videoId: string, title: string) => {
      try {
        await savePlaylistItem(room, uid, { videoId, title, addedBy: uid, addedAt: Date.now() });
      } catch (err) {
        toast({ key: "playlist", emoji: "★", title: err instanceof PlaylistFullError ? err.message : errorMessage(err, "Couldn't save that one"), vibrate: false });
      }
    },
    [room, uid, toast],
  );

  const remove = useCallback(
    (videoId: string) => {
      const index = items?.findIndex((i) => i.videoId === videoId) ?? -1;
      const item = index >= 0 ? items?.[index] : undefined;
      if (!item) return;
      removePlaylistItem(room, uid, videoId)
        .then(() =>
          toast({
            key: "playlist",
            emoji: "★",
            title: "Removed from playlist",
            body: "Tap to undo",
            durationMs: UNDO_MS,
            vibrate: false,
            onTap: () => void savePlaylistItem(room, uid, item, index).catch(swallow),
          }),
        )
        .catch(swallow);
    },
    [items, room, uid, toast],
  );

  const move = useCallback((videoId: string, to: number) => void movePlaylistItem(room, uid, videoId, to).catch(swallow), [room, uid]);

  return { items, save, remove, move };
}
