import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cache Components is intentionally left off. Tincan renders everything on the
  // client against Firebase, and @serwist/turbopack's route handler exports the
  // classic segment configs (`dynamic`, `revalidate`) that Next 16 rejects when
  // `cacheComponents` is enabled.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
    const dbHost = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "").host;
      } catch {
        return "";
      }
    })();
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      // Next inlines small bootstrap scripts and the theme-init script; YouTube's IFrame API and Google sign-in load their own.
      "script-src 'self' 'unsafe-inline' https://www.youtube.com https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.giphy.com https://i.ytimg.com https://*.ytimg.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      "media-src 'self' blob: https://res.cloudinary.com https://stream.radioparadise.com https://icecast.radiofrance.fr",
      `frame-src https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com${authDomain ? ` https://${authDomain}` : ""}`,
      `connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com wss://*.firebasedatabase.app https://*.firebasedatabase.app${dbHost ? ` wss://${dbHost} https://${dbHost}` : ""} https://api.cloudinary.com https://api.giphy.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://www.youtube.com https://stream.radioparadise.com https://icecast.radiofrance.fr`,
    ].join("; ");
    const securityHeaders = [
      { key: "Content-Security-Policy-Report-Only", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(self), camera=(), display-capture=(), encrypted-media=(self), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), midi=(), payment=(), picture-in-picture=(self), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Never let a CDN pin an old service worker.
        source: "/serwist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
