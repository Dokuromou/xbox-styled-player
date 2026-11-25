import type { ThemeId } from "./types";

/**
 * Synthesised UI sounds (no audio files needed). Each theme has its own
 * "voice": Toxic = deep & mechanical, Neon = bright & glassy, Danger = harsh & low.
 */
export type SfxName =
  | "tick"
  | "select"
  | "back"
  | "blade"
  | "on"
  | "off"
  | "play"
  | "pause"
  | "error"
  | "startup"
  | "add"
  | "heart"
  | "toast";

interface Voice {
  wave: OscillatorType;
  base: number;
  accent: OscillatorType;
}

const VOICES: Record<ThemeId, Voice> = {
  toxic: { wave: "square", base: 330, accent: "triangle" },
  neon: { wave: "sine", base: 523, accent: "triangle" },
  danger: { wave: "sawtooth", base: 247, accent: "square" },
};

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let enabled = true;
let hoverEnabled = true;
let volume = 0.5;
let theme: ThemeId = "toxic";
let lastTick = 0;

function ensure(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = volume;
      const comp = ctx.createDynamicsCompressor();
      out.connect(comp);
      comp.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  when = 0,
  slideTo?: number,
  attack = 0.004
) {
  if (!out) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.max(1800, freq * 6);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(lp);
  lp.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(c: AudioContext, dur: number, from: number, to: number, vol: number, when = 0, q = 1.2) {
  if (!out) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t0);
  bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(t0);
}

export const sfx = {
  configure(opts: { enabled?: boolean; volume?: number; hover?: boolean; theme?: ThemeId }) {
    if (opts.enabled !== undefined) enabled = opts.enabled;
    if (opts.hover !== undefined) hoverEnabled = opts.hover;
    if (opts.theme) theme = opts.theme;
    if (opts.volume !== undefined) {
      volume = opts.volume;
      if (out && ctx) out.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    }
  },

  play(name: SfxName) {
    if (!enabled) return;
    if (name === "tick") {
      if (!hoverEnabled) return;
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
    }
    const c = ensure();
    if (!c) return;
    const v = VOICES[theme];
    const b = v.base;
    switch (name) {
      case "tick":
        tone(c, b * 2.6, 0.035, "sine", 0.1);
        break;
      case "select":
        tone(c, b * 1.5, 0.07, v.wave, 0.22);
        tone(c, b * 2.25, 0.14, v.accent, 0.2, 0.05);
        break;
      case "back":
        tone(c, b * 2, 0.07, v.wave, 0.2);
        tone(c, b * 1.2, 0.14, v.accent, 0.2, 0.05);
        break;
      case "blade":
        noise(c, 0.26, 500, 3200, 0.2, 0, 0.9);
        tone(c, b * 0.8, 0.2, v.accent, 0.14, 0, b * 1.8);
        break;
      case "on":
        tone(c, b * 1.5, 0.08, v.accent, 0.2);
        tone(c, b * 2.25, 0.12, v.accent, 0.2, 0.07);
        tone(c, b * 3, 0.18, "sine", 0.16, 0.14);
        break;
      case "off":
        tone(c, b * 3, 0.08, v.accent, 0.18);
        tone(c, b * 2, 0.1, v.accent, 0.18, 0.07);
        tone(c, b * 1.2, 0.2, "sine", 0.16, 0.14);
        break;
      case "play":
        tone(c, b, 0.1, v.wave, 0.2);
        tone(c, b * 1.5, 0.1, v.wave, 0.2, 0.07);
        tone(c, b * 2, 0.22, v.accent, 0.2, 0.14);
        break;
      case "pause":
        tone(c, b * 2, 0.08, v.wave, 0.2);
        tone(c, b, 0.18, v.accent, 0.2, 0.07);
        break;
      case "add":
        tone(c, b * 2, 0.06, "sine", 0.2);
        tone(c, b * 3, 0.14, "sine", 0.2, 0.06);
        break;
      case "heart":
        tone(c, b * 2, 0.09, "sine", 0.22);
        tone(c, b * 3, 0.09, "sine", 0.22, 0.09);
        tone(c, b * 4, 0.22, "triangle", 0.18, 0.18);
        break;
      case "toast":
        tone(c, b * 2.5, 0.12, "sine", 0.2);
        tone(c, b * 3.75, 0.3, "triangle", 0.18, 0.1);
        break;
      case "error":
        tone(c, 190, 0.16, "sawtooth", 0.2);
        tone(c, 140, 0.26, "sawtooth", 0.2, 0.12);
        break;
      case "startup": {
        // Boot chime – a slow swell with shimmering partials
        const root = theme === "danger" ? 82.4 : theme === "toxic" ? 98 : 130.8;
        noise(c, 1.6, 200, 2600, 0.12, 0, 0.7);
        tone(c, root, 1.8, "sine", 0.3, 0, root * 2, 0.35);
        tone(c, root * 1.5, 1.9, "triangle", 0.16, 0.12, undefined, 0.4);
        [4, 5, 6, 8].forEach((m, i) => tone(c, root * m * (theme === "danger" ? 0.75 : 1), 1.1, "sine", 0.1, 0.55 + i * 0.16));
        break;
      }
    }
  },
};

/** Click & hover sounds for every button in the app without wiring each one by hand. */
let installed = false;
export function installGlobalSfx() {
  if (installed) return;
  installed = true;
  const sel = "button,[role='tab'],[role='button'],a[href],summary,[data-sfx]";
  let last: Element | null = null;
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      const kind = el.dataset.sfx;
      if (kind === "none") return;
      sfx.play((kind as SfxName) || "select");
    },
    true
  );
  document.addEventListener(
    "pointerover",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null;
      if (!el || el === last) {
        return;
      }
      last = el;
      if ((el as HTMLButtonElement).disabled || el.dataset.sfxHover === "none") return;
      sfx.play("tick");
    },
    true
  );
  document.addEventListener("pointerout", (e) => {
    if (e.target === last) last = null;
  });
}
