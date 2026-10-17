/**
 * playlists/{watch|listen}: one doc per room, `{ items, updatedAt, updatedBy }`.
 * Every edit is a transaction over the pure helpers in src/lib/playlist.ts, so
 * two phones editing at once never lose each other's change.
 */
import { getDb } from "@/lib/firebase/client";
import { doc, onSnapshot, runTransaction, serverTimestamp, type DocumentReference, type FieldValue } from "@/lib/firebase/fs";
import { addItem, hasVideo, isFull, moveItem, removeItem, type PlaylistItem, type PlaylistRoom } from "@/lib/playlist";

interface PlaylistDoc {
  items: PlaylistItem[];
  updatedAt: FieldValue | null;
  updatedBy: string;
}

export class PlaylistFullError extends Error {
  constructor() {
    super("Playlist is full — remove one first");
  }
}

const playlistRef = (room: PlaylistRoom) => doc(getDb(), "playlists", room) as DocumentReference<PlaylistDoc>;

export function subscribePlaylist(room: PlaylistRoom, cb: (items: PlaylistItem[]) => void): () => void {
  return onSnapshot(playlistRef(room), (snap) => cb(snap.data()?.items ?? []), () => cb([]));
}

async function edit(room: PlaylistRoom, uid: string, apply: (items: PlaylistItem[]) => PlaylistItem[]): Promise<void> {
  const ref = playlistRef(room);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data()?.items ?? [];
    const next = apply(current);
    if (next.length === current.length && next.every((item, i) => item.videoId === current[i]?.videoId)) return;
    tx.set(ref, { items: next, updatedAt: serverTimestamp(), updatedBy: uid });
  });
}

/** Save a video (or put a removed one back at `at`). Throws PlaylistFullError at 50. */
export function savePlaylistItem(room: PlaylistRoom, uid: string, item: PlaylistItem, at?: number): Promise<void> {
  return edit(room, uid, (items) => {
    if (!hasVideo(items, item.videoId) && isFull(items)) throw new PlaylistFullError();
    return addItem(items, item, at);
  });
}

export const removePlaylistItem = (room: PlaylistRoom, uid: string, videoId: string) => edit(room, uid, (items) => removeItem(items, videoId));

/** Move a video to `to`, located by id so a concurrent edit can't move the wrong row. */
export const movePlaylistItem = (room: PlaylistRoom, uid: string, videoId: string, to: number) =>
  edit(room, uid, (items) => moveItem(items, items.findIndex((i) => i.videoId === videoId), to));
