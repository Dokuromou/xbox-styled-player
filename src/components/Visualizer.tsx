import { useEffect, useRef } from "react";
import { engine } from "../lib/engine";
import { useStore } from "../store";
import { CoverArt } from "./Cover";

export const VIZ_MODES = ["Ring Bars", "Wave Ring", "Orbit"] as const;
const TAU = Math.PI * 2;

interface Props {
  coverId: string | null;
  seed: string;
  mode: number;
  playing: boolean;
  onCycle?: () => void;
}

/** Circular audio visualiser drawn around the (spinning) album art. */
export function Visualizer({ coverId, seed, mode, playing, onCycle }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue("--accent").trim() || "#9be32d";
    const accent2 = css.getPropertyValue("--accent2").trim() || "#3aa816";
    const glow = css.getPropertyValue("--glow").trim() || "155 227 45";
    const rgba = (a: number) => `rgb(${glow} / ${a.toFixed(3)})`;

    let S = 0;
    let dpr = 1;
    const resize = () => {
      const r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      S = r.width;
      cv.width = Math.max(1, Math.round(S * dpr));
      cv.height = Math.max(1, Math.round(S * dpr));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    const N = 64;
    const M = N * 2;
    const lv = new Float32Array(N);
    const peaks = new Float32Array(N);
    const cosA = new Float32Array(M);
    const sinA = new Float32Array(M);
    for (let k = 0; k < M; k++) {
      const a = -Math.PI / 2 + ((k + 0.5) / M) * TAU;
      cosA[k] = Math.cos(a);
      sinA[k] = Math.sin(a);
    }
    const ripples: { r: number; a: number }[] = [];
    let bassS = 0;
    let prevBass = 0;
    let rot = 0;
    let time = 0;
    let cool = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      if (S <= 0) return;

      const freq = engine.getFrequency();
      const active = !!freq && !engine.audio.paused;
      if (freq && active) {
        const usable = Math.floor(freq.length * 0.6);
        for (let i = 0; i < N; i++) {
          const pos = Math.pow(i / (N - 1), 1.6) * (usable - 1);
          const i0 = Math.floor(pos);
          const f = pos - i0;
          const raw = (freq[i0] * (1 - f) + freq[Math.min(usable - 1, i0 + 1)] * f) / 255;
          const v = Math.min(1, Math.pow(raw, 1.25) * (0.9 + (i / N) * 0.55));
          lv[i] += (v - lv[i]) * (v > lv[i] ? 0.55 : 0.16);
        }
      } else {
        for (let i = 0; i < N; i++) {
          const idle = 0.05 + 0.035 * (1 + Math.sin(time * 1.6 + i * 0.42));
          lv[i] += (idle - lv[i]) * 0.08;
        }
      }
      let b = 0;
      for (let i = 0; i < 6; i++) b += lv[i];
      b /= 6;
      bassS += (b - bassS) * 0.35;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      const cx = S / 2;
      const cy = S / 2;
      const R0 = S * 0.265;
      const maxLen = S * 0.2;
      const base = R0 + S * 0.02;
      rot += dt * (0.25 + bassS * 1.1);

      // soft glow behind the disc
      const gr = S * 0.5;
      const g = ctx.createRadialGradient(cx, cy, R0 * 0.8, cx, cy, gr);
      g.addColorStop(0, rgba(0.16 + bassS * 0.45));
      g.addColorStop(0.7, rgba((0.16 + bassS * 0.45) * 0.18));
      g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, TAU);
      ctx.fill();

      // "ring of light" – four rotating arcs
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, S * 0.008);
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      for (let k = 0; k < 4; k++) {
        const a0 = rot + (k * TAU) / 4;
        ctx.strokeStyle = k % 2 ? accent2 : accent;
        ctx.globalAlpha = 0.3 + bassS * 0.65;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.478, a0, a0 + (TAU / 4) * 0.6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // fine tick marks
      ctx.strokeStyle = rgba(0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU - rot * 0.25;
        const r1 = S * 0.448;
        const r2 = S * (i % 4 === 0 ? 0.462 : 0.455);
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      }
      ctx.stroke();

      if (mode === 0) {
        const lw = Math.max(2, ((TAU * base) / M) * 0.58);
        ctx.lineWidth = lw;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = accent2;
        ctx.beginPath();
        for (let k = 0; k < M; k++) {
          const i = k < N ? k : M - 1 - k;
          const len = S * 0.012 + lv[i] * maxLen;
          ctx.moveTo(cx + cosA[k] * base, cy + sinA[k] * base);
          ctx.lineTo(cx + cosA[k] * (base + len * 0.6), cy + sinA[k] * (base + len * 0.6));
        }
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.beginPath();
        for (let k = 0; k < M; k++) {
          const i = k < N ? k : M - 1 - k;
          const len = S * 0.012 + lv[i] * maxLen;
          ctx.moveTo(cx + cosA[k] * (base + len * 0.55), cy + sinA[k] * (base + len * 0.55));
          ctx.lineTo(cx + cosA[k] * (base + len), cy + sinA[k] * (base + len));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < N; i++) {
          peaks[i] = Math.max(peaks[i] - dt * 0.4, lv[i]);
        }
        for (let k = 0; k < M; k++) {
          const i = k < N ? k : M - 1 - k;
          const r = base + S * 0.012 + peaks[i] * maxLen + lw * 0.9;
          ctx.beginPath();
          ctx.arc(cx + cosA[k] * r, cy + sinA[k] * r, Math.max(1, lw * 0.28), 0, TAU);
          ctx.fill();
        }
      } else if (mode === 1) {
        const wave = engine.getWaveform();
        const W = 200;
        for (let layer = 0; layer < 3; layer++) {
          ctx.beginPath();
          for (let j = 0; j <= W; j++) {
            const jj = j % W;
            const u = jj < W / 2 ? jj / (W / 2) : (W - jj) / (W / 2);
            let s: number;
            if (wave && active) s = (wave[Math.floor(u * 700) + layer * 30] - 128) / 128;
            else s = Math.sin(time * 2 + u * 9 + layer) * 0.05;
            const r = base + S * 0.035 + layer * S * 0.012 + s * maxLen * (0.85 + bassS * 0.9);
            const a = (jj / W) * TAU - Math.PI / 2;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer === 0) {
            ctx.fillStyle = rgba(0.07 + bassS * 0.1);
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(2, S * 0.007);
            ctx.shadowColor = accent;
            ctx.shadowBlur = 16;
          } else if (layer === 1) {
            ctx.strokeStyle = accent2;
            ctx.lineWidth = Math.max(1.5, S * 0.005);
            ctx.shadowBlur = 8;
          } else {
            ctx.strokeStyle = "rgba(255,255,255,0.28)";
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        // gentle outer spectrum dots
        ctx.fillStyle = rgba(0.65);
        for (let k = 0; k < M; k += 2) {
          const i = k < N ? k : M - 1 - k;
          const r = S * 0.43 + lv[i] * S * 0.03;
          ctx.beginPath();
          ctx.arc(cx + cosA[k] * r, cy + sinA[k] * r, Math.max(1, S * 0.003 + lv[i] * S * 0.004), 0, TAU);
          ctx.fill();
        }
      } else {
        // orbit: bass ripples + three counter-rotating dot rings
        cool -= dt;
        if (bassS - prevBass > 0.04 && bassS > 0.3 && cool <= 0) {
          ripples.push({ r: base, a: 0.75 });
          cool = 0.22;
        }
        prevBass = bassS;
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.r += dt * S * 0.32;
          rp.a -= dt * 0.8;
          if (rp.a <= 0 || rp.r > S * 0.5) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = rgba(rp.a);
          ctx.lineWidth = Math.max(1.5, S * 0.006) * rp.a + 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, rp.r, 0, TAU);
          ctx.stroke();
        }
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        for (let ring = 0; ring < 3; ring++) {
          const count = 40 + ring * 12;
          const dir = ring % 2 ? -1 : 1;
          const rr = base + S * 0.03 + ring * S * 0.052;
          ctx.fillStyle = ring === 1 ? accent2 : accent;
          for (let i = 0; i < count; i++) {
            const v = lv[(i * 3 + ring * 11) % N];
            const a = (i / count) * TAU + rot * dir * (0.5 + ring * 0.35);
            const r = rr + v * S * 0.045;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, S * 0.004 + v * S * 0.011, 0, TAU);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      const el = art.current;
      if (el) {
        el.style.transform = `scale(${(1 + bassS * 0.05).toFixed(3)})`;
        el.style.boxShadow = `0 0 ${(18 + bassS * 55).toFixed(0)}px rgb(${glow} / ${(0.3 + bassS * 0.55).toFixed(2)}), 0 0 0 3px rgb(${glow} / 0.45)`;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mode, theme]);

  return (
    <div
      ref={wrap}
      onClick={onCycle}
      title="Click to change visualizer style"
      className="relative aspect-square cursor-pointer select-none"
      style={{ width: "min(100%, max(220px, calc(100dvh - 410px)))" }}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-[25%]">
        <div ref={art} className="h-full w-full overflow-hidden rounded-full">
          <div className="h-full w-full animate-spin-slow" style={{ animationPlayState: playing ? "running" : "paused" }}>
            <CoverArt coverId={coverId} seed={seed} iconSize={64} eager />
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 h-[13%] w-[13%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent/70 bg-bg0 shadow-[inset_0_0_8px_#000,0_0_10px_rgb(var(--glow)/0.5)]" />
      </div>
    </div>
  );
}
