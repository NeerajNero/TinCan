/**
 * Browser-safe environment. `NEXT_PUBLIC_*` values are inlined at build time, so
 * every one must be referenced literally (no dynamic `process.env[key]`).
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  },
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "",
  cloudinary: {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
    presetImage: process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_IMAGE ?? "tincan_image",
    presetAudio: process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_AUDIO ?? "tincan_audio",
  },
  giphyKey: process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "",
} as const;

/** True when enough Firebase config is present to initialise the client SDK. */
export const firebaseConfigured = Boolean(
  publicEnv.firebase.apiKey && publicEnv.firebase.projectId && publicEnv.firebase.appId,
);
