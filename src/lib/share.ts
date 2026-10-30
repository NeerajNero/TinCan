/**
 * Share into Tincan (Android Web Share Target). The service worker answers
 * `POST /share` by stashing the form data in the Cache API under a nonce and
 * redirecting to `/share?id=<nonce>`; the page reads the stash, shows the
 * destinations and clears it. This module is the pure part: keys, the
 * content classification and the chat text. Imported by the worker too, so
 * it stays dependency-free (relative imports only).
 */
import { parseYouTubeId } from "./youtube";

export const SHARE_CACHE = "tincan-share";
export const SHARE_MAX_FILES = 10;
/** A stash older than this is dropped on open (the share sheet was abandoned). */
export const SHARE_MAX_AGE_MS = 30 * 60_000;

export const shareMetaKey = (id: string) => `/share-stash/${id}`;
export const shareFileKey = (id: string, index: number) => `/share-stash/${id}/file/${index}`;
export const isShareId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);

export interface ShareFileMeta {
  name: string;
  type: string;
  size: number;
}
export interface ShareMeta {
  title: string;
  text: string;
  url: string;
  files: ShareFileMeta[];
  /** Epoch ms when the worker stashed it. */
  at: number;
}

type ShareKind = "youtube" | "images" | "link" | "text" | "empty";

export interface ShareClassification {
  kind: ShareKind;
  videoId: string | null;
  url: string | null;
  title: string;
  text: string;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

/** The first http(s) link inside free text (Android often puts the link in `text`, not `url`). */
export function extractUrl(text: string): string | null {
  const m = URL_RE.exec(text);
  if (!m) return null;
  try {
    return new URL(m[0].replace(/[.,;:!?]+$/, "")).href;
  } catch {
    return null;
  }
}

const isImage = (f: Pick<ShareFileMeta, "type">) => f.type.startsWith("image/");

export function classifyShare(meta: Pick<ShareMeta, "title" | "text" | "url"> & { files: ReadonlyArray<Pick<ShareFileMeta, "type">> }): ShareClassification {
  const title = meta.title.trim();
  const text = meta.text.trim();
  const url = (meta.url.trim() && extractUrl(meta.url)) || extractUrl(text) || extractUrl(title);
  if (meta.files.some(isImage)) return { kind: "images", videoId: null, url, title, text };
  if (url) {
    const videoId = parseYouTubeId(url);
    return { kind: videoId ? "youtube" : "link", videoId, url, title, text };
  }
  if (text || title) return { kind: "text", videoId: null, url: null, title, text };
  return { kind: "empty", videoId: null, url: null, title: "", text: "" };
}

/** What "Send to chat" posts: title, text and link, each once, in that order. */
export function shareChatText(c: Pick<ShareClassification, "title" | "text" | "url">): string {
  const lines: string[] = [];
  const push = (s: string | null) => {
    const v = (s ?? "").trim();
    if (v && !lines.some((l) => l.includes(v))) lines.push(v);
  };
  push(c.title);
  push(c.text);
  push(c.url);
  return lines.join("\n").slice(0, 2000);
}

/** A `next` parameter is honoured only as a same-origin path (`/share?id=…`), never `//host` or a scheme. */
export function sameOriginPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length > 300) return null;
  return /^\/(?![/\\])[^\s]*$/.test(raw) ? raw : null;
}
