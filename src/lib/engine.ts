import type { EqState } from "./types";

export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ["31", "62", "125", "250", "500", "1K", "2K", "4K", "8K", "16K"];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  Vocal: [-3, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Rock: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
  Pop: [-1, 2, 4, 5, 3, 0, -1, -1, 1, 2],
  Electronic: [6, 5, 2, 0, -2, 2, 1, 3, 5, 6],
  "Hip-Hop": [6, 5, 3, 3, -1, -1, 2, 0, 2, 3],
  Acoustic: [4, 3, 2, 1, 2, 2, 3, 3, 3, 2],
  Jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
  Loudness: [6, 4, 0, 0, -2, 0, -1, -4, 5, 1],
  "Late Night": [3, 2, 1, 0, 0, -1, -2, -3, -4, -5],
};

export const DEFAULT_EQ: EqState = {
  enabled: true,
  gains: EQ_PRESETS.Flat.slice(),
  preamp: 0,
  preset: "Flat",
  limiter: true,
};

const dbToGain = (db: number) => Math.pow(10, db / 20);

function silentWavUrl(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i);
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, n, true);
  b.fill(128, 44);
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return `data:audio/wav;base64,${btoa(s)}`;
}

class Engine {
  readonly audio: HTMLAudioElement;
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private pre: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private limiter: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private eq: EqState = { ...DEFAULT_EQ, gains: DEFAULT_EQ.gains.slice() };
  private volume = 0.8;
  private muted = false;
  private fade = 1;
  private unlocked = false;
  /** true while the silent "unlock" clip is running – the store ignores media events then */
  unlocking = false;
  private freqBuf: Uint8Array<ArrayBuffer> | null = null;
  private waveBuf: Uint8Array<ArrayBuffer> | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "");
    this.audio.volume = this.volume;
  }

  /**
   * Mobile browsers only let an <audio> element start from a user gesture. Playing a tiny silent clip on the
   * very first touch "unlocks" the element so later programmatic playback (next track, async loads) works.
   */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const a = this.audio;
    if (a.getAttribute("src")) return;
    const url = silentWavUrl();
    this.unlocking = true;
    a.muted = true;
    a.src = url;
    const finish = () => {
      a.muted = false;
      this.unlocking = false;
    };
    a.play()
      .then(() => {
        if (this.unlocking && a.src === url) {
          a.pause();
          a.removeAttribute("src");
          a.load();
        }
        finish();
      })
      .catch(finish);
  }

  /** Builds the Web Audio graph. Must be called from a user gesture the first time. */
  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(this.audio);
      const pre = ctx.createGain();
      const filters = EQ_FREQS.map((f, i) => {
        const bq = ctx.createBiquadFilter();
        bq.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
        bq.frequency.value = f;
        bq.Q.value = 1.1;
        bq.gain.value = 0;
        return bq;
      });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      analyser.minDecibels = -88;
      analyser.maxDecibels = -12;
      const limiter = ctx.createDynamicsCompressor();
      limiter.knee.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      const master = ctx.createGain();

      let node: AudioNode = src;
      node.connect(pre);
      node = pre;
      for (const f of filters) {
        node.connect(f);
        node = f;
      }
      node.connect(analyser);
      analyser.connect(limiter);
      limiter.connect(master);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.pre = pre;
      this.filters = filters;
      this.analyser = analyser;
      this.limiter = limiter;
      this.master = master;
      this.freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.waveBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      this.audio.volume = 1;
      this.applyEq();
      this.applyMaster(true);
    } catch (e) {
      console.warn("Web Audio unavailable, falling back to plain playback", e);
      this.ctx = null;
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v;
    this.muted = muted;
    this.applyMaster();
  }

  /** 0..1 multiplier used by the sleep timer fade-out */
  setFade(f: number) {
    this.fade = Math.max(0, Math.min(1, f));
    this.applyMaster();
  }

  private applyMaster(immediate = false) {
    const level = this.muted ? 0 : Math.pow(this.volume, 1.8) * this.fade;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      if (immediate) this.master.gain.setValueAtTime(level, t);
      else this.master.gain.setTargetAtTime(level, t, 0.03);
    } else {
      this.audio.volume = Math.max(0, Math.min(1, level));
    }
  }

  setEq(eq: EqState) {
    this.eq = { ...eq, gains: eq.gains.slice() };
    this.applyEq();
  }

  private applyEq() {
    if (!this.ctx || !this.pre || !this.limiter) return;
    const t = this.ctx.currentTime;
    const { enabled, gains, preamp, limiter } = this.eq;
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? gains[i] ?? 0 : 0, t, 0.02));
    this.pre.gain.setTargetAtTime(enabled ? dbToGain(preamp) : 1, t, 0.02);
    this.limiter.threshold.setTargetAtTime(limiter ? -4 : 0, t, 0.02);
    this.limiter.ratio.setTargetAtTime(limiter ? 14 : 1, t, 0.02);
  }

  getFrequency(): Uint8Array | null {
    if (!this.analyser || !this.freqBuf) return null;
    this.analyser.getByteFrequencyData(this.freqBuf);
    return this.freqBuf;
  }

  getWaveform(): Uint8Array | null {
    if (!this.analyser || !this.waveBuf) return null;
    this.analyser.getByteTimeDomainData(this.waveBuf);
    return this.waveBuf;
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? 44100;
  }
}

export const engine = new Engine();
