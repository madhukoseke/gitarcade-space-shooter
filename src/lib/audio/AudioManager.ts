export type SoundName =
  | "laser"
  | "plasma"
  | "hit"
  | "explosion"
  | "bigExplosion"
  | "playerHit"
  | "shield"
  | "powerUp"
  | "dash"
  | "storm"
  | "transform"
  | "ready"
  | "go"
  | "sectorClear"
  | "bossWarning"
  | "bossAppear"
  | "beam"
  | "victory"
  | "gameOver";

type AudioContextCtor = typeof AudioContext;

/**
 * Synthesised arcade sound effects on the Web Audio API. No audio files.
 * The context is created only inside init(), which callers invoke from a user
 * gesture, so nothing plays before the player interacts with the page.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.6;
  private muted = false;
  private readonly lastPlayed = new Map<SoundName, number>();

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    if (typeof window === "undefined") return;
    const w = window as Window & { webkitAudioContext?: AudioContextCtor };
    const Ctor: AudioContextCtor | undefined = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyGain();
    const length = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  suspend(): void {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  /** Releases the audio context. init() may be called again later. */
  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }

  private applyGain(): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.5, this.ctx.currentTime, 0.02);
  }

  private tone(
    type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(from: number, to: number, duration: number, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== "running") return;
    // Rate-limit rapid sounds so a burst of events does not stack into noise.
    const now = ctx.currentTime;
    const minGap = name === "laser" ? 0.05 : name === "hit" ? 0.04 : name === "explosion" ? 0.03 : 0;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < minGap) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case "laser":
        this.tone("square", 880, 220, 0.09, 0.11);
        break;
      case "plasma":
        this.tone("sawtooth", 240, 60, 0.3, 0.2);
        this.tone("sine", 480, 120, 0.3, 0.12);
        break;
      case "hit":
        this.noise(3200, 800, 0.05, 0.14);
        break;
      case "explosion":
        this.noise(1800, 120, 0.28, 0.32);
        this.tone("triangle", 160, 40, 0.22, 0.18);
        break;
      case "bigExplosion":
        this.noise(1400, 60, 0.9, 0.5);
        this.tone("sine", 110, 28, 0.8, 0.35);
        break;
      case "playerHit":
        this.tone("sawtooth", 200, 50, 0.3, 0.3);
        this.noise(900, 100, 0.25, 0.25);
        break;
      case "shield":
        this.tone("sine", 620, 1240, 0.14, 0.16);
        this.tone("sine", 930, 620, 0.2, 0.08, 0.05);
        break;
      case "powerUp":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("square", f, f, 0.09, 0.12, i * 0.06));
        break;
      case "dash":
        this.noise(600, 4000, 0.16, 0.14);
        break;
      case "storm":
        this.noise(300, 5000, 0.5, 0.35);
        this.tone("sawtooth", 90, 720, 0.5, 0.2);
        break;
      case "transform":
        this.tone("sine", 180, 900, 0.9, 0.16);
        this.noise(400, 3000, 0.9, 0.1);
        break;
      case "ready":
        this.tone("square", 440, 440, 0.12, 0.12);
        break;
      case "go":
        this.tone("square", 880, 880, 0.25, 0.15);
        break;
      case "sectorClear":
        [659, 784, 988].forEach((f, i) => this.tone("triangle", f, f, 0.14, 0.16, i * 0.09));
        break;
      case "bossWarning":
        for (let i = 0; i < 3; i++) this.tone("sawtooth", 220, 110, 0.35, 0.18, i * 0.5);
        break;
      case "bossAppear":
        this.tone("sawtooth", 55, 110, 1.1, 0.3);
        this.noise(200, 1200, 1.1, 0.15);
        break;
      case "beam":
        this.tone("sawtooth", 140, 90, 0.9, 0.2);
        this.noise(2400, 600, 0.9, 0.12);
        break;
      case "victory":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("square", f, f, 0.22, 0.14, i * 0.13));
        break;
      case "gameOver":
        [392, 330, 262, 196].forEach((f, i) => this.tone("triangle", f, f * 0.97, 0.3, 0.2, i * 0.22));
        break;
    }
  }
}

export const audio = new AudioManager();
