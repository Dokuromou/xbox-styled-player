import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { Track } from "../lib/types";
import { activeLine, parseLyrics, type ParsedLyrics } from "../lib/lrc";
import { engine } from "../lib/engine";
import { cn } from "../utils/cn";
import { Icon } from "./Icons";

function useActiveLine(parsed: ParsedLyrics): number {
  const [idx, setIdx] = useState(-1);
  useEffect(() => {
    if (!parsed.synced) {
      setIdx(-1);
      return;
    }
    let raf = 0;
    const loop = () => {
      const i = activeLine(parsed.lines, engine.audio.currentTime);
      setIdx((p) => (p === i ? p : i));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [parsed]);
  return idx;
}

export function LyricsPanel({ track, className }: { track: Track | null; className?: string }) {
  const openModal = useStore((s) => s.openModal);
  const seek = useStore((s) => s.seek);
  const parsed = useMemo(() => parseLyrics(track?.lyrics ?? ""), [track?.lyrics]);
  const active = useActiveLine(parsed);
  const box = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | HTMLDivElement | null)[]>([]);
  const manualUntil = useRef(0);

  // keep the active line centred, unless the user is browsing manually
  useEffect(() => {
    if (active < 0 || !box.current) return;
    if (performance.now() < manualUntil.current) return;
    const el = lineRefs.current[active];
    if (!el) return;
    box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  // reset scroll when the song changes
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    manualUntil.current = 0;
  }, [track?.id]);

  const markManual = () => {
    manualUntil.current = performance.now() + 3500;
  };

  return (
    <div className={cn("panel flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="mic" size={16} className="text-accent" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.16em]">Lyrics</span>
          {parsed.lines.length > 0 && (
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-accent">
              {parsed.synced ? "Synced" : "Text"}
            </span>
          )}
        </div>
        <button className="btn !px-3 !py-2" disabled={!track} onClick={() => track && openModal({ type: "lyrics", id: track.id })}>
          <Icon name="edit" size={14} /> {parsed.lines.length ? "Edit" : "Add"}
        </button>
      </div>

      {!track ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-mute">Play a song to see its lyrics.</div>
      ) : parsed.lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Icon name="mic" size={34} className="text-mute" strokeWidth={1.4} />
          <p className="max-w-xs text-sm text-mute">
            No lyrics found for <b className="text-ink">{track.title}</b>. Paste them, import an .lrc file, or look them up online.
          </p>
          <button className="btn btn-primary" onClick={() => openModal({ type: "lyrics", id: track.id })}>
            <Icon name="plus" size={14} /> Add lyrics
          </button>
        </div>
      ) : (
        <div
          ref={box}
          onWheel={markManual}
          onTouchMove={markManual}
          onPointerDown={markManual}
          className="scroll-thin relative min-h-0 flex-1 overflow-y-auto px-5 [mask-image:linear-gradient(transparent,black_14%,black_86%,transparent)]"
        >
          <div className="py-[28vh] text-center">
            {parsed.lines.map((l, i) => {
              const dist = parsed.synced ? Math.abs(i - active) : 0;
              const isActive = parsed.synced && i === active;
              const common = "block w-full px-2 py-1.5 transition-all duration-300";
              const style = {
                opacity: parsed.synced ? (isActive ? 1 : Math.max(0.28, 1 - dist * 0.17)) : 0.92,
              };
              if (!l.text) return <div key={i} ref={(el) => void (lineRefs.current[i] = el)} className="h-5" />;
              return (
                <button
                  key={i}
                  ref={(el) => void (lineRefs.current[i] = el)}
                  disabled={!parsed.synced}
                  data-sfx="none"
                  data-sfx-hover="none"
                  onClick={() => parsed.synced && seek(l.time)}
                  className={cn(
                    common,
                    "font-display font-semibold leading-snug",
                    isActive ? "scale-[1.04] text-[1.45rem] text-ink [text-shadow:0_0_22px_rgb(var(--glow)/0.8)]" : "text-lg text-mute",
                    parsed.synced && !isActive && "hover:!opacity-100 hover:text-ink",
                    !parsed.synced && "cursor-default text-base text-ink/90"
                  )}
                  style={style}
                >
                  {l.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
