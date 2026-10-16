/** browser-image-compression (≈50 KB) loads on the first upload, not with the chat route. */
const loadCompressor = () => import("browser-image-compression").then((mod) => mod.default);

let webpSupport: boolean | null = null;

/** Canvas-encode test, cached. */
function supportsWebP(): boolean {
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

interface CompressOptions {
  maxWidthOrHeight?: number;
  maxSizeMB?: number;
}

/** ≤1080 px on the long edge, ~0.3 MB by default, WebP when the browser can encode it. */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<CompressedImage> {
  const fileType = supportsWebP() ? "image/webp" : "image/jpeg";
  const blob = await (await loadCompressor())(file, {
    maxSizeMB: options.maxSizeMB ?? 0.3,
    maxWidthOrHeight: options.maxWidthOrHeight ?? 1080,
    useWebWorker: true,
    fileType,
    initialQuality: 0.82,
  });
  const { w, h } = await readDimensions(blob);
  return { blob, w, h };
}

function readDimensions(blob: Blob): Promise<{ w: number; h: number }> {
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
