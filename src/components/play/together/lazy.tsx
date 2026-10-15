"use client";

import dynamic from "next/dynamic";

import { ListSkeleton } from "@/components/ui/Skeleton";

/** Heavy canvases load on demand, not with the Play bundle. */
export const LazyWhiteboard = dynamic(() => import("@/components/play/together/WhiteboardScreen").then((m) => m.WhiteboardScreen), { ssr: false, loading: () => <ListSkeleton rows={2} tall /> });
export const LazyPixel = dynamic(() => import("@/components/play/together/PixelScreen").then((m) => m.PixelScreen), { ssr: false, loading: () => <ListSkeleton rows={2} tall /> });
export const LazyYouTubePlayer = dynamic(() => import("@/components/play/together/YouTubePlayer").then((m) => m.YouTubePlayer), { ssr: false });
