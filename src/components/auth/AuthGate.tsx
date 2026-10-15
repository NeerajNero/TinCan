"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SetupScreen } from "@/components/auth/SetupScreen";
import { TakenScreen } from "@/components/auth/TakenScreen";
import { Splash } from "@/components/ui/Splash";
import { useAuth } from "@/hooks/useAuth";

/** Wraps every in-app screen: only an allowlisted, signed-in user gets through. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/signin");
  }, [status, router]);

  switch (status) {
    case "allowed":
      return <>{children}</>;
    case "denied":
      return <TakenScreen />;
    case "error":
      return <SetupScreen message={error} />;
    case "checking":
      return <Splash label="Checking whose tin can this is…" />;
    default:
      return <Splash />;
  }
}
