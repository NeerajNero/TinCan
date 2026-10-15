import imageCompression from "browser-image-compression";

let webpSupport: boolean | null = null;

/** Canvas-encode test, cached. */
export function supportsWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export interface CompressedImage {
  blob: Blob;
  w: number;
  h: number;
}

/** ≤1080 px on the long edge, ~0.3 MB, WebP when the browser can encode it. */
export async function compressImage(file: File): Promise<CompressedImage> {
  const fileType = supportsWebP() ? "image/webp" : "image/jpeg";
  const blob = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1080,
    useWebWorker: true,
    fileType,
    initialQuality: 0.82,
  });
  const { w, h } = await readDimensions(blob);
  return { blob, w, h };
}

export function readDimensions(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_unreadable"));
    };
    img.src = url;
  });
}
