import { uploadToCloudinary } from "@/lib/cloudinary";
import { compressImage } from "@/lib/media/compress";
import type { MediaItem } from "@/lib/types";

/** Compress + upload several photos; progress is the average across files (0–1). */
export async function uploadImages(files: File[], onProgress?: (fraction: number) => void): Promise<MediaItem[]> {
  const progress = files.map(() => 0);
  const report = () => onProgress?.(progress.reduce((a, b) => a + b, 0) / Math.max(1, progress.length));
  return Promise.all(
    files.map(async (file, i) => {
      const { blob, w, h } = await compressImage(file);
      const up = await uploadToCloudinary(blob, {
        kind: "image",
        onProgress: (f) => {
          progress[i] = f;
          report();
        },
      });
      return { url: up.url, publicId: up.publicId, variants: up.variants, w: up.w ?? w, h: up.h ?? h };
    }),
  );
}
