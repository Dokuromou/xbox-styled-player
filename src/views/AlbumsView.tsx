import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore } from "../store";
import { sortAlbums, type AlbumSort } from "../lib/albums";
import type { Album } from "../lib/types";
import { fmtLong, pluralize } from "../lib/format";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";
import { CoverArt } from "../components/Cover";
import { Icon } from "../components/Icons";
import { TrackList } from "../components/TrackList";
import { MenuButton } from "../components/MenuButton";

type Item = { kind: "album"; album: Album } | { kind: "add" };

const SORTS: { id: AlbumSort; label: string }[] = [
  { id: "artist", label: "Artist" },
  { id: "title", label: "Title" },
  { id: "recent", label: "Recently added" },
  { id: "year", label: "Year" },
];

function AlbumCase({ album, selected, playing }: { album: Album; selected: boolean; playing: boolean }) {
  return (
    <div className={cn("case", selected && "case-selected")}>
      <div className="absolute inset-x-0 top-0 z-[2] flex h-[9%] items-center justify-between bg-gradient-to-b from-accent to-accent2 pl-[12%] pr-[7%] font-display text-[clamp(0.45rem,0.95vh,0.62rem)] font-bold uppercase tracking-[0.18em] text-onaccent">
        <span>Music</span>
        {playing ? (
          <span className="eqbars [&_i]:!bg-onaccent" data-paused="false">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span>{album.trackIds.length} trk</span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[9%]">
        <CoverArt coverId={album.coverId} seed={album.title + album.artist} iconSize={46} />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/95 via-black/60 to-transparent pb-[7%] pl-[12%] pr-[7%] pt-[30%] text-left">
        <div className="line-clamp-2 font-display text-[clamp(0.7rem,1.7vh,1rem)] font-bold leading-tight text-white">{album.title}</div>
        <div className="mt-0.5 truncate text-[clamp(0.55rem,1.2vh,0.75rem)] text-white/70">{album.artist}</div>
      </div>
    </div>
  );
}

function AddCase({ selected }: { selected: boolean }) {
  return (
    <div className={cn("case", selected && "case-selected")}>
      <div className="absolute inset-x-0 top-0 z-[2] flex h-[9%] items-center bg-gradient-to-b from-white/25 to-white/10 pl-[12%] font-display text-[clamp(0.45rem,0.95vh,0.62rem)] font-bold uppercase tracking-[0.18em] text-white/80">
        New
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[9%] flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_40%,rgb(var(--glow)/0.3),transparent_70%)] pl-[7%]">
        <span className="flex h-[26%] aspect-square items-center justify-center rounded-full border-2 border-dashed border-accent text-accent shadow-[0_0_24px_rgb(var(--glow)/0.5)]">
          <Icon name="plus" size={30} strokeWidth={2.4} />
        </span>
        <span className="px-2 text-center font-display text-[clamp(0.7rem,1.6vh,0.95rem)] font-bold uppercase tracking-widest text-white">Add music</span>
      </div>
    </div>
  );
}

function AlbumDetails({ album }: { album: Album }) {
  const playList = useStore((s) => s.playList);
  const enqueueLast = useStore((s) => s.enqueueLast);
  const openModal = useStore((s) => s.openModal);
  const meta = [album.year ? String(album.year) : null, album.genre || null, pluralize(album.trackIds.length, "track"), fmtLong(album.duration)].filter(Boolean);

  return (
    <div key={album.id} className="grid animate-rise gap-5 lg:grid-cols-[minmax(280px,400px)_1fr]">
      <div className="space-y-4">
        <div>
          <div className="label mb-1">Selected album</div>
          <h2 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl [text-shadow:0_0_24px_rgb(var(--glow)/0.45)]">{album.title}</h2>
          <div className="mt-0.5 text-lg text-accent">{album.artist}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {meta.map((m) => (
            <span key={m} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-mute">
              {m}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => playList(album.trackIds, { shuffle: false })}>
            <span className="face face-a">A</span> Play
          </button>
          <button className="btn" onClick={() => playList(album.trackIds, { shuffle: true })}>
            <span className="face face-x">X</span> Shuffle
          </button>
          <button className="btn" onClick={() => enqueueLast(album.trackIds)}>
            <span className="face face-y">Y</span> Queue
          </button>
          <MenuButton
            label="Album actions"
            getItems={() => [
              { label: "Edit album tags…", icon: "tag", onClick: () => openModal({ type: "tags", ids: album.trackIds }) },
              { label: "Add to playlist…", icon: "plus", onClick: () => openModal({ type: "playlistPicker", ids: album.trackIds }) },
              "sep",
              {
                label: "Remove album from library",
                icon: "trash",
                danger: true,
                onClick: () =>
                  openModal({
                    type: "confirm",
                    title: "Remove album",
                    message: `Remove “${album.title}” (${pluralize(album.trackIds.length, "track")}) from your library? Files on your device are not touched.`,
                    confirmLabel: "Remove",
                    danger: true,
                    onConfirm: () => void useStore.getState().deleteTracks(album.trackIds),
                  }),
              },
            ]}
          />
        </div>
      </div>
      <div className="panel p-2">
        <TrackList ids={album.trackIds} numbering="trackNo" showCover={false} showAlbum={false} />
      </div>
    </div>
  );
}

function AddDetails() {
  const pickAndAdd = useStore((s) => s.pickAndAdd);
  const loadDemo = useStore((s) => s.loadDemo);
  const hasAny = useStore((s) => s.albums.length > 0);
  return (
    <div className="panel animate-rise mx-auto max-w-2xl p-6 text-center">
      <div className="label mb-1">{hasAny ? "End of the shelf" : "Your shelf is empty"}</div>
      <h2 className="font-display text-2xl font-bold text-ink">Add music to your library</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-mute">
        Pick audio files from your device (MP3, M4A, FLAC, OGG, WAV…). Everything stays on this device – nothing is uploaded.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button className="btn btn-primary" onClick={() => void pickAndAdd(false)}>
          <span className="face face-a">A</span> Select files
        </button>
        <button className="btn" onClick={() => void pickAndAdd(true)}>
          <Icon name="folder" size={16} /> Select folder
        </button>
        <button className="btn" onClick={() => void loadDemo()}>
          <Icon name="zap" size={16} /> Load demo tracks
        </button>
      </div>
    </div>
  );
}

export function AlbumsView() {
  const albums = useStore((s) => s.albums);
  const sort = useStore((s) => s.albumSort);
  const setSort = useStore((s) => s.setAlbumSort);
  const setSelected = useStore((s) => s.setSelectedAlbum);
  const selectedId = useStore((s) => s.selectedAlbumId);
  const currentId = useStore((s) => s.currentId);
  const playing = useStore((s) => s.playing);

  const sorted = useMemo(() => sortAlbums(albums, sort), [albums, sort]);
  const items: Item[] = useMemo(() => [...sorted.map((album) => ({ kind: "album" as const, album })), { kind: "add" as const }], [sorted]);

  const scroller = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const metrics = useRef({ centers: [] as number[], step: 200 });
  const raf = useRef(0);
  const target = useRef(0);
  const lastNav = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [index, setIndex] = useState(() => {
    const i = items.findIndex((it) => it.kind === "album" && it.album.id === selectedId);
    return Math.max(0, i);
  });
  const indexRef = useRef(index);
  indexRef.current = index;

  const apply = useCallback(() => {
    const el = scroller.current;
    const { centers, step } = metrics.current;
    if (!el || !centers.length) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const t = tiles.current[i];
      if (!t) continue;
      const d = (centers[i] - mid) / step;
      const ad = Math.abs(d);
      if (ad < bestD) {
        bestD = ad;
        best = i;
      }
      const c = Math.max(-1.5, Math.min(1.5, d));
      const scale = 1.1 - Math.min(ad, 1.5) * 0.24;
      t.style.transform = `perspective(1000px) translateZ(${(-Math.min(ad, 2) * 50).toFixed(0)}px) rotateY(${(-c * 32).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      t.style.opacity = Math.max(0.25, 1 - Math.min(ad, 3) * 0.16).toFixed(2);
      t.style.zIndex = String(50 - Math.round(ad * 10));
    }
    setIndex((p) => (p === best ? p : best));
  }, []);

  const measure = useCallback(() => {
    const arr: number[] = [];
    tiles.current.forEach((t, i) => {
      if (t) arr[i] = t.offsetLeft + t.offsetWidth / 2;
    });
    const step = arr.length > 1 ? arr[1] - arr[0] : (tiles.current[0]?.offsetWidth ?? 160) + 24;
    metrics.current = { centers: arr, step: Math.max(40, step) };
    apply();
  }, [apply]);

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = scroller.current;
    const c = metrics.current.centers[i];
    if (!el || c === undefined) return;
    el.scrollTo({ left: c - el.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const n = itemsRef.current.length;
      const clamped = Math.max(0, Math.min(n - 1, i));
      target.current = clamped;
      lastNav.current = performance.now();
      scrollToIndex(clamped, true);
    },
    [scrollToIndex]
  );

  const nav = useCallback(
    (dir: number) => {
      const base = performance.now() - lastNav.current < 450 ? target.current : indexRef.current;
      goTo(base + dir);
    },
    [goTo]
  );

  // (Re)measure whenever the list of tiles changes and keep the selected album centred
  useLayoutEffect(() => {
    tiles.current.length = items.length;
    measure();
    const sel = useStore.getState().selectedAlbumId;
    const i = items.findIndex((it) => it.kind === "album" && it.album.id === sel);
    scrollToIndex(i >= 0 ? i : Math.min(indexRef.current, items.length - 1), false);
    apply();
  }, [items, measure, scrollToIndex, apply]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const i = indexRef.current;
      measure();
      scrollToIndex(i, false);
    });
    ro.observe(el);
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(apply);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf.current);
    };
  }, [apply, measure, scrollToIndex]);

  // selection index -> store (+ tick sound)
  const prevIndex = useRef(index);
  useEffect(() => {
    const it = items[index];
    if (it?.kind === "album" && it.album.id !== useStore.getState().selectedAlbumId) setSelected(it.album.id);
    if (prevIndex.current !== index) {
      prevIndex.current = index;
      sfx.play("tick");
    }
  }, [index, items, setSelected]);

  // external selection changes (e.g. "show album" from elsewhere) -> scroll
  useEffect(() => {
    if (!selectedId) return;
    const i = itemsRef.current.findIndex((it) => it.kind === "album" && it.album.id === selectedId);
    if (i >= 0 && i !== indexRef.current) goTo(i);
  }, [selectedId, goTo]);

  // mouse wheel steps through albums like a game menu
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let acc = 0;
    let lastMove = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // native horizontal swipe
      e.preventDefault();
      acc += e.deltaY;
      const now = performance.now();
      if (Math.abs(acc) > 40 && now - lastMove > 120) {
        nav(acc > 0 ? 1 : -1);
        acc = 0;
        lastMove = now;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [nav]);

  // keyboard / gamepad navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
      if (useStore.getState().modal) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nav(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nav(-1);
      } else if (e.key === "Home") goTo(0);
      else if (e.key === "End") goTo(itemsRef.current.length - 1);
      else if (e.key === "Enter" && (tgt === document.body || tgt === (window as unknown as HTMLElement))) {
        const it = itemsRef.current[indexRef.current];
        if (it?.kind === "album") useStore.getState().playList(it.album.trackIds, { shuffle: false });
        else void useStore.getState().pickAndAdd(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, goTo]);

  const onTile = (i: number) => {
    if (i !== indexRef.current) {
      goTo(i);
      return;
    }
    const it = items[i];
    if (it.kind === "album") useStore.getState().playList(it.album.trackIds, { shuffle: false });
    else void useStore.getState().pickAndAdd(false);
  };

  const current = items[index];
  const currentAlbumId = useMemo(
    () => (currentId ? sorted.find((a) => a.trackIds.includes(currentId))?.id ?? null : null),
    [currentId, sorted]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pt-4 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-ink sm:text-3xl [text-shadow:0_0_26px_rgb(var(--glow)/0.55)]">
            Albums
          </h1>
          <div className="label mt-0.5">
            {pluralize(albums.length, "album")} · scroll to select
          </div>
        </div>
        <label className="flex items-center gap-2">
          <span className="label hidden sm:inline">Sort</span>
          <select className="field !w-auto py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as AlbumSort)} aria-label="Sort albums">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative shrink-0">
        <div
          ref={scroller}
          className="no-scrollbar relative flex snap-x snap-mandatory items-center overflow-x-auto overflow-y-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]"
          style={
            {
              "--tile-w": "clamp(118px, 19vh, 215px)",
              height: "clamp(230px, 40vh, 400px)",
              gap: "clamp(18px, 3.2vh, 36px)",
              paddingInline: "calc(50% - clamp(118px, 19vh, 215px) / 2)",
            } as CSSProperties
          }
          aria-label="Album selection"
        >
          {items.map((it, i) => {
            const isAlbum = it.kind === "album";
            const name = isAlbum ? `${it.album.title} by ${it.album.artist}` : "Add music";
            return (
              <button
                key={isAlbum ? it.album.id : "add"}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                onClick={() => onTile(i)}
                aria-label={name}
                aria-current={i === index}
                data-sfx={i === index ? "select" : "none"}
                data-sfx-hover="none"
                className="shrink-0 snap-center rounded-md outline-offset-8 will-change-transform"
              >
                {isAlbum ? (
                  <AlbumCase album={it.album} selected={i === index} playing={playing && currentAlbumId === it.album.id} />
                ) : (
                  <AddCase selected={i === index} />
                )}
              </button>
            );
          })}
        </div>
        {/* selection arrows */}
        <button
          className="iconbtn absolute left-2 top-1/2 hidden -translate-y-1/2 border border-white/10 bg-black/40 sm:inline-flex"
          onClick={() => nav(-1)}
          aria-label="Previous album"
          data-sfx="none"
        >
          <Icon name="left" />
        </button>
        <button
          className="iconbtn absolute right-2 top-1/2 hidden -translate-y-1/2 border border-white/10 bg-black/40 sm:inline-flex"
          onClick={() => nav(1)}
          aria-label="Next album"
          data-sfx="none"
        >
          <Icon name="right" />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-8">
        {current?.kind === "album" ? <AlbumDetails album={current.album} /> : <AddDetails />}
      </div>
    </div>
  );
}
