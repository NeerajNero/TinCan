/**
 * Saved Watch / Listen playlists (playlists/{room}): pure list edits, applied
 * inside a Firestore transaction by src/lib/db/playlists.ts.
 */

export type PlaylistRoom = "watch" | "listen";

export interface PlaylistItem {
  /** 11-char YouTube id. */
  videoId: string;
  /** ≤ 200 chars. */
  title: string;
  addedBy: string;
  /** Client epoch ms (serverTimestamp can't go inside arrays). */
  addedAt: number;
}

export const PLAYLIST_MAX = 50;
const TITLE_MAX = 200;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const isVideoId = (id: string) => VIDEO_ID.test(id);
export const isFull = (items: readonly PlaylistItem[]) => items.length >= PLAYLIST_MAX;
export const hasVideo = (items: readonly PlaylistItem[], videoId: string) => items.some((i) => i.videoId === videoId);

/** Thumbnails are derived, never stored. */
export const playlistThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

/**
 * Append (or insert at `at`, for undo). Unchanged when the video is already
 * there, when the list is full, or when the id isn't a YouTube id.
 */
export function addItem(items: readonly PlaylistItem[], item: PlaylistItem, at?: number): PlaylistItem[] {
  if (!isVideoId(item.videoId) || hasVideo(items, item.videoId) || isFull(items)) return [...items];
  const clean: PlaylistItem = { videoId: item.videoId, title: (item.title.trim() || "YouTube video").slice(0, TITLE_MAX), addedBy: item.addedBy, addedAt: item.addedAt };
  const next = [...items];
  const index = at === undefined ? next.length : Math.max(0, Math.min(at, next.length));
  next.splice(index, 0, clean);
  return next;
}

export function removeItem(items: readonly PlaylistItem[], videoId: string): PlaylistItem[] {
  return items.filter((i) => i.videoId !== videoId);
}

/** Move the item at `from` to index `to` (both clamped); out-of-range `from` is a no-op. */
export function moveItem(items: readonly PlaylistItem[], from: number, to: number): PlaylistItem[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}
