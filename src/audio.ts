let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio(): void {
  ac();
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.06,
  delay = 0,
): void {
  const audio = ac();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  snap: () => {
    tone(880, 0.08, "square", 0.05);
    tone(1320, 0.06, "square", 0.04, 0.07);
  },
  throw: () => tone(420, 0.14, "sawtooth", 0.04),
  catch: () => {
    tone(660, 0.08, "triangle", 0.07);
    tone(990, 0.1, "triangle", 0.05, 0.05);
  },
  tackle: () => tone(90, 0.18, "sawtooth", 0.08),
  whistle: () => {
    tone(1840, 0.22, "square", 0.045);
    tone(1840, 0.12, "square", 0.03, 0.28);
  },
  firstDown: () => {
    tone(520, 0.1, "square", 0.05);
    tone(780, 0.16, "square", 0.05, 0.1);
  },
  touchdown: () => {
    tone(392, 0.16, "square", 0.06);
    tone(523, 0.16, "square", 0.06, 0.14);
    tone(659, 0.16, "square", 0.06, 0.28);
    tone(784, 0.32, "square", 0.07, 0.42);
  },
  ability: () => {
    tone(300, 0.08, "triangle", 0.05);
    tone(600, 0.12, "triangle", 0.05, 0.06);
  },
  incomplete: () => tone(180, 0.2, "triangle", 0.05),
};
