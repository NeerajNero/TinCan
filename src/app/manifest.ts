import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tincan",
    short_name: "Tincan",
    description: "A tin-can telephone for two.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7f1",
    theme_color: "#ff8fab",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android's share sheet: the worker turns the POST into /share?id=… (see src/app/sw.ts).
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "files", accept: ["image/*"] }] },
    },
    // Long-press the home-screen icon. Android picks these up on (re)install.
    shortcuts: [
      { name: "Chat", short_name: "Chat", url: "/chat", icons: [{ src: "/icons/shortcut-chat-96.png", sizes: "96x96", type: "image/png", purpose: "maskable" }] },
      { name: "Send a ping", short_name: "Ping", url: "/?ping=1", icons: [{ src: "/icons/shortcut-ping-96.png", sizes: "96x96", type: "image/png", purpose: "maskable" }] },
      { name: "Daily word", short_name: "Word", url: "/play/word", icons: [{ src: "/icons/shortcut-word-96.png", sizes: "96x96", type: "image/png", purpose: "maskable" }] },
      { name: "Pet", short_name: "Pet", url: "/pet", icons: [{ src: "/icons/shortcut-pet-96.png", sizes: "96x96", type: "image/png", purpose: "maskable" }] },
    ],
  };
}
