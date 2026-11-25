import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { engine, EQ_LABELS, EQ_PRESETS } from "../lib/engine";
import { ViewHeader } from "../components/ViewHeader";
import { Slider } from "../components/Slider";
import { Toggle } from "../components/Toggle";
import { Icon } from "../components/Icons";
import { cn } from "../utils/cn";

/** Live spectrum drawn behind the EQ sliders so you can see what you're tweaking. */
function SpectrumBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const glow = css.getPropertyValue("--glow").trim() || "155 227 45";
    const accent = css.getPropertyValue("--accent").trim() || "#9be32d";
    let raf = 0;
    const smooth = new Float32Array(96);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const f = engine.getFrequency();
      const active = !!f && !engine.audio.paused;
      const n = smooth.length;
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, `rgb(${glow} / 0.02)`);
      grad.addColorStop(1, `rgb(${glow} / 0.24)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < n; i++) {
        let v = 0;
        if (f && active) {
          const pos = Math.pow(i / (n - 1), 1.9) * (f.length * 0.62);
          v = Math.pow(f[Math.floor(pos)] / 255, 1.3);
        }
        smooth[i] += (v - smooth[i]) * (v > smooth[i] ? 0.5 : 0.12);
        ctx.lineTo((i / (n - 1)) * w, h - smooth[i] * h * 0.95);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [theme]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full rounded-xl" />;
}

const fmtDb = (v: number) => `${v > 0 ? "+" : ""}${Number.isInteger(v) ? v : v.toFixed(1)}`;

export function EqualizerView() {
  const eq = useStore((s) => s.eq);
  const setEq = useStore((s) => s.setEq);
  const setEqBand = useStore((s) => s.setEqBand);
  const setEqPreset = useStore((s) => s.setEqPreset);
  const rate = useStore((s) => s.rate);
  const setRate = useStore((s) => s.setRate);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-8">
      <ViewHeader title="Equalizer" subtitle={`10-band · ${eq.enabled ? eq.preset : "Bypassed"}`}>
        <span className="label">{eq.enabled ? "On" : "Off"}</span>
        <Toggle on={eq.enabled} onChange={(v) => setEq({ enabled: v })} label="Enable equalizer" />
      </ViewHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className={cn("panel relative overflow-hidden p-4 sm:p-6", !eq.enabled && "opacity-70")}>
          <SpectrumBackdrop />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="label">Gain (dB)</span>
              <button className="btn !px-3 !py-1.5" onClick={() => setEqPreset("Flat")}>
                Reset
              </button>
            </div>
            <div className="flex items-stretch gap-1 sm:gap-2">
              <div className="flex w-10 flex-col items-center sm:w-14">
                <span className="mb-2 h-4 text-[0.7rem] font-bold tabular-nums text-accent">{fmtDb(eq.preamp)}</span>
                <div className="h-[220px]">
                  <Slider orientation="v" min={-12} max={12} step={0.5} value={eq.preamp} fillFrom="center" label="Preamp" onChange={(v) => setEq({ preamp: v, preset: eq.preset })} />
                </div>
                <span className="mt-2 text-[0.65rem] font-bold uppercase tracking-wider text-mute">Pre</span>
              </div>
              <div className="mx-1 w-px self-stretch bg-white/10" />
              <div className="grid flex-1 grid-cols-10 gap-0.5 sm:gap-2">
                {eq.gains.map((g, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="mb-2 h-4 text-[0.65rem] font-bold tabular-nums text-accent sm:text-[0.7rem]">{fmtDb(g)}</span>
                    <div className="h-[220px]">
                      <Slider orientation="v" min={-12} max={12} step={0.5} value={g} fillFrom="center" label={`${EQ_LABELS[i]} Hz`} onChange={(v) => setEqBand(i, v)} />
                    </div>
                    <span className="mt-2 text-[0.62rem] font-bold uppercase tracking-wider text-mute sm:text-[0.68rem]">{EQ_LABELS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[0.6rem] uppercase tracking-widest text-mute/70">
              <span>Low</span>
              <span>Mid</span>
              <span>High</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="label mb-3">Presets</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(EQ_PRESETS).map((p) => (
                <button key={p} className="chip" data-on={eq.preset === p && eq.enabled} onClick={() => setEqPreset(p)}>
                  {p}
                </button>
              ))}
              {eq.preset === "Custom" && (
                <span className="chip" data-on="true">
                  Custom
                </span>
              )}
            </div>
          </div>

          <div className="panel flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">Limiter</div>
                <div className="text-xs text-mute">Prevents clipping when boosting bands.</div>
              </div>
              <Toggle on={eq.limiter} onChange={(v) => setEq({ limiter: v })} label="Limiter" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="label">Playback speed</span>
                <span className="text-sm font-bold tabular-nums text-accent">{rate.toFixed(2)}×</span>
              </div>
              <Slider min={0.5} max={2} step={0.05} value={rate} onChange={setRate} label="Playback speed" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0.75, 1, 1.25, 1.5].map((r) => (
                  <button key={r} className="chip !px-2.5 !py-1 !text-[0.7rem]" data-on={Math.abs(rate - r) < 0.01} onClick={() => setRate(r)}>
                    {r}×
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="label">Master volume</span>
                <span className="text-sm font-bold tabular-nums text-accent">{Math.round(volume * 100)}%</span>
              </div>
              <Slider value={volume} onChange={setVolume} label="Volume" />
            </div>
          </div>
          <div className="flex items-start gap-2 px-1 text-xs text-mute">
            <Icon name="zap" size={14} className="mt-0.5 shrink-0 text-accent" />
            Processed live with the Web Audio API – no rendering, no latency.
          </div>
        </div>
      </div>
    </div>
  );
}
