import { getFirebaseAuth } from "@/lib/firebase/client";

/** fetch() against our own API routes with the Firebase ID token attached. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("not_signed_in");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(path, { ...init, headers });
}
