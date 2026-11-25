import { useStore } from "../store";
import type { ThemeId } from "../lib/types";
import { cn } from "../utils/cn";
import { Icon, RingLogo } from "./Icons";

const DOTS: { id: ThemeId; name: string; color: string }[] = [
  { id: "toxic", name: "Toxic", color: "#9be32d" },
  { id: "neon", name: "Neon", color: "#2bbcff" },
  { id: "danger", name: "Danger", color: "#ff3d48" },
];

/** First-run boot screen: explains what access is needed and opens the system file picker. */
export function Welcome() {
  const ready = useStore((s) => s.ready);
  const welcomed = useStore((s) => s.welcomed);
  const count = useStore((s) => Object.keys(s.tracks).length);
  const importing = useStore((s) => s.importing);
  const pickAndAdd = useStore((s) => s.pickAndAdd);
  const loadDemo = useStore((s) => s.loadDemo);
  const dismiss = useStore((s) => s.dismissWelcome);
  const requestPersistence = useStore((s) => s.requestPersistence);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  if (!ready || welcomed || count > 0) return null;

  const allow = () => {
    // ask the browser to protect our storage, then open the system file picker (user gesture required)
    void requestPersistence();
    void pickAndAdd(false);
  };

  return (
    <div className="fixed inset-0 z-[85] flex animate-fade-in items-start justify-center overflow-y-auto bg-bg0/92 p-4 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-xl py-6 text-center">
        <div className="mx-auto mb-3 w-fit animate-float">
          <RingLogo size={104} spinning />
        </div>
        <h1 className="font-display text-4xl font-bold uppercase tracking-[0.3em] text-ink [text-shadow:0_0_30px_rgb(var(--glow)/0.8)] sm:text-5xl">Bladebeat</h1>
        <p className="label mt-2 !tracking-[0.4em]">Your music · Your device</p>

        <div className="panel mt-7 space-y-4 p-5 text-left sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Icon name="folder" size={18} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wider text-ink">Allow access to your audio files</h2>
              <p className="mt-1 text-sm leading-relaxed text-mute">
                Bladebeat plays the MP3s (and M4A, FLAC, OGG, WAV…) stored on this device. Press the button and your browser will ask which audio files it may
                use. On a phone, that is the system file picker.
              </p>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-mute">
            {[
              "Files are copied into private browser storage – nothing is uploaded anywhere.",
              "Works offline once loaded. Add it to your home screen for an app-like feel.",
              "Tags, covers and embedded lyrics are read automatically.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Icon name="check" size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button className="btn btn-primary flex-1 !py-3.5 !text-sm" data-sfx="startup" disabled={!!importing} onClick={allow}>
              <span className="face face-a">A</span> Allow &amp; select music
            </button>
            <button className="btn flex-1 !py-3.5" disabled={!!importing} onClick={() => void pickAndAdd(true)}>
              <Icon name="folder" size={15} /> Select a folder
            </button>
          </div>
          <button className="btn w-full" disabled={!!importing} onClick={() => void loadDemo()}>
            <Icon name="zap" size={15} /> {importing ? `Working… ${importing.done}/${importing.total || "?"}` : "No music handy? Try generated demo tracks"}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="label">Theme</span>
          {DOTS.map((d) => (
            <button
              key={d.id}
              onClick={() => setTheme(d.id)}
              aria-label={`${d.name} theme`}
              aria-pressed={theme === d.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all",
                theme === d.id ? "border-white/60 text-ink" : "border-white/10 text-mute hover:text-ink"
              )}
              style={{ boxShadow: theme === d.id ? `0 0 16px ${d.color}66` : undefined }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              {d.name}
            </button>
          ))}
        </div>
        <button className="mt-5 text-xs text-mute underline-offset-4 hover:text-ink hover:underline" onClick={dismiss} data-sfx="back">
          Skip for now
        </button>
      </div>
    </div>
  );
}
