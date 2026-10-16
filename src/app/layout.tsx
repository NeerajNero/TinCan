import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { WebVitals } from "@/components/providers/WebVitals";
import { themeInitScript } from "@/lib/theme";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-nunito",
  display: "swap",
});

const APP_NAME = "Tincan";
const APP_DESCRIPTION = "A tin-can telephone for two.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#141a2e" },
  ],
};

/**
 * Async because it reads the per-request CSP nonce (src/proxy.ts). That makes
 * every page dynamically rendered, the price of a script-src without
 * 'unsafe-inline': Next's inline bootstrap scripts can only be allowed by nonce.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved/OS theme before first paint to avoid a flash. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <WebVitals />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
