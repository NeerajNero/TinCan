/**
 * Browser side of the share stash: read what the worker put in the Cache API
 * for `/share?id=…`, rebuild the files, and clear it once used.
 */
import { isShareId, SHARE_CACHE, SHARE_MAX_AGE_MS, shareFileKey, shareMetaKey, type ShareMeta } from "@/lib/share";

export interface ShareStash {
  meta: ShareMeta;
  files: File[];
}

export async function readShareStash(id: string | null): Promise<ShareStash | null> {
  if (!isShareId(id) || typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(shareMetaKey(id));
    if (!res) return null;
    const meta = (await res.json()) as ShareMeta;
    if (Date.now() - (meta.at ?? 0) > SHARE_MAX_AGE_MS) {
      await clearShareStash(id);
      return null;
    }
    const files: File[] = [];
    for (let i = 0; i < meta.files.length; i++) {
      const f = meta.files[i];
      const r = await cache.match(shareFileKey(id, i));
      if (!r || !f) continue;
      files.push(new File([await r.blob()], f.name || `photo-${i + 1}.jpg`, { type: f.type || "image/jpeg" }));
    }
    return { meta, files };
  } catch {
    return null;
  }
}

export async function clearShareStash(id: string | null): Promise<void> {
  if (!isShareId(id) || typeof caches === "undefined") return;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const keys = await cache.keys();
    await Promise.all(keys.filter((req) => new URL(req.url).pathname.startsWith(shareMetaKey(id))).map((req) => cache.delete(req)));
  } catch {
    // nothing to clear
  }
}
