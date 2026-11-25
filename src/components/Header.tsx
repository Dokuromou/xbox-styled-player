import { useEffect, useRef } from "react";
import { useStore } from "../store";
import type { ThemeId, ViewId } from "../lib/types";
import { cn } from "../utils/cn";
import { Icon, RingLogo } from "./Icons";

export const TABS: { id: ViewId; label: string }[] = [
  { id: "albums", label: "Albums" },
  { id: "songs", label: "Songs" },
  { id: "playlists", label: "Playlists" },
  { id: "favorites", label: "Favorites" },
  { id: "now", label: "Now Playing" },
  { id: "eq", label: "Equalizer" },
  { id: "system", label: "System" },
];

const THEME_DOTS: { id: ThemeId; name: string; color: string }[] = [
  { id: "toxic", name: "Toxic", color: "#9be32d" },
  { id: "neon", name: "Neon", color: "#2bbcff" },
  { id: "danger", name: "Danger", color: "#ff3d48" },
];

export function Header() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const playing = useStore((s) => s.playing);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const sfxOn = useStore((s) => s.sfxOn);
  const setSfx = useStore((s) => s.setSfx);
  const pickAndAdd = useStore((s) => s.pickAndAdd);
  const importing = useStore((s) => s.importing);
  const tabsRef = useRef<HTMLDivElement>(null);

  const idx = TABS.findIndex((t) => t.id === view);
  const go = (d: number) => setView(TABS[(idx + d + TABS.length) % TABS.length].id);

  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [view]);

  return (
    <header className="strip relative z-20 shrink-0 border-b border-white/10 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgb(0_0_0/0.45)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 sm:px-6 md:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <RingLogo size={34} spinning={playing} />
          <div className="leading-none">
            <div className="font-display text-lg font-bold uppercase tracking-[0.24em] text-ink [text-shadow:0_0_14px_rgb(var(--glow)/0.6)]">Bladebeat</div>
            <div className="label !text-[0.55rem] !tracking-[0.3em]">Local music</div>
          </div>
        </div>

        <div className="order-3 flex min-w-0 basis-full items-center gap-2 md:order-none md:basis-auto md:flex-1 md:justify-center">
          <button className="bumper hidden 2xl:block" onClick={() => go(-1)} aria-label="Previous tab" data-sfx="blade">
            LB
          </button>
          <div ref={tabsRef} role="tablist" aria-label="Sections" className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto">
            {TABS.map((t) => {
              const on = t.id === view;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  data-sfx="blade"
                  onClick={() => setView(t.id)}
                  className={cn(
                    "relative shrink-0 px-2.5 py-2.5 font-display text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-colors sm:px-3 sm:text-sm xl:px-4 xl:tracking-[0.16em]",
                    on ? "text-accent [text-shadow:0_0_16px_rgb(var(--glow)/0.8)]" : "text-mute hover:text-ink"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-accent2 via-accent to-accent2 shadow-[0_0_12px_var(--accent)] transition-all duration-300",
                      on ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <button className="bumper hidden 2xl:block" onClick={() => go(1)} aria-label="Next tab" data-sfx="blade">
            RB
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2 py-1.5" role="group" aria-label="Theme">
            {THEME_DOTS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={`${t.name} theme`}
                aria-label={`${t.name} theme`}
                aria-pressed={theme === t.id}
                className={cn("h-4 w-4 rounded-full transition-all", theme === t.id ? "scale-125 ring-2 ring-white/80" : "opacity-70 hover:opacity-100")}
                style={{ background: t.color, boxShadow: theme === t.id ? `0 0 12px ${t.color}` : undefined }}
              />
            ))}
          </div>
          <button
            className="iconbtn"
            data-on={sfxOn}
            data-sfx="none"
            onClick={() => setSfx({ on: !sfxOn })}
            aria-label={sfxOn ? "Turn interface sounds off" : "Turn interface sounds on"}
            title={sfxOn ? "Interface sounds: on" : "Interface sounds: off"}
          >
            <span className="relative">
              <Icon name="zap" size={18} />
              {!sfxOn && <span className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded bg-current" />}
            </span>
          </button>
          <button className="iconbtn" onClick={() => void pickAndAdd(false)} aria-label="Add music files" title="Add music">
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>

      {importing && (
        <div className="absolute inset-x-0 -bottom-[3px] h-[3px] overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-accent2 to-accent shadow-[0_0_12px_var(--accent)] transition-all duration-300"
            style={{ width: `${importing.total ? (importing.done / importing.total) * 100 : 8}%` }}
          />
        </div>
      )}
    </header>
  );
}
