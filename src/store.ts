import { create } from "zustand";
import type { Album, EqState, ModalState, Playlist, RepeatMode, ThemeId, Toast, Track, ViewId } from "./lib/types";
import { db } from "./lib/db";
import { engine, DEFAULT_EQ, EQ_PRESETS } from "./lib/engine";
import { sfx } from "./lib/sfx";
import { buildAlbums, type AlbumSort } from "./lib/albums";
import { coverFromImageFile, importFiles, isAudioFile, pickFiles, type ImportHooks } from "./lib/metadata";
import { generateDemo } from "./lib/demo";
import { shuffleArray, uid } from "./lib/format";

/* ───────────────────────── persisted settings ───────────────────────── */
const LS_SETTINGS = "bladebeat:settings:v1";
const LS_QUEUE = "bladebeat:queue:v1";
const LS_LAST = "bladebeat:last:v1";

interface Persisted {
  theme: ThemeId;
  sfxOn: boolean;
  sfxVolume: number;
  sfxHover: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  rate: number;
  eq: EqState;
  vizMode: number;
  welcomed: boolean;
  albumSort: AlbumSort;
  selectedAlbumId: string | null;
}

const DEFAULTS: Persisted = {
  theme: "toxic",
  sfxOn: true,
  sfxVolume: 0.55,
  sfxHover: true,
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: "off",
  rate: 1,
  eq: DEFAULT_EQ,
  vizMode: 0,
  welcomed: false,
  albumSort: "artist",
  selectedAlbumId: null,
};

function loadSettings(): Persisted {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return { ...DEFAULTS, eq: { ...DEFAULT_EQ, gains: DEFAULT_EQ.gains.slice() } };
    const p = JSON.parse(raw) as Partial<Persisted>;
    const eq = { ...DEFAULT_EQ, ...(p.eq ?? {}) };
    if (!Array.isArray(eq.gains) || eq.gains.length !== 10) eq.gains = DEFAULT_EQ.gains.slice();
    return { ...DEFAULTS, ...p, eq };
  } catch {
    return { ...DEFAULTS };
  }
}

const saved = loadSettings();

const THEME_COLORS: Record<ThemeId, string> = { toxic: "#040803", neon: "#030614", danger: "#080203" };

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  sfx.configure({ theme });
}

// Apply immediately so there is no flash of the wrong theme.
applyTheme(saved.theme);
sfx.configure({ enabled: saved.sfxOn, volume: saved.sfxVolume, hover: saved.sfxHover, theme: saved.theme });
engine.setVolume(saved.volume, saved.muted);
engine.setEq(saved.eq);
engine.audio.defaultPlaybackRate = saved.rate;
engine.audio.playbackRate = saved.rate;

/* ───────────────────────── store typing ───────────────────────── */
export interface Store {
  ready: boolean;
  tracks: Record<string, Track>;
  albums: Album[];
  playlists: Playlist[];
  covers: Record<string, string>;
  importing: { done: number; total: number; label: string } | null;
  storage: { persisted: boolean | null; usage: number; quota: number };

  currentId: string | null;
  playing: boolean;
  loading: boolean;
  duration: number;
  queue: string[];
  baseQueue: string[];
  qi: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  rate: number;

  sleep: null | { mode: "time" | "track"; endsAt: number };
  sleepLeft: number;

  eq: EqState;

  view: ViewId;
  theme: ThemeId;
  sfxOn: boolean;
  sfxVolume: number;
  sfxHover: boolean;
  vizMode: number;
  showQueue: boolean;
  modal: ModalState | null;
  toasts: Toast[];
  welcomed: boolean;
  albumSort: AlbumSort;
  selectedAlbumId: string | null;
  nowTab: "viz" | "lyrics";

  init: () => Promise<void>;
  setView: (v: ViewId) => void;
  setTheme: (t: ThemeId) => void;
  setSfx: (p: { on?: boolean; volume?: number; hover?: boolean }) => void;
  setVizMode: (m: number) => void;
  setNowTab: (t: "viz" | "lyrics") => void;
  toggleQueue: (open?: boolean) => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissWelcome: () => void;
  setAlbumSort: (s: AlbumSort) => void;
  setSelectedAlbum: (id: string | null) => void;

  addFiles: (files: File[]) => Promise<void>;
  pickAndAdd: (directory?: boolean) => Promise<void>;
  loadDemo: () => Promise<void>;
  requestPersistence: () => Promise<void>;

  playList: (ids: string[], opts?: { startId?: string; shuffle?: boolean }) => void;
  playIndex: (i: number) => void;
  togglePlay: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (t: number) => void;
  seekBy: (d: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setRate: (r: number) => void;
  enqueueNext: (ids: string[]) => void;
  enqueueLast: (ids: string[]) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (i: number, dir: -1 | 1) => void;
  clearQueue: () => void;

  toggleFavorite: (id: string) => void;
  updateTracks: (patches: Record<string, Partial<Track>>) => void;
  setCover: (ids: string[], file: Blob) => Promise<void>;
  deleteTracks: (ids: string[]) => Promise<void>;
  clearLibrary: () => Promise<void>;

  createPlaylist: (name: string, ids?: string[]) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (pid: string, ids: string[]) => void;
  removeFromPlaylist: (pid: string, index: number) => void;

  setSleep: (spec: number | "track" | null) => void;
  setEq: (patch: Partial<EqState>) => void;
  setEqBand: (i: number, v: number) => void;
  setEqPreset: (name: string) => void;

  exportData: () => string;
  importData: (json: string) => { tracks: number; playlists: number };
}

/* ───────────────────────── module state ───────────────────────── */
let loadToken = 0;
let currentUrl: string | null = null;
let countedFor: string | null = null;
let initPromise: Promise<void> | null = null;
let sleepTicker: number | null = null;
let toastId = 1;
let lastSaveAt = 0;
const SLEEP_FADE = 20;

export const useStore = create<Store>((set, get) => {
  /* helpers that need set/get */
  const commit = (tracks: Record<string, Track>) => set({ tracks, albums: buildAlbums(Object.values(tracks)) });

  const toast: Store["toast"] = (message, kind = "info") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, kind }] }));
    if (kind === "error") sfx.play("error");
    else sfx.play("toast");
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
  };

  const updateMediaSession = () => {
    if (!("mediaSession" in navigator)) return;
    const { currentId, tracks, covers } = get();
    const t = currentId ? tracks[currentId] : null;
    if (!t) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const cover = t.coverId ? covers[t.coverId] : null;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album,
        artwork: cover ? [{ src: cover, sizes: "480x480", type: "image/jpeg" }] : [],
      });
    } catch {
      /* ignore */
    }
  };

  const saveLast = () => {
    const { currentId } = get();
    if (!currentId) return;
    try {
      localStorage.setItem(LS_LAST, JSON.stringify({ id: currentId, time: engine.audio.currentTime || 0 }));
    } catch {
      /* ignore */
    }
  };

  async function loadTrack(id: string, opts: { autoplay: boolean; startAt?: number }) {
    const token = ++loadToken;
    const t = get().tracks[id];
    if (!t) return;
    if (opts.autoplay) {
      // start the audio graph inside the user gesture (iOS/Safari requirement)
      void engine.resume();
    }
    set({ currentId: id, loading: true, duration: t.duration });
    countedFor = null;
    const blob = await db.getFile(id);
    if (token !== loadToken) return;
    if (!blob) {
      set({ loading: false, playing: false });
      toast(`“${t.title}” is missing from storage – try re-adding the file`, "error");
      return;
    }
    engine.unlocking = false;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    const a = engine.audio;
    a.src = currentUrl;
    a.defaultPlaybackRate = get().rate;
    a.playbackRate = get().rate;
    if (opts.startAt && opts.startAt > 1) {
      const startAt = opts.startAt;
      const once = () => {
        try {
          a.currentTime = startAt;
        } catch {
          /* ignore */
        }
        a.removeEventListener("loadedmetadata", once);
      };
      a.addEventListener("loadedmetadata", once);
    }
    updateMediaSession();
    if (opts.autoplay) {
      try {
        await a.play();
      } catch (e) {
        if (token !== loadToken) return;
        set({ playing: false, loading: false });
        if ((e as DOMException)?.name !== "AbortError") toast("Press play to start playback", "info");
      }
    } else {
      set({ loading: false });
    }
  }

  function playIndex(i: number) {
    const { queue } = get();
    if (i < 0 || i >= queue.length) return;
    set({ qi: i });
    void loadTrack(queue[i], { autoplay: true });
  }

  function advance(auto: boolean) {
    const { queue, qi, repeat, shuffle, baseQueue, currentId } = get();
    if (!queue.length) return;
    if (qi + 1 < queue.length) {
      playIndex(qi + 1);
      return;
    }
    if (repeat === "all" || !auto) {
      if (shuffle && queue.length > 1) {
        let q = shuffleArray(baseQueue.length ? baseQueue : queue);
        if (q[0] === currentId) q = [...q.slice(1), q[0]];
        set({ queue: q, qi: 0 });
      }
      playIndex(0);
      return;
    }
    engine.audio.pause();
    engine.audio.currentTime = 0;
    set({ playing: false });
  }

  function clearSleepTicker() {
    if (sleepTicker !== null) {
      clearInterval(sleepTicker);
      sleepTicker = null;
    }
  }

  function startSleepTicker() {
    clearSleepTicker();
    sleepTicker = window.setInterval(() => {
      const s = get().sleep;
      if (!s || s.mode !== "time") {
        clearSleepTicker();
        return;
      }
      const left = (s.endsAt - Date.now()) / 1000;
      if (left <= 0) {
        engine.audio.pause();
        engine.setFade(1);
        set({ sleep: null, sleepLeft: 0 });
        clearSleepTicker();
        toast("Sleep timer finished – goodnight 🌙", "success");
        return;
      }
      set({ sleepLeft: Math.ceil(left) });
      engine.setFade(left < SLEEP_FADE ? left / SLEEP_FADE : 1);
    }, 500);
  }

  function onEnded() {
    const s = get();
    if (s.sleep?.mode === "track") {
      engine.audio.pause();
      engine.setFade(1);
      set({ sleep: null, sleepLeft: 0, playing: false });
      toast("Sleep timer finished – goodnight 🌙", "success");
      return;
    }
    if (s.repeat === "one") {
      engine.audio.currentTime = 0;
      void engine.audio.play();
      return;
    }
    advance(true);
  }

  function onTimeUpdate() {
    const a = engine.audio;
    const { currentId, sleep } = get();
    if (currentId && countedFor !== currentId && a.currentTime > Math.min(20, (a.duration || 60) * 0.5)) {
      countedFor = currentId;
      const t = get().tracks[currentId];
      if (t) {
        const nt = { ...t, plays: t.plays + 1, lastPlayed: Date.now() };
        void db.putTracks([nt]);
        commit({ ...get().tracks, [currentId]: nt });
      }
    }
    if (sleep?.mode === "track" && a.duration && a.duration - a.currentTime < 10) {
      engine.setFade(Math.max(0, (a.duration - a.currentTime) / 10));
    }
    const now = Date.now();
    if (now - lastSaveAt > 2500) {
      lastSaveAt = now;
      saveLast();
      if ("mediaSession" in navigator && Number.isFinite(a.duration) && a.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: a.duration,
            position: Math.min(a.currentTime, a.duration),
            playbackRate: a.playbackRate || 1,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }

  function bindAudio() {
    const a = engine.audio;
    a.addEventListener("play", () => !engine.unlocking && set({ playing: true }));
    a.addEventListener("playing", () => !engine.unlocking && set({ playing: true, loading: false }));
    a.addEventListener("pause", () => {
      if (engine.unlocking) return;
      set({ playing: false });
      saveLast();
    });
    a.addEventListener("waiting", () => set({ loading: true }));
    a.addEventListener("canplay", () => set({ loading: false }));
    a.addEventListener("ended", () => !engine.unlocking && onEnded());
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("loadedmetadata", () => {
      const { currentId, tracks } = get();
      if (!currentId || !Number.isFinite(a.duration)) return;
      const t = tracks[currentId];
      set({ duration: a.duration });
      if (t && Math.abs(t.duration - a.duration) > 1.5) {
        const nt = { ...t, duration: a.duration };
        void db.putTracks([nt]);
        commit({ ...get().tracks, [currentId]: nt });
      }
    });
    a.addEventListener("error", () => {
      if (engine.unlocking || !a.getAttribute("src")) return;
      const { currentId, tracks } = get();
      const t = currentId ? tracks[currentId] : null;
      set({ loading: false, playing: false });
      toast(`Can't play “${t?.title ?? "this file"}” – format not supported by this browser`, "error");
      if (get().queue.length > 1) setTimeout(() => advance(true), 900);
    });

    window.addEventListener("pagehide", saveLast);

    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      const safe = (action: MediaSessionAction, fn: MediaSessionActionHandler) => {
        try {
          ms.setActionHandler(action, fn);
        } catch {
          /* unsupported */
        }
      };
      safe("play", () => get().togglePlay());
      safe("pause", () => engine.audio.pause());
      safe("previoustrack", () => get().prev());
      safe("nexttrack", () => get().next());
      safe("seekbackward", () => get().seekBy(-10));
      safe("seekforward", () => get().seekBy(10));
      safe("seekto", (d) => {
        if (typeof d.seekTime === "number") get().seek(d.seekTime);
      });
    }
  }

  async function runImport(
    label: string,
    runner: (existing: Set<string>, hooks: ImportHooks) => Promise<{ added: number; failed?: number; skipped?: number }>
  ) {
    if (get().importing) {
      toast("An import is already running");
      return;
    }
    set({ importing: { done: 0, total: 0, label } });
    const existing = new Set(Object.values(get().tracks).map((t) => t.sig));
    let newTracks: Track[] = [];
    let newCovers: { id: string; blob: Blob }[] = [];
    const flush = () => {
      if (!newTracks.length && !newCovers.length) return;
      const tracks = { ...get().tracks };
      newTracks.forEach((t) => (tracks[t.id] = t));
      const covers = { ...get().covers };
      newCovers.forEach((c) => {
        if (!covers[c.id]) covers[c.id] = URL.createObjectURL(c.blob);
      });
      newTracks = [];
      newCovers = [];
      set({ tracks, covers, albums: buildAlbums(Object.values(tracks)) });
    };
    const timer = window.setInterval(flush, 350);
    try {
      const res = await runner(existing, {
        onProgress: (done, total) => set({ importing: { done, total, label } }),
        onAdded: (t, cover) => {
          newTracks.push(t);
          if (cover) newCovers.push(cover);
        },
      });
      flush();
      if (res.added > 0) {
        sfx.play("add");
        toast(`Added ${res.added} track${res.added === 1 ? "" : "s"} to your library`, "success");
      } else if (res.skipped) {
        toast("Those files are already in your library");
      } else if (res.failed) {
        toast("Could not read those files", "error");
      }
      if (res.failed && res.added > 0) toast(`${res.failed} file(s) could not be read`, "error");
      set({ welcomed: true });
      void get().requestPersistence();
    } catch (e) {
      console.error(e);
      toast("Import failed – storage may be full", "error");
    } finally {
      clearInterval(timer);
      flush();
      set({ importing: null });
    }
  }

  return {
    ready: false,
    tracks: {},
    albums: [],
    playlists: [],
    covers: {},
    importing: null,
    storage: { persisted: null, usage: 0, quota: 0 },

    currentId: null,
    playing: false,
    loading: false,
    duration: 0,
    queue: [],
    baseQueue: [],
    qi: -1,
    shuffle: saved.shuffle,
    repeat: saved.repeat,
    volume: saved.volume,
    muted: saved.muted,
    rate: saved.rate,

    sleep: null,
    sleepLeft: 0,

    eq: saved.eq,

    view: "albums",
    theme: saved.theme,
    sfxOn: saved.sfxOn,
    sfxVolume: saved.sfxVolume,
    sfxHover: saved.sfxHover,
    vizMode: saved.vizMode,
    showQueue: false,
    modal: null,
    toasts: [],
    welcomed: saved.welcomed,
    albumSort: saved.albumSort,
    selectedAlbumId: saved.selectedAlbumId,
    nowTab: "viz",

    init: () => {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        bindAudio();
        try {
          const data = await db.loadAll();
          const tracks: Record<string, Track> = {};
          data.tracks.forEach((t) => (tracks[t.id] = t));
          const covers: Record<string, string> = {};
          data.covers.forEach((c) => (covers[c.id] = URL.createObjectURL(c.blob)));
          set({
            tracks,
            covers,
            albums: buildAlbums(data.tracks),
            playlists: data.playlists.sort((a, b) => a.createdAt - b.createdAt),
          });

          // restore the previous queue (paused) so you can pick up where you left off
          try {
            const q = JSON.parse(localStorage.getItem(LS_QUEUE) || "null") as { queue: string[]; base: string[]; qi: number } | null;
            const last = JSON.parse(localStorage.getItem(LS_LAST) || "null") as { id: string; time: number } | null;
            if (q && last && tracks[last.id]) {
              const queue = q.queue.filter((id) => tracks[id]);
              const qi = queue.indexOf(last.id);
              if (qi >= 0) {
                set({ queue, baseQueue: q.base.filter((id) => tracks[id]), qi });
                await loadTrack(last.id, { autoplay: false, startAt: last.time });
              }
            }
          } catch {
            /* ignore corrupt state */
          }
        } catch (e) {
          console.error("Failed to open library", e);
          toast("Could not open local storage – is private browsing on?", "error");
        }
        set({ ready: true });
        updateMediaSession();
        try {
          const persisted = (await navigator.storage?.persisted?.()) ?? null;
          const est = (await navigator.storage?.estimate?.()) ?? {};
          set({ storage: { persisted, usage: est.usage ?? 0, quota: est.quota ?? 0 } });
        } catch {
          /* ignore */
        }
      })();
      return initPromise;
    },

    setView: (view) => set({ view }),
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    setSfx: (p) => {
      const next = {
        sfxOn: p.on ?? get().sfxOn,
        sfxVolume: p.volume ?? get().sfxVolume,
        sfxHover: p.hover ?? get().sfxHover,
      };
      set(next);
      if (p.on === false) sfx.play("off"); // play before disabling
      sfx.configure({ enabled: next.sfxOn, volume: next.sfxVolume, hover: next.sfxHover });
      if (p.on === true) sfx.play("on");
    },
    setVizMode: (vizMode) => set({ vizMode }),
    setNowTab: (nowTab) => set({ nowTab }),
    toggleQueue: (open) => set((s) => ({ showQueue: open ?? !s.showQueue })),
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null }),
    toast,
    dismissWelcome: () => set({ welcomed: true }),
    setAlbumSort: (albumSort) => set({ albumSort }),
    setSelectedAlbum: (selectedAlbumId) => set({ selectedAlbumId }),

    addFiles: async (files) => {
      const audio = files.filter(isAudioFile);
      if (!audio.length) {
        if (files.length) toast("No supported audio files found in that selection", "error");
        return;
      }
      await runImport("Importing", (existing, hooks) => importFiles(audio, existing, hooks));
    },
    pickAndAdd: async (directory) => {
      const files = await pickFiles({ directory });
      if (files.length) await get().addFiles(files);
      else set({ welcomed: true });
    },
    loadDemo: async () => {
      await runImport("Generating demo tracks", (existing, hooks) => generateDemo(existing, hooks));
    },
    requestPersistence: async () => {
      try {
        if (navigator.storage?.persist) {
          const ok = await navigator.storage.persist();
          const est = (await navigator.storage.estimate?.()) ?? {};
          set({ storage: { persisted: ok, usage: est.usage ?? 0, quota: est.quota ?? 0 } });
        }
      } catch {
        /* ignore */
      }
    },

    /* ───────── playback ───────── */
    playList: (ids, opts = {}) => {
      const list = ids.filter((id) => get().tracks[id]);
      if (!list.length) return;
      const shuffle = opts.shuffle ?? get().shuffle;
      const startId = opts.startId && list.includes(opts.startId) ? opts.startId : shuffle ? list[Math.floor(Math.random() * list.length)] : list[0];
      let queue = list.slice();
      let qi = list.indexOf(startId);
      if (shuffle) {
        const rest = list.filter((_, i) => i !== qi);
        queue = [startId, ...shuffleArray(rest)];
        qi = 0;
      }
      set({ queue, baseQueue: list.slice(), qi, shuffle });
      void loadTrack(queue[qi], { autoplay: true });
    },
    playIndex,
    togglePlay: () => {
      const a = engine.audio;
      const { currentId, queue } = get();
      if (!currentId) {
        const all = get().albums.flatMap((al) => al.trackIds);
        if (queue.length) playIndex(Math.max(0, get().qi));
        else if (all.length) get().playList(all);
        return;
      }
      if (a.paused) {
        void engine.resume();
        engine.setFade(1);
        if (!a.getAttribute("src")) {
          void loadTrack(currentId, { autoplay: true });
          return;
        }
        a.play().catch(() => undefined);
        sfx.play("play");
      } else {
        a.pause();
        sfx.play("pause");
      }
    },
    next: (auto = false) => advance(auto),
    prev: () => {
      const { qi, queue, repeat } = get();
      const a = engine.audio;
      if (a.currentTime > 3 || !queue.length) {
        a.currentTime = 0;
        return;
      }
      if (qi > 0) playIndex(qi - 1);
      else if (repeat === "all") playIndex(queue.length - 1);
      else a.currentTime = 0;
    },
    seek: (t) => {
      const a = engine.audio;
      if (Number.isFinite(t)) a.currentTime = Math.max(0, Math.min(t, a.duration || t));
    },
    seekBy: (d) => get().seek(engine.audio.currentTime + d),
    setVolume: (volume) => {
      const v = Math.max(0, Math.min(1, volume));
      set({ volume: v, muted: false });
      engine.setVolume(v, false);
    },
    toggleMute: () => {
      const muted = !get().muted;
      set({ muted });
      engine.setVolume(get().volume, muted);
    },
    toggleShuffle: () => {
      const { shuffle, queue, qi, baseQueue } = get();
      const cur = queue[qi];
      if (!shuffle) {
        if (queue.length > 1 && qi >= 0) {
          const rest = queue.filter((_, i) => i !== qi);
          set({ shuffle: true, baseQueue: queue.slice(), queue: [cur, ...shuffleArray(rest)], qi: 0 });
        } else set({ shuffle: true });
      } else {
        const base = baseQueue.length ? baseQueue : queue;
        const idx = Math.max(0, base.indexOf(cur));
        set({ shuffle: false, queue: base.slice(), qi: cur ? idx : qi });
      }
    },
    cycleRepeat: () => set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
    setRate: (rate) => {
      set({ rate });
      engine.audio.defaultPlaybackRate = rate;
      engine.audio.playbackRate = rate;
    },
    enqueueNext: (ids) => {
      const list = ids.filter((id) => get().tracks[id]);
      if (!list.length) return;
      const { queue, qi, baseQueue } = get();
      if (!queue.length || qi < 0) {
        get().playList(list, { shuffle: false });
        return;
      }
      const q = queue.slice();
      q.splice(qi + 1, 0, ...list);
      set({ queue: q, baseQueue: [...baseQueue, ...list] });
      toast(list.length === 1 ? "Playing next" : `${list.length} tracks play next`, "success");
    },
    enqueueLast: (ids) => {
      const list = ids.filter((id) => get().tracks[id]);
      if (!list.length) return;
      const { queue, qi, baseQueue } = get();
      if (!queue.length || qi < 0) {
        get().playList(list, { shuffle: false });
        return;
      }
      set({ queue: [...queue, ...list], baseQueue: [...baseQueue, ...list] });
      toast(list.length === 1 ? "Added to queue" : `${list.length} tracks added to queue`, "success");
    },
    removeFromQueue: (i) => {
      const { queue, qi, baseQueue } = get();
      if (i === qi || i < 0 || i >= queue.length) return;
      const id = queue[i];
      const q = queue.filter((_, k) => k !== i);
      const bi = baseQueue.indexOf(id);
      const base = bi >= 0 ? baseQueue.filter((_, k) => k !== bi) : baseQueue;
      set({ queue: q, baseQueue: base, qi: i < qi ? qi - 1 : qi });
    },
    moveInQueue: (i, dir) => {
      const { queue, qi } = get();
      const j = i + dir;
      if (j < 0 || j >= queue.length) return;
      const q = queue.slice();
      [q[i], q[j]] = [q[j], q[i]];
      let nqi = qi;
      if (qi === i) nqi = j;
      else if (qi === j) nqi = i;
      set({ queue: q, qi: nqi });
    },
    clearQueue: () => {
      const { queue, qi } = get();
      const cur = queue[qi];
      if (!cur) set({ queue: [], baseQueue: [], qi: -1 });
      else set({ queue: [cur], baseQueue: [cur], qi: 0 });
    },

    /* ───────── library ───────── */
    toggleFavorite: (id) => {
      const t = get().tracks[id];
      if (!t) return;
      const nt = { ...t, favorite: !t.favorite };
      void db.putTracks([nt]);
      commit({ ...get().tracks, [id]: nt });
      sfx.play(nt.favorite ? "heart" : "back");
    },
    updateTracks: (patches) => {
      const tracks = { ...get().tracks };
      const changed: Track[] = [];
      for (const [id, p] of Object.entries(patches)) {
        if (!tracks[id]) continue;
        tracks[id] = { ...tracks[id], ...p, id };
        changed.push(tracks[id]);
      }
      if (!changed.length) return;
      void db.putTracks(changed);
      commit(tracks);
      const cur = get().currentId;
      if (cur && patches[cur]) updateMediaSession();
    },
    setCover: async (ids, file) => {
      try {
        const cover = await coverFromImageFile(file);
        await db.putCover(cover.id, cover.blob);
        const covers = { ...get().covers };
        if (!covers[cover.id]) covers[cover.id] = URL.createObjectURL(cover.blob);
        set({ covers });
        const patches: Record<string, Partial<Track>> = {};
        ids.forEach((id) => (patches[id] = { coverId: cover.id }));
        get().updateTracks(patches);
        updateMediaSession();
      } catch {
        toast("Could not use that image", "error");
      }
    },
    deleteTracks: async (ids) => {
      const set_ = new Set(ids);
      const s = get();
      const tracks = { ...s.tracks };
      ids.forEach((id) => delete tracks[id]);
      // queue
      const queue = s.queue.filter((id) => !set_.has(id));
      const baseQueue = s.baseQueue.filter((id) => !set_.has(id));
      let currentId = s.currentId;
      let qi = s.qi;
      if (currentId && set_.has(currentId)) {
        engine.audio.pause();
        engine.audio.removeAttribute("src");
        engine.audio.load();
        loadToken++;
        currentId = null;
        qi = -1;
        set({ playing: false, loading: false });
      } else if (currentId) {
        qi = queue.indexOf(currentId);
      }
      // playlists
      const playlists = s.playlists.map((p) =>
        p.trackIds.some((id) => set_.has(id)) ? { ...p, trackIds: p.trackIds.filter((id) => !set_.has(id)) } : p
      );
      playlists.forEach((p, i) => {
        if (p !== s.playlists[i]) void db.putPlaylist(p);
      });
      // orphaned covers
      const used = new Set(Object.values(tracks).map((t) => t.coverId).filter(Boolean) as string[]);
      const orphan = Object.keys(s.covers).filter((c) => !used.has(c));
      const covers = { ...s.covers };
      orphan.forEach((c) => {
        URL.revokeObjectURL(covers[c]);
        delete covers[c];
      });
      await db.deleteTracks(ids);
      await db.deleteCovers(orphan);
      set({ tracks, albums: buildAlbums(Object.values(tracks)), queue, baseQueue, currentId, qi, playlists, covers });
      updateMediaSession();
      toast(`Removed ${ids.length} track${ids.length === 1 ? "" : "s"}`);
    },
    clearLibrary: async () => {
      engine.audio.pause();
      engine.audio.removeAttribute("src");
      engine.audio.load();
      loadToken++;
      Object.values(get().covers).forEach((u) => URL.revokeObjectURL(u));
      await db.clearAll();
      localStorage.removeItem(LS_QUEUE);
      localStorage.removeItem(LS_LAST);
      set({
        tracks: {},
        albums: [],
        playlists: [],
        covers: {},
        currentId: null,
        queue: [],
        baseQueue: [],
        qi: -1,
        playing: false,
        selectedAlbumId: null,
      });
      updateMediaSession();
      toast("Library cleared");
    },

    /* ───────── playlists ───────── */
    createPlaylist: (name, ids = []) => {
      const p: Playlist = { id: uid(), name: name.trim() || "New Playlist", trackIds: ids.filter((id) => get().tracks[id]), createdAt: Date.now() };
      void db.putPlaylist(p);
      set((s) => ({ playlists: [...s.playlists, p] }));
      return p.id;
    },
    renamePlaylist: (id, name) => {
      const p = get().playlists.find((x) => x.id === id);
      if (!p) return;
      const np = { ...p, name: name.trim() || p.name };
      void db.putPlaylist(np);
      set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? np : x)) }));
    },
    deletePlaylist: (id) => {
      void db.deletePlaylist(id);
      set((s) => ({ playlists: s.playlists.filter((x) => x.id !== id) }));
    },
    addToPlaylist: (pid, ids) => {
      const p = get().playlists.find((x) => x.id === pid);
      if (!p) return;
      const fresh = ids.filter((id) => !p.trackIds.includes(id));
      if (!fresh.length) {
        toast(`Already in “${p.name}”`);
        return;
      }
      const np = { ...p, trackIds: [...p.trackIds, ...fresh] };
      void db.putPlaylist(np);
      set((s) => ({ playlists: s.playlists.map((x) => (x.id === pid ? np : x)) }));
      toast(`Added ${fresh.length} to “${p.name}”`, "success");
    },
    removeFromPlaylist: (pid, index) => {
      const p = get().playlists.find((x) => x.id === pid);
      if (!p) return;
      const np = { ...p, trackIds: p.trackIds.filter((_, i) => i !== index) };
      void db.putPlaylist(np);
      set((s) => ({ playlists: s.playlists.map((x) => (x.id === pid ? np : x)) }));
    },

    /* ───────── sleep timer / EQ ───────── */
    setSleep: (spec) => {
      clearSleepTicker();
      engine.setFade(1);
      if (spec === null) {
        set({ sleep: null, sleepLeft: 0 });
        toast("Sleep timer off");
      } else if (spec === "track") {
        set({ sleep: { mode: "track", endsAt: 0 }, sleepLeft: 0 });
        toast("Music will stop after this track", "success");
      } else {
        set({ sleep: { mode: "time", endsAt: Date.now() + spec * 60000 }, sleepLeft: spec * 60 });
        startSleepTicker();
        toast(`Sleep timer set for ${spec} min`, "success");
      }
    },
    setEq: (patch) => {
      const eq = { ...get().eq, ...patch };
      set({ eq });
      engine.setEq(eq);
    },
    setEqBand: (i, v) => {
      const gains = get().eq.gains.slice();
      gains[i] = Math.max(-12, Math.min(12, Math.round(v * 2) / 2));
      get().setEq({ gains, preset: "Custom" });
    },
    setEqPreset: (name) => {
      const g = EQ_PRESETS[name];
      if (g) get().setEq({ gains: g.slice(), preset: name, enabled: true });
    },

    /* ───────── backup ───────── */
    exportData: () => {
      const { tracks, playlists } = get();
      const list = Object.values(tracks);
      return JSON.stringify(
        {
          app: "bladebeat",
          version: 1,
          exportedAt: new Date().toISOString(),
          tracks: list.map((t) => ({
            sig: t.sig,
            title: t.title,
            artist: t.artist,
            albumArtist: t.albumArtist,
            album: t.album,
            trackNo: t.trackNo,
            trackOf: t.trackOf,
            discNo: t.discNo,
            year: t.year,
            genre: t.genre,
            lyrics: t.lyrics,
            favorite: t.favorite,
            plays: t.plays,
          })),
          playlists: playlists.map((p) => ({
            name: p.name,
            sigs: p.trackIds.map((id) => tracks[id]?.sig).filter(Boolean),
          })),
        },
        null,
        2
      );
    },
    importData: (json) => {
      const data = JSON.parse(json) as {
        app?: string;
        tracks?: (Partial<Track> & { sig: string })[];
        playlists?: { name: string; sigs: string[] }[];
      };
      if (data.app !== "bladebeat") throw new Error("Not a Bladebeat backup");
      const bySig = new Map(Object.values(get().tracks).map((t) => [t.sig, t.id]));
      const patches: Record<string, Partial<Track>> = {};
      for (const t of data.tracks ?? []) {
        const id = bySig.get(t.sig);
        if (!id) continue;
        const { sig: _sig, ...rest } = t;
        void _sig;
        patches[id] = rest;
      }
      get().updateTracks(patches);
      let pl = 0;
      for (const p of data.playlists ?? []) {
        const ids = p.sigs.map((s) => bySig.get(s)).filter(Boolean) as string[];
        const existing = get().playlists.find((x) => x.name === p.name);
        if (existing) get().addToPlaylist(existing.id, ids);
        else get().createPlaylist(p.name, ids);
        pl++;
      }
      return { tracks: Object.keys(patches).length, playlists: pl };
    },
  };
});

/* ───────────────────────── persistence subscriptions ───────────────────────── */
let settingsTimer: number | null = null;
let lastJson = "";
useStore.subscribe((s, prev) => {
  if (s.queue !== prev.queue || s.baseQueue !== prev.baseQueue || s.qi !== prev.qi) {
    try {
      localStorage.setItem(LS_QUEUE, JSON.stringify({ queue: s.queue, base: s.baseQueue, qi: s.qi }));
    } catch {
      /* ignore quota */
    }
  }
  if (settingsTimer) return;
  settingsTimer = window.setTimeout(() => {
    settingsTimer = null;
    const st = useStore.getState();
    const p: Persisted = {
      theme: st.theme,
      sfxOn: st.sfxOn,
      sfxVolume: st.sfxVolume,
      sfxHover: st.sfxHover,
      volume: st.volume,
      muted: st.muted,
      shuffle: st.shuffle,
      repeat: st.repeat,
      rate: st.rate,
      eq: st.eq,
      vizMode: st.vizMode,
      welcomed: st.welcomed,
      albumSort: st.albumSort,
      selectedAlbumId: st.selectedAlbumId,
    };
    const json = JSON.stringify(p);
    if (json !== lastJson) {
      lastJson = json;
      try {
        localStorage.setItem(LS_SETTINGS, json);
      } catch {
        /* ignore */
      }
    }
  }, 400);
});
