"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";

/** Renders nothing; keeps presence/{me} in sync while signed in. */
export function PresenceController() {
  const { user } = useAuth();
  const pathname = usePathname();
  usePresence(user?.uid ?? null, pathname);
  return null;
}
