import type { Track } from "./types";
import type { ImportHooks } from "./metadata";
import { db } from "./db";
import { uid } from "./format";
import { toLrcStamp } from "./lrc";

/**
 * Procedurally generated demo tracks (synth + drums rendered to WAV in the
 * browser) so the UI can be explored without owning any music files.
 */
const SR = 22050;
const NOTE: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
type Wave = "saw" | "square" | "tri" | "sine";

interface Spec {
  title: string;
  bpm: number;
  root: string;
  scale: keyof typeof SCALES;
  prog: number[];
  lead: Wave;
  seed: number;
  lyrics: string;
}

interface AlbumSpec {
  album: string;
  artist: string;
  year: number;
  genre: string;
  hue: number;
  kind: "synth" | "toxic" | "danger";
  tracks: Spec[];
}

const ALBUMS: AlbumSpec[] = [
  {
    album: "Neon Highway",
    artist: "Pixel Drift",
    year: 2024,
    genre: "Synthwave",
    hue: 205,
    kind: "synth",
    tracks: [
      {
        title: "Midnight Run",
        bpm: 108,
        root: "A",
        scale: "minor",
        prog: [0, 5, 3, 4],
        lead: "saw",
        seed: 11,
        lyrics:
          "Engine hum beneath the city lights/Chrome and starlight on the glass/We are running through the midnight/Never looking at the past/Hold the wheel and hold me tighter/Every signal turns to green/Take the road that leads to nowhere/Neon rivers in between",
      },
      {
        title: "Chrome Skyline",
        bpm: 100,
        root: "F",
        scale: "minor",
        prog: [0, 3, 5, 4],
        lead: "square",
        seed: 23,
        lyrics:
          "Towers rise in electric rain/Mirrors fold the evening sky/Every window hums a refrain/As the satellites float by/Cities glow like a memory/Painted in a violet hue/Chrome and silence, you and me/Lost inside the view",
      },
      {
        title: "Afterglow",
        bpm: 92,
        root: "D",
        scale: "dorian",
        prog: [0, 4, 5, 3],
        lead: "tri",
        seed: 37,
        lyrics:
          "When the night begins to fade/And the dashboard fills with gold/Every promise that we made/Still is warm against the cold/Let the afterglow remain/Let the radio play on/We will find the road again/Somewhere just beyond the dawn",
      },
    ],
  },
  {
    album: "Toxic Garden",
    artist: "Bio Hazard Orchestra",
    year: 2022,
    genre: "Electronic",
    hue: 100,
    kind: "toxic",
    tracks: [
      {
        title: "Spore Bloom",
        bpm: 120,
        root: "E",
        scale: "phrygian",
        prog: [0, 1, 0, 6],
        lead: "square",
        seed: 41,
        lyrics:
          "Green light seeping through the floor/Something's growing at the door/Petals open, pulses glow/Breathe it in and let it flow/Spore by spore the garden grows/Nobody knows how far it goes/Taste the air, it's sweet and bright/Dancing in the toxic light",
      },
      {
        title: "Glowing Moss",
        bpm: 128,
        root: "C",
        scale: "minor",
        prog: [0, 0, 5, 6],
        lead: "saw",
        seed: 53,
        lyrics:
          "Soft and bright on broken stone/Colors that were never known/Underground the engines hum/Waiting for the night to come/Glowing moss across the wall/Whispers echo down the hall/Every step a pulse of green/Brightest thing we've ever seen",
      },
      {
        title: "Reactor Lullaby",
        bpm: 84,
        root: "G",
        scale: "minor",
        prog: [0, 5, 2, 6],
        lead: "tri",
        seed: 67,
        lyrics:
          "Sleep now, little atom, sleep/Secrets are the ones we keep/Hum the song of copper wire/Cooling in the quiet fire/Dream of rivers made of light/Drifting softly through the night/Safe and sound inside the core/Close your eyes, there's nothing more",
      },
    ],
  },
  {
    album: "Danger Zone",
    artist: "Red Alert",
    year: 2021,
    genre: "Industrial",
    hue: 355,
    kind: "danger",
    tracks: [
      {
        title: "Sirens",
        bpm: 136,
        root: "D",
        scale: "minor",
        prog: [0, 0, 6, 5],
        lead: "saw",
        seed: 71,
        lyrics:
          "Lights are flashing, run for cover/Every second counts/Metal screaming, one another/Louder than the sound/Sirens in the dark/Sirens in the dark/Feel the thunder in your chest/Sirens in the dark",
      },
      {
        title: "Overheat",
        bpm: 144,
        root: "B",
        scale: "phrygian",
        prog: [0, 1, 5, 1],
        lead: "square",
        seed: 83,
        lyrics:
          "Pressure rising, red to white/Gauges bend and burn/Push it past the edge tonight/There's no way to turn/Overheat, overheat/Feel the fever in the beat/Hold the line and take the heat/Overheat",
      },
      {
        title: "Failsafe",
        bpm: 112,
        root: "A",
        scale: "minor",
        prog: [0, 3, 4, 0],
        lead: "saw",
        seed: 97,
        lyrics:
          "Count it down from ten to one/Every system's on the run/Trust the code and trust the wire/Failsafe holding through the fire/If the lights go out tonight/We will keep the signal bright/Count it down and let it go/Failsafe, steady, slow",
      },
    ],
  },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function voice(
  buf: Float32Array,
  t0: number,
  dur: number,
  hz: number,
  wave: Wave,
  amp: number,
  atk: number,
  rel: number,
  decay = 0,
  detune = 0
) {
  const n0 = Math.floor(t0 * SR);
  const n = Math.floor((dur + rel) * SR);
  let ph = 0.13;
  const inc = (hz * (1 + detune)) / SR;
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= buf.length) break;
    const t = i / SR;
    let env = Math.min(1, t / atk);
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel);
    if (decay) env *= Math.exp(-decay * t);
    ph += inc;
    const p = ph - Math.floor(ph);
    let x: number;
    switch (wave) {
      case "saw":
        x = 2 * p - 1;
        break;
      case "square":
        x = p < 0.5 ? 1 : -1;
        break;
      case "tri":
        x = 4 * Math.abs(p - 0.5) - 1;
        break;
      default:
        x = Math.sin(2 * Math.PI * p);
    }
    buf[idx] += x * env * amp;
  }
}

function kick(buf: Float32Array, t0: number, amp = 0.9) {
  const n0 = Math.floor(t0 * SR);
  const n = Math.floor(0.3 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= buf.length) break;
    const t = i / SR;
    ph += (42 + 120 * Math.exp(-t * 30)) / SR;
    buf[idx] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 9) * amp;
  }
}

function snare(buf: Float32Array, t0: number, rand: () => number, amp = 0.38) {
  const n0 = Math.floor(t0 * SR);
  const n = Math.floor(0.2 * SR);
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= buf.length) break;
    const t = i / SR;
    buf[idx] += (rand() * 2 - 1) * Math.exp(-t * 20) * amp + Math.sin(2 * Math.PI * 188 * t) * Math.exp(-t * 28) * amp * 0.5;
  }
}

function hat(buf: Float32Array, t0: number, rand: () => number, amp = 0.12) {
  const n0 = Math.floor(t0 * SR);
  const n = Math.floor(0.06 * SR);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= buf.length) break;
    const t = i / SR;
    const r = rand() * 2 - 1;
    buf[idx] += (r - prev) * 0.5 * Math.exp(-t * 70) * amp;
    prev = r;
  }
}

function lowpass(buf: Float32Array, a: number) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
}

function renderTrack(spec: Spec, seconds: number): Float32Array {
  const rand = rng(spec.seed);
  const beat = 60 / spec.bpm;
  const bars = Math.max(4, Math.round(seconds / (beat * 4)));
  const len = Math.floor((bars * beat * 4 + 1.4) * SR);
  const drums = new Float32Array(len);
  const bass = new Float32Array(len);
  const pad = new Float32Array(len);
  const lead = new Float32Array(len);
  const rootMidi = 24 + NOTE[spec.root];
  const scale = SCALES[spec.scale];
  const degree = (d: number, oct = 0) => {
    const o = Math.floor(d / 7);
    const i = ((d % 7) + 7) % 7;
    return rootMidi + scale[i] + 12 * (o + oct);
  };

  // melody motif (stable per track so it feels like a hook)
  const motif = Array.from({ length: 16 }, () => (rand() < 0.28 ? -1 : [0, 2, 4, 7, 4, 2, 9][Math.floor(rand() * 7)]));

  for (let bar = 0; bar < bars; bar++) {
    const t = bar * 4 * beat;
    const deg = spec.prog[bar % spec.prog.length];
    // pad chord
    [0, 2, 4].forEach((o) => {
      const hz = midiHz(degree(deg + o, 2));
      voice(pad, t, beat * 3.9, hz, "saw", 0.045, 0.35, 0.5, 0, 0.004);
      voice(pad, t, beat * 3.9, hz, "saw", 0.045, 0.35, 0.5, 0, -0.004);
    });
    // bass
    for (let s = 0; s < 8; s++) {
      if (rand() < 0.12) continue;
      const hz = midiHz(degree(s % 4 === 3 ? deg + 4 : deg, 1));
      voice(bass, t + (s * beat) / 2, beat * 0.42, hz, "square", 0.2, 0.006, 0.1);
    }
    // drums
    for (let b = 0; b < 4; b++) {
      const tb = t + b * beat;
      kick(drums, tb);
      if (b % 2 === 1) snare(drums, tb, rand);
      hat(drums, tb, rand, 0.09);
      hat(drums, tb + beat / 2, rand, 0.15);
      if (bar % 4 === 3 && b === 3) {
        hat(drums, tb + beat / 4, rand, 0.12);
        hat(drums, tb + (beat * 3) / 4, rand, 0.12);
      }
    }
    // lead – only after the first two bars so there is an intro
    if (bar >= 2) {
      for (let s = 0; s < 16; s++) {
        const m = motif[s];
        if (m < 0) continue;
        const hz = midiHz(degree(deg + m, 3));
        voice(lead, t + (s * beat) / 4, beat * 0.3, hz, spec.lead, 0.07, 0.004, 0.08, 5);
      }
    }
  }

  lowpass(pad, 0.1);
  lowpass(bass, 0.22);
  lowpass(lead, 0.5);

  // echo on the lead
  const d = Math.floor((beat * 3 * SR) / 4);
  for (let i = d; i < lead.length; i++) lead[i] += lead[i - d] * 0.38;

  const out = new Float32Array(len);
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const phase = (i / SR) % beat;
    const duck = 1 - 0.55 * Math.exp(-phase * 9);
    const v = drums[i] + bass[i] * duck + pad[i] * duck + lead[i];
    out[i] = Math.tanh(v * 1.1);
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  const norm = peak > 0 ? 0.88 / peak : 1;
  const fadeIn = Math.floor(0.02 * SR);
  const fadeOut = Math.floor(1.2 * SR);
  for (let i = 0; i < len; i++) {
    let g = norm;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > len - fadeOut) g *= (len - i) / fadeOut;
    out[i] *= g;
  }
  return out;
}

function toWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

function drawCover(a: AlbumSpec): Promise<Blob | null> {
  const S = 480;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d");
  if (!g) return Promise.resolve(null);
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, `hsl(${a.hue + 40} 80% 12%)`);
  bg.addColorStop(1, `hsl(${a.hue} 70% 5%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  if (a.kind === "synth") {
    // sunset + perspective grid
    const sun = g.createLinearGradient(0, 90, 0, 290);
    sun.addColorStop(0, "#37d4ff");
    sun.addColorStop(1, "#5a4bff");
    g.fillStyle = sun;
    g.beginPath();
    g.arc(S / 2, 230, 130, Math.PI, 0);
    g.fill();
    g.fillStyle = `hsl(${a.hue + 40} 80% 10%)`;
    for (let i = 0; i < 6; i++) g.fillRect(S / 2 - 140, 170 + i * 16, 280, 3 + i * 1.6);
    g.fillStyle = "#050a1c";
    g.fillRect(0, 230, S, S - 230);
    g.strokeStyle = "rgba(60,200,255,.85)";
    g.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      g.beginPath();
      g.moveTo(S / 2 + i * 16, 230);
      g.lineTo(S / 2 + i * 120, S);
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const y = 230 + Math.pow(i / 8, 2) * 250;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(S, y);
      g.stroke();
    }
  } else if (a.kind === "toxic") {
    // radioactive trefoil
    g.fillStyle = "#07120a";
    g.fillRect(0, 0, S, S);
    const glow = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, 260);
    glow.addColorStop(0, "rgba(155,227,45,.55)");
    glow.addColorStop(1, "rgba(155,227,45,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    g.fillStyle = "#9be32d";
    for (let k = 0; k < 3; k++) {
      const a0 = (k * 2 * Math.PI) / 3 - Math.PI / 2 - Math.PI / 6;
      g.beginPath();
      g.moveTo(S / 2, S / 2);
      g.arc(S / 2, S / 2, 150, a0, a0 + Math.PI / 3);
      g.closePath();
      g.fill();
    }
    g.fillStyle = "#07120a";
    g.beginPath();
    g.arc(S / 2, S / 2, 38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#9be32d";
    g.beginPath();
    g.arc(S / 2, S / 2, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(155,227,45,.4)";
    g.lineWidth = 3;
    for (let r = 175; r < 260; r += 28) {
      g.beginPath();
      g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  } else {
    // hazard stripes + warning triangle
    g.fillStyle = "#12020a";
    g.fillRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-Math.PI / 4);
    for (let i = -14; i < 14; i++) {
      g.fillStyle = i % 2 ? "rgba(255,61,72,.28)" : "rgba(0,0,0,.2)";
      g.fillRect(i * 34, -400, 34, 800);
    }
    g.restore();
    const tri = g.createLinearGradient(0, 110, 0, 380);
    tri.addColorStop(0, "#ff5a5f");
    tri.addColorStop(1, "#b00d28");
    g.fillStyle = tri;
    g.beginPath();
    g.moveTo(S / 2, 90);
    g.lineTo(S / 2 + 175, 370);
    g.lineTo(S / 2 - 175, 370);
    g.closePath();
    g.fill();
    g.fillStyle = "#12020a";
    g.beginPath();
    g.moveTo(S / 2, 140);
    g.lineTo(S / 2 + 135, 350);
    g.lineTo(S / 2 - 135, 350);
    g.closePath();
    g.fill();
    g.fillStyle = "#ff3d48";
    g.fillRect(S / 2 - 14, 200, 28, 90);
    g.beginPath();
    g.arc(S / 2, 318, 16, 0, Math.PI * 2);
    g.fill();
  }
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
}

export async function generateDemo(existing: Set<string>, hooks: ImportHooks) {
  const total = ALBUMS.reduce((n, a) => n + a.tracks.length, 0);
  let done = 0;
  hooks.onProgress(0, total);
  const seconds = 30;
  let added = 0;
  for (let ai = 0; ai < ALBUMS.length; ai++) {
    const a = ALBUMS[ai];
    const coverBlob = await drawCover(a);
    const coverId = `demo-cover-${ai}`;
    for (let ti = 0; ti < a.tracks.length; ti++) {
      const spec = a.tracks[ti];
      const sig = `demo|${ai}|${ti}`;
      if (!existing.has(sig)) {
        existing.add(sig);
        await new Promise((r) => setTimeout(r, 16)); // let the UI breathe
        const wav = toWav(renderTrack(spec, seconds));
        const duration = (wav.size - 44) / 2 / SR;
        const lines = spec.lyrics.split("/");
        const step = (duration - 6) / lines.length;
        const lrc = lines.map((l, i) => `${toLrcStamp(3 + i * step)}${l}`).join("\n");
        const track: Track = {
          id: uid(),
          sig,
          fileName: `${String(ti + 1).padStart(2, "0")} - ${spec.title}.wav`,
          size: wav.size,
          mime: "audio/wav",
          addedAt: Date.now() + ai * 10 + ti,
          duration,
          title: spec.title,
          artist: a.artist,
          albumArtist: a.artist,
          album: a.album,
          trackNo: ti + 1,
          trackOf: a.tracks.length,
          discNo: 1,
          year: a.year,
          genre: a.genre,
          lyrics: lrc,
          coverId: coverBlob ? coverId : null,
          plays: 0,
          lastPlayed: 0,
          favorite: false,
          demo: true,
        };
        const cover = coverBlob ? { id: coverId, blob: coverBlob } : null;
        await db.addTrack(track, wav, cover);
        hooks.onAdded(track, cover);
        added++;
      }
      done++;
      hooks.onProgress(done, total);
    }
  }
  return { added };
}
