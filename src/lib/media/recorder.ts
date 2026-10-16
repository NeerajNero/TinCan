/**
 * Hold-to-record voice notes. Opus in WebM at 32 kbps where supported, with a
 * fallback to whatever the browser can encode. Hard cap of two minutes.
 */
const MAX_VOICE_MS = 2 * 60 * 1000;

const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED.find((t) => MediaRecorder.isTypeSupported(t));
}

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export interface Recording {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private onCap: (() => void) | null = null;

  /** Asks for the mic (first time prompts) and starts capturing. */
  async start(onCap?: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
    this.startedAt = Date.now();
    this.onCap = onCap ?? null;
    this.capTimer = setTimeout(() => this.onCap?.(), MAX_VOICE_MS);
  }

  get elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  /** Stops and resolves with the finished clip. */
  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) {
        reject(new Error("not_recording"));
        return;
      }
      const durationMs = Math.min(this.elapsedMs, MAX_VOICE_MS);
      rec.onstop = () => {
        const mimeType = rec.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve({ blob, durationMs, mimeType });
      };
      rec.onerror = () => {
        this.cleanup();
        reject(new Error("recorder_error"));
      };
      if (rec.state !== "inactive") rec.stop();
    });
  }

  /** Stops and throws everything away. */
  cancel(): void {
    const rec = this.recorder;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.capTimer) clearTimeout(this.capTimer);
    this.capTimer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
  }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
