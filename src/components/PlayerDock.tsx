import { useState } from "react";
import { useStore } from "../store";
import { useCurrentTime, useCurrentTrack, useMediaQuery } from "../hooks";
import { fmtTime } from "../lib/format";
import { cn } from "../utils/cn";
import { CoverArt } from "./Cover";
import { Icon } from "./Icons";
import { Slider } from "./Slider";

function Progress() {
  const duration = useStore((s) => s.duration);
  const hasTrack = useStore((s) => !!s.currentId);
  const seek = useStore((s) => s.seek);
  const t = useCurrentTime(20);
  const [drag, setDrag] = useState<number | null>(null);
  const val = drag ?? t;
  return (
    <div className="flex w-full items-center gap-3">
      <span className="w-10 text-right text-xs tabular-nums text-mute">{fmtTime(val)}</span>
      <Slider
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(val, duration || 1)}
        onChange={setDrag}
        onCommit={(v) => {
          seek(v);
          setTimeout(() => setDrag(null), 140);
        }}
        disabled={!hasTrack}
        label="Seek"
      />
      <span className="w-10 text-xs tabular-nums text-mute">{fmtTime(duration)}</span>
    </div>
  );
}

function PlayButton({ size = 56 }: { size?: number }) {
  const playing = useStore((s) => s.playing);
  const loading = useStore((s) => s.loading);
  const togglePlay = useStore((s) => s.togglePlay);
  return (
    <button
      onClick={togglePlay}
      data-sfx="none"
      aria-label={playing ? "Pause" : "Play"}
      className="relative flex shrink-0 items-center justify-center rounded-full border-2 border-white/60 bg-gradient-to-b from-white/90 via-accent to-accent2 text-onaccent shadow-[0_0_26px_rgb(var(--glow)/0.55),inset_0_2px_0_rgb(255_255_255/0.7)] transition-transform hover:scale-105 active:scale-95"
      style={{ width: size, height: size }}
    >
      <Icon name={playing ? "pause" : "play"} size={size * 0.42} fill strokeWidth={1.5} className={playing ? "" : "translate-x-[2px]"} />
      {loading && <span className="absolute -inset-1.5 animate-spin rounded-full border-2 border-transparent border-t-white/90" />}
    </button>
  );
}

function Transport({ compact }: { compact?: boolean }) {
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const cycleRepeat = useStore((s) => s.cycleRepeat);
  const next = useStore((s) => s.next);
  const prev = useStore((s) => s.prev);
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2.5">
      <button className="iconbtn" data-on={shuffle} onClick={toggleShuffle} aria-label="Shuffle" title="Shuffle (S)">
        <Icon name="shuffle" size={18} />
      </button>
      <button className="iconbtn !h-10 !w-10 text-ink" onClick={prev} aria-label="Previous track" title="Previous (P)">
        <Icon name="prev" size={22} fill />
      </button>
      <PlayButton size={compact ? 52 : 56} />
      <button className="iconbtn !h-10 !w-10 text-ink" onClick={() => next()} aria-label="Next track" title="Next (N)">
        <Icon name="next" size={22} fill />
      </button>
      <button className="iconbtn" data-on={repeat !== "off"} onClick={cycleRepeat} aria-label={`Repeat ${repeat}`} title="Repeat (R)">
        <Icon name={repeat === "one" ? "repeat1" : "repeat"} size={18} />
      </button>
    </div>
  );
}

function Extras({ showVolume }: { showVolume: boolean }) {
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const setVolume = useStore((s) => s.setVolume);
  const toggleMute = useStore((s) => s.toggleMute);
  const toggleQueue = useStore((s) => s.toggleQueue);
  const showQueue = useStore((s) => s.showQueue);
  const queueLen = useStore((s) => s.queue.length);
  const openModal = useStore((s) => s.openModal);
  const sleep = useStore((s) => s.sleep);
  const sleepLeft = useStore((s) => s.sleepLeft);
  const setView = useStore((s) => s.setView);
  const setNowTab = useStore((s) => s.setNowTab);
  const view = useStore((s) => s.view);
  const eqOn = useStore((s) => s.eq.enabled && s.eq.preset !== "Flat");

  const vIcon = muted || volume === 0 ? "mute" : volume < 0.5 ? "volumeLow" : "volume";
  const sleepBadge = sleep ? (sleep.mode === "track" ? "•" : `${Math.max(1, Math.ceil(sleepLeft / 60))}m`) : null;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {showVolume && (
        <div className="mr-2 flex w-36 items-center gap-1.5">
          <button className="iconbtn shrink-0" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} title="Mute (M)" data-sfx="none">
            <Icon name={vIcon} size={18} />
          </button>
          <Slider value={muted ? 0 : volume} onChange={setVolume} label="Volume" />
        </div>
      )}
      <button
        className="iconbtn"
        data-on={view === "now"}
        onClick={() => {
          setNowTab("lyrics");
          setView("now");
        }}
        aria-label="Lyrics"
        title="Lyrics (L)"
      >
        <Icon name="mic" size={18} />
      </button>
      <button className="iconbtn" data-on={view === "eq" || eqOn} onClick={() => setView("eq")} aria-label="Equalizer" title="Equalizer (E)">
        <Icon name="sliders" size={18} />
      </button>
      <button className="iconbtn relative" data-on={!!sleep} onClick={() => openModal({ type: "sleep" })} aria-label="Sleep timer" title="Sleep timer">
        <Icon name="moon" size={18} />
        {sleepBadge && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-accent px-1 text-center text-[0.6rem] font-bold leading-4 text-onaccent">
            {sleepBadge}
          </span>
        )}
      </button>
      <button className="iconbtn relative" data-on={showQueue} onClick={() => toggleQueue()} aria-label="Queue" title="Queue (Q)">
        <Icon name="queue" size={18} />
        {queueLen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-white/20 px-1 text-center text-[0.6rem] font-bold leading-4 text-ink">
            {queueLen > 99 ? "99+" : queueLen}
          </span>
        )}
      </button>
    </div>
  );
}

function NowInfo() {
  const track = useCurrentTrack();
  const setView = useStore((s) => s.setView);
  const setNowTab = useStore((s) => s.setNowTab);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md shadow-[0_6px_18px_rgb(0_0_0/0.6)] ring-1 ring-white/20 transition-transform hover:scale-105"
        onClick={() => {
          setNowTab("viz");
          setView("now");
        }}
        aria-label="Open Now Playing"
      >
        <CoverArt coverId={track?.coverId} seed={track ? track.album + track.artist : "idle"} iconSize={22} eager />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-display text-[0.95rem] font-bold", track ? "text-ink" : "text-mute")}>{track?.title ?? "Nothing playing"}</div>
        <div className="truncate text-xs text-mute">{track ? `${track.artist} · ${track.album}` : "Pick an album to start"}</div>
      </div>
      {track && (
        <button className="iconbtn shrink-0" data-on={track.favorite} data-sfx="none" onClick={() => toggleFavorite(track.id)} aria-label="Favorite" title="Favorite (F)">
          <Icon name="heart" size={18} fill={track.favorite} />
        </button>
      )}
    </div>
  );
}

export function PlayerDock() {
  const wide = useMediaQuery("(min-width: 900px)");

  return (
    <footer className="strip relative z-20 shrink-0 border-t border-white/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(0_0_0/0.45)]">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,560px)_minmax(0,1fr)] items-center gap-4 px-6 py-2.5">
          <NowInfo />
          <div className="flex flex-col gap-0.5">
            <Transport />
            <Progress />
          </div>
          <Extras showVolume />
        </div>
      ) : (
        <div className="flex flex-col gap-1 px-3 pb-1.5 pt-2">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <NowInfo />
            </div>
            <Extras showVolume={false} />
          </div>
          <Progress />
          <Transport compact />
        </div>
      )}
    </footer>
  );
}
