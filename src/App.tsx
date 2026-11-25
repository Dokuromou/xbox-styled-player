import { useEffect, useState } from "react";
import { useStore } from "./store";
import { engine } from "./lib/engine";
import { installGlobalSfx } from "./lib/sfx";
import { startGamepad } from "./lib/gamepad";
import { filesFromDrop } from "./lib/metadata";
import type { ThemeId, ViewId } from "./lib/types";
import { Background } from "./components/Background";
import { Header } from "./components/Header";
import { PlayerDock } from "./components/PlayerDock";
import { QueueDrawer } from "./components/QueueDrawer";
import { ModalHost } from "./components/modals/ModalHost";
import { Toasts } from "./components/Toasts";
import { Welcome } from "./components/Welcome";
import { Icon } from "./components/Icons";
import { AlbumsView } from "./views/AlbumsView";
import { SongsView } from "./views/SongsView";
import { PlaylistsView } from "./views/PlaylistsView";
import { FavoritesView } from "./views/FavoritesView";
import { NowPlayingView } from "./views/NowPlayingView";
import { EqualizerView } from "./views/EqualizerView";
import { SystemView } from "./views/SystemView";

const VIEWS: ViewId[] = ["albums", "songs", "playlists", "favorites", "now", "eq", "system"];
const THEMES: ThemeId[] = ["toxic", "neon", "danger"];

function ButtonHints() {
  const setView = useStore((s) => s.setView);
  const togglePlay = useStore((s) => s.togglePlay);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const toggleQueue = useStore((s) => s.toggleQueue);
  const openModal = useStore((s) => s.openModal);
  const shuffle = useStore((s) => s.shuffle);
  const hint = "flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.72rem] font-semibold text-mute transition-colors hover:text-ink";
  return (
    <div className="relative z-10 hidden shrink-0 items-center gap-1 border-t border-white/5 bg-black/30 px-6 py-0.5 md:flex">
      <button className={hint} onClick={togglePlay} data-sfx="none">
        <span className="face face-a !h-5 !w-5 !text-[0.6rem]">A</span> Play / Pause
      </button>
      <button className={hint} onClick={() => setView("albums")} data-sfx="back">
        <span className="face face-b !h-5 !w-5 !text-[0.6rem]">B</span> Albums
      </button>
      <button className={hint} onClick={toggleShuffle} data-sfx="none">
        <span className="face face-x !h-5 !w-5 !text-[0.6rem]">X</span> Shuffle {shuffle ? "on" : "off"}
      </button>
      <button className={hint} onClick={() => toggleQueue(true)}>
        <span className="face face-y !h-5 !w-5 !text-[0.6rem]">Y</span> Queue
      </button>
      <span className="ml-3 hidden items-center gap-1 text-[0.72rem] font-semibold text-mute lg:flex">
        <span className="bumper">LB</span>
        <span className="bumper">RB</span> Switch tab
      </span>
      <button className={`${hint} ml-auto`} onClick={() => openModal({ type: "shortcuts" })}>
        <kbd className="rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[0.65rem]">?</kbd> Shortcuts
      </button>
    </div>
  );
}

function DropOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[96] flex animate-fade-in items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-black/40 px-14 py-12 text-accent shadow-[0_0_60px_rgb(var(--glow)/0.5)]">
        <Icon name="upload" size={48} strokeWidth={1.6} />
        <div className="font-display text-2xl font-bold uppercase tracking-[0.2em]">Drop music here</div>
        <div className="text-sm text-mute">Files or whole folders</div>
      </div>
    </div>
  );
}

function ImportOverlay() {
  const importing = useStore((s) => s.importing);
  if (!importing) return null;
  const pct = importing.total ? Math.round((importing.done / importing.total) * 100) : 0;
  return (
    <div className="panel fixed left-1/2 top-20 z-[92] w-[min(92vw,380px)] -translate-x-1/2 animate-pop px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
        <span className="text-ink">{importing.label}…</span>
        <span className="tabular-nums text-accent">
          {importing.done}/{importing.total || "?"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-accent2 to-accent shadow-[0_0_10px_var(--accent)] transition-all" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  const view = useStore((s) => s.view);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void init();
    installGlobalSfx();
    startGamepad();
    const unlock = () => {
      engine.unlock();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [init]);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === "Escape" && s.showQueue && !s.modal) {
        s.toggleQueue(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (s.modal || e.ctrlKey || e.metaKey || e.altKey) return;
      const inButton = !!t?.closest?.("button,[role=button],[role=slider],[role=switch],[role=tab],a");
      const k = e.key;
      const lower = k.toLowerCase();

      if ((k === " " || lower === "k") && !(k === " " && inButton)) {
        e.preventDefault();
        s.togglePlay();
      } else if (k === "ArrowRight" && (s.view !== "albums" || e.shiftKey)) {
        e.preventDefault();
        s.seekBy(e.shiftKey ? 10 : 5);
      } else if (k === "ArrowLeft" && (s.view !== "albums" || e.shiftKey)) {
        e.preventDefault();
        s.seekBy(e.shiftKey ? -10 : -5);
      } else if ((k === "ArrowUp" || k === "+" || k === "=") && (e.shiftKey || k !== "ArrowUp")) {
        e.preventDefault();
        s.setVolume(s.volume + 0.05);
      } else if ((k === "ArrowDown" || k === "-" || k === "_") && (e.shiftKey || k !== "ArrowDown")) {
        e.preventDefault();
        s.setVolume(s.volume - 0.05);
      } else if (lower === "n") s.next();
      else if (lower === "p") s.prev();
      else if (lower === "m") s.toggleMute();
      else if (lower === "f" && s.currentId) s.toggleFavorite(s.currentId);
      else if (lower === "s") s.toggleShuffle();
      else if (lower === "r") s.cycleRepeat();
      else if (lower === "q") s.toggleQueue();
      else if (lower === "l") {
        s.setNowTab("lyrics");
        s.setView("now");
      } else if (lower === "e") s.setView("eq");
      else if (lower === "t") s.setTheme(THEMES[(THEMES.indexOf(s.theme) + 1) % THEMES.length]);
      else if (k >= "1" && k <= "7") s.setView(VIEWS[parseInt(k, 10) - 1]);
      else if (k === "/") {
        e.preventDefault();
        s.setView("songs");
        setTimeout(() => window.dispatchEvent(new Event("bb:focus-search")), 60);
      } else if (k === "?") s.openModal({ type: "shortcuts" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // drag & drop files or folders anywhere
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer) void filesFromDrop(e.dataTransfer).then((files) => useStore.getState().addFiles(files));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <Background />
      <Header />
      <main className="relative z-10 min-h-0 flex-1">
        <div key={view} className="h-full animate-fade-in">
          {view === "albums" && <AlbumsView />}
          {view === "songs" && <SongsView />}
          {view === "playlists" && <PlaylistsView />}
          {view === "favorites" && <FavoritesView />}
          {view === "now" && <NowPlayingView />}
          {view === "eq" && <EqualizerView />}
          {view === "system" && <SystemView />}
        </div>
      </main>
      <ButtonHints />
      <PlayerDock />
      <QueueDrawer />
      <ModalHost />
      <ImportOverlay />
      <Toasts />
      <Welcome />
      <DropOverlay active={dragging} />
    </div>
  );
}
