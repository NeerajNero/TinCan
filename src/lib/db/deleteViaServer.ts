import { authedFetch } from "@/lib/api";

export type ServerDeleteKind = "message" | "memory" | "journal" | "capsule";

/** Owner-only delete that also destroys Cloudinary assets. Throws on a non-2xx. */
export async function deleteViaServer(kind: ServerDeleteKind, id: string): Promise<void> {
  const res = await authedFetch("/api/media", { method: "DELETE", body: JSON.stringify({ kind, id }) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `delete_${res.status}`);
  }
}
