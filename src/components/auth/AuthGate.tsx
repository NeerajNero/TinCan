"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PresenceController } from "@/components/auth/PresenceController";
import { SetupScreen } from "@/components/auth/SetupScreen";
import { TakenScreen } from "@/components/auth/TakenScreen";
import { LiveEventsProvider } from "@/components/live/LiveEventsProvider";
import { PresenceProvider } from "@/components/live/PresenceProvider";
import { PushController } from "@/components/push/PushController";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { Splash } from "@/components/ui/Splash";
import { useAuth } from "@/hooks/useAuth";
import { ChatMetaProvider } from "@/hooks/useChatMeta";
import { PairProvider } from "@/hooks/usePair";

/**
 * Wraps every in-app screen: only an allowlisted, signed-in user gets through,
 * and once through, the pair provider handles onboarding and the shared docs.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/signin");
  }, [status, router]);

  switch (status) {
    case "allowed":
      return (
        <>
          <PresenceController />
          <PairProvider>
            <ChatMetaProvider>
              <ToastProvider>
                <PresenceProvider>
                  <LiveEventsProvider>
                    <PushController />
                    {children}
                  </LiveEventsProvider>
                </PresenceProvider>
              </ToastProvider>
            </ChatMetaProvider>
          </PairProvider>
        </>
      );
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
