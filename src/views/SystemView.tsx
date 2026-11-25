import { useMemo, useRef } from "react";
import { useStore } from "../store";
import type { ThemeId } from "../lib/types";
import { sfx } from "../lib/sfx";
import { fmtBytes, fmtLong, pluralize } from "../lib/format";
import { cn } from "../utils/cn";
import { promptInstall, useCanInstall } from "../lib/pwa";
import { ViewHeader } from "../components/ViewHeader";
import { Icon, RingLogo, type IconName } from "../components/Icons";
import { Slider } from "../components/Slider";
import { Toggle } from "../components/Toggle";

const THEMES: { id: ThemeId; name: string; tag: string; bg: string; a: string; b: string }[] = [
  { id: "toxic", name: "Toxic", tag: "Original Xbox dash · radioactive green on black", bg: "linear-gradient(160deg,#0a1507,#040803)", a: "#9be32d", b: "#3aa816" },
  { id: "neon", name: "Neon", tag: "Electric blue · cool midnight glow", bg: "linear-gradient(160deg,#07112c,#030614)", a: "#2bbcff", b: "#4b63ff" },
  { id: "danger", name: "Danger", tag: "Red alert · hot, loud and aggressive", bg: "linear-gradient(160deg,#1a0509,#080203)", a: "#ff3d48", b: "#c4122f" },
];

function Section({ title, icon, children, className }: { title: string; icon: IconName; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("panel p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon name={icon} size={16} className="text-accent" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {text && <div className="text-xs text-mute">{text}</div>}
      </div>
      {children}
    </div>
  );
}

export function SystemView() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const sfxOn = useStore((s) => s.sfxOn);
  const sfxVolume = useStore((s) => s.sfxVolume);
  const sfxHover = useStore((s) => s.sfxHover);
  const setSfx = useStore((s) => s.setSfx);
  const tracks = useStore((s) => s.tracks);
  const albums = useStore((s) => s.albums);
  const playlists = useStore((s) => s.playlists);
  const storage = useStore((s) => s.storage);
  const sleep = useStore((s) => s.sleep);
  const sleepLeft = useStore((s) => s.sleepLeft);
  const openModal = useStore((s) => s.openModal);
  const pickAndAdd = useStore((s) => s.pickAndAdd);
  const loadDemo = useStore((s) => s.loadDemo);
  const requestPersistence = useStore((s) => s.requestPersistence);
  const toast = useStore((s) => s.toast);
  const canInstall = useCanInstall();
  const importRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const list = Object.values(tracks);
    return {
      tracks: list.length,
      favs: list.filter((t) => t.favorite).length,
      dur: list.reduce((n, t) => n + t.duration, 0),
      size: list.reduce((n, t) => n + t.size, 0),
      demo: list.filter((t) => t.demo).map((t) => t.id),
    };
  }, [tracks]);

  const exportBackup = () => {
    const blob = new Blob([useStore.getState().exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bladebeat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const res = useStore.getState().importData(await file.text());
      toast(`Restored tags for ${res.tracks} tracks and ${pluralize(res.playlists, "playlist")}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "That file is not a valid backup", "error");
    }
  };

  const sleepText = sleep ? (sleep.mode === "track" ? "Stops after this track" : `Stops in ${Math.ceil(sleepLeft / 60)} min`) : "Off";

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-8">
      <ViewHeader title="System" subtitle="Themes · sounds · library · about" />

      <Section title="Theme" icon="zap" className="mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          {THEMES.map((t) => {
            const on = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={on}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
                  on ? "scale-[1.015] border-white/40" : "border-white/10 hover:border-white/30"
                )}
                style={{ background: t.bg, boxShadow: on ? `0 0 30px ${t.a}55, inset 0 0 0 1px ${t.a}` : undefined }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <svg width="42" height="42" viewBox="0 0 48 48" aria-hidden="true" style={{ filter: `drop-shadow(0 0 6px ${t.a})` }}>
                    <path d="M24 5 A19 19 0 0 1 43 24" stroke={t.a} strokeWidth="5" fill="none" strokeLinecap="round" />
                    <path d="M43 24 A19 19 0 0 1 24 43" stroke={t.b} strokeWidth="5" fill="none" strokeLinecap="round" />
                    <path d="M24 43 A19 19 0 0 1 5 24" stroke={t.a} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".6" />
                    <path d="M5 24 A19 19 0 0 1 24 5" stroke={t.b} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".4" />
                    <circle cx="24" cy="24" r="6" fill={t.a} />
                  </svg>
                  <div>
                    <div className="font-display text-xl font-bold uppercase tracking-[0.16em]" style={{ color: t.a }}>
                      {t.name}
                    </div>
                    <div className="text-xs text-white/60">{t.tag}</div>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  {[0.6, 1, 0.75].map((s, i) => (
                    <div key={i} className="aspect-[0.72] w-[22%] rounded-[4px]" style={{ transform: `scale(${s})`, transformOrigin: "bottom", background: `linear-gradient(160deg, ${i === 1 ? t.a : t.b}, #000 120%)`, opacity: 0.4 + s * 0.6 }} />
                  ))}
                  <div className="ml-auto h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${t.b}, ${t.a})` }} />
                  </div>
                </div>
                {on && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-black" style={{ background: t.a }}>
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sounds" icon="volume">
          <Row title="Interface sounds" text="Clicks, blade swishes and chimes – tuned to each theme.">
            <Toggle on={sfxOn} onChange={(v) => setSfx({ on: v })} label="Interface sounds" silent />
          </Row>
          <Row title="Hover ticks" text="Soft tick when the pointer moves over buttons.">
            <Toggle on={sfxHover} onChange={(v) => setSfx({ hover: v })} label="Hover sounds" />
          </Row>
          <div className="py-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Sound effects volume</span>
              <span className="text-sm font-bold tabular-nums text-accent">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <Slider value={sfxVolume} onChange={(v) => setSfx({ volume: v })} onCommit={() => sfx.play("select")} disabled={!sfxOn} label="Sound effects volume" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn" disabled={!sfxOn} onClick={() => sfx.play("startup")}>
              <Icon name="play" size={13} fill /> Boot chime
            </button>
            <button className="btn" disabled={!sfxOn} onClick={() => sfx.play("blade")}>
              Blade
            </button>
            <button className="btn" disabled={!sfxOn} onClick={() => sfx.play("toast")}>
              Notify
            </button>
          </div>
        </Section>

        <Section title="Library" icon="disc">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              [String(stats.tracks), "Songs"],
              [String(albums.length), "Albums"],
              [String(playlists.length), "Playlists"],
              [String(stats.favs), "Favorites"],
              [fmtLong(stats.dur), "Playtime"],
              [fmtBytes(stats.size), "Size"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-center">
                <div className="font-display text-lg font-bold text-accent">{v}</div>
                <div className="label !text-[0.6rem]">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void pickAndAdd(false)}>
              <Icon name="plus" size={14} /> Add files
            </button>
            <button className="btn" onClick={() => void pickAndAdd(true)}>
              <Icon name="folder" size={14} /> Add folder
            </button>
            <button className="btn" onClick={() => void loadDemo()}>
              <Icon name="zap" size={14} /> Demo tracks
            </button>
            <button className="btn" onClick={exportBackup} disabled={!stats.tracks}>
              <Icon name="download" size={14} /> Export backup
            </button>
            <button className="btn" onClick={() => importRef.current?.click()}>
              <Icon name="upload" size={14} /> Import backup
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.demo.length > 0 && (
              <button
                className="btn btn-danger"
                onClick={() =>
                  openModal({
                    type: "confirm",
                    title: "Remove demo tracks",
                    message: "Remove the generated demo tracks from your library?",
                    confirmLabel: "Remove",
                    danger: true,
                    onConfirm: () => void useStore.getState().deleteTracks(stats.demo),
                  })
                }
              >
                Remove demo tracks
              </button>
            )}
            <button
              className="btn btn-danger"
              disabled={!stats.tracks}
              onClick={() =>
                openModal({
                  type: "confirm",
                  title: "Clear library",
                  message: "This deletes all songs, playlists and edited tags stored inside this app. Your original files are untouched.",
                  confirmLabel: "Clear everything",
                  danger: true,
                  onConfirm: () => void useStore.getState().clearLibrary(),
                })
              }
            >
              <Icon name="trash" size={14} /> Clear library
            </button>
          </div>
        </Section>

        <Section title="Sleep timer" icon="moon">
          <Row title={sleepText} text="Fades the music out gently, then pauses.">
            <button className="btn btn-primary" onClick={() => openModal({ type: "sleep" })}>
              <Icon name="moon" size={14} /> {sleep ? "Change" : "Set timer"}
            </button>
          </Row>
        </Section>

        <Section title="Storage & install" icon="folder">
          <Row
            title={storage.persisted ? "Storage protected" : "Storage not yet protected"}
            text={`${fmtBytes(storage.usage)} used of ${fmtBytes(storage.quota)} available. Protected storage is never cleared automatically by the browser.`}
          >
            <button className="btn" disabled={!!storage.persisted} onClick={() => void requestPersistence()}>
              {storage.persisted ? <Icon name="check" size={14} /> : <Icon name="zap" size={14} />}
              {storage.persisted ? "Done" : "Protect"}
            </button>
          </Row>
          <Row title="Install as an app" text={canInstall ? "Add Bladebeat to your home screen for fullscreen, offline use." : "Use your browser menu → “Install app” / “Add to Home Screen”."}>
            <button className="btn" disabled={!canInstall} onClick={() => void promptInstall()}>
              <Icon name="download" size={14} /> Install
            </button>
          </Row>
        </Section>

        <Section title="About" icon="keyboard" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RingLogo size={44} />
              <div>
                <div className="font-display text-lg font-bold uppercase tracking-[0.2em] text-ink">Bladebeat</div>
                <div className="text-xs text-mute">A retro-styled local music player. Runs 100% in your browser – your music never leaves your device.</div>
              </div>
            </div>
            <button className="btn" onClick={() => openModal({ type: "shortcuts" })}>
              <Icon name="keyboard" size={14} /> Keyboard shortcuts
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
