"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { LazyMotion } from "framer-motion";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const loadMotionFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      options={{ scope: "/" }}
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
    >
      {/* `m` components everywhere + one lazily loaded feature bundle: the full `motion` runtime never ships in the route chunks. */}
      <LazyMotion features={loadMotionFeatures}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </LazyMotion>
    </SerwistProvider>
  );
}
