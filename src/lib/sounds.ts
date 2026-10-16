/** Tiny synthesised sound effects (Web Audio, no files). Off unless the More toggle is on. */
const SOUNDS_KEY = "tincan-sounds";
export type SoundKind = "ping" | "send" | "win" | "unlock";

export function soundsEnabled(): boolean {
  try {
    return localStorage.getItem(SOUNDS_KEY) === "1";
  } catch {
    return false;
  }
}
export function setSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUNDS_KEY, on ? "1" : "0");
  } catch {
    // fine
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + at);
  g.gain.setValueAtTime(0.0001, c.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at);
  o.stop(c.currentTime + at + dur + 0.05);
}

const RECIPES: Record<SoundKind, (c: AudioContext) => void> = {
  ping: (c) => {
    tone(c, 740, 0, 0.12, "triangle");
    tone(c, 988, 0.1, 0.18, "triangle");
  },
  send: (c) => tone(c, 1320, 0, 0.07, "sine", 0.1),
  win: (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.22, "triangle", 0.16)),
  unlock: (c) => [1568, 1976, 2349, 2637].forEach((f, i) => tone(c, f, i * 0.06, 0.3, "sine", 0.09)),
};

/** Plays if enabled; silently does nothing otherwise. */
export function playSound(kind: SoundKind) {
  if (!soundsEnabled()) return;
  const c = audio();
  if (c) RECIPES[kind](c);
}
