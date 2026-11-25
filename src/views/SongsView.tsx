import { useMemo, useRef, useState, useEffect } from "react";
import { useStore } from "../store";
import type { Track } from "../lib/types";
import { fmtLong, pluralize } from "../lib/format";
import { Icon } from "../components/Icons";
import { TrackList } from "../components/TrackList";
import { EmptyState, ViewHeader } from "../components/ViewHeader";

type SortKey = "title" | "artist" | "album" | "added" | "played" | "plays" | "duration" | "year";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "added", label: "Recently added" },
  { id: "played", label: "Recently played" },
  { id: "plays", label: "Most played" },
  { id: "duration", label: "Duration" },
  { id: "year", label: "Year" },
];

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function sortTracks(list: Track[], by: SortKey): Track[] {
  const l = list.slice();
  switch (by) {
    case "artist":
      return l.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.album, b.album) || (a.trackNo || 99) - (b.trackNo || 99));
    case "album":
      return l.sort((a, b) => cmp(a.album, b.album) || (a.discNo || 1) - (b.discNo || 1) || (a.trackNo || 99) - (b.trackNo || 99));
    case "added":
      return l.sort((a, b) => b.addedAt - a.addedAt);
    case "played":
      return l.sort((a, b) => b.lastPlayed - a.lastPlayed);
    case "plays":
      return l.sort((a, b) => b.plays - a.plays || cmp(a.title, b.title));
    case "duration":
      return l.sort((a, b) => b.duration - a.duration);
    case "year":
      return l.sort((a, b) => b.year - a.year || cmp(a.title, b.title));
    default:
      return l.sort((a, b) => cmp(a.title, b.title));
  }
}

export function SongsView() {
  const tracks = useStore((s) => s.tracks);
  const playList = useStore((s) => s.playList);
  const pickAndAdd = useStore((s) => s.pickAndAdd);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("title");
  const [favOnly, setFavOnly] = useState(false);
  const [lyricsOnly, setLyricsOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener("bb:focus-search", focus);
    return () => window.removeEventListener("bb:focus-search", focus);
  }, []);

  const all = useMemo(() => Object.values(tracks), [tracks]);
  const ids = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (needle) {
      list = list.filter((t) => `${t.title} ${t.artist} ${t.album} ${t.albumArtist} ${t.genre} ${t.year || ""}`.toLowerCase().includes(needle));
    }
    if (favOnly) list = list.filter((t) => t.favorite);
    if (lyricsOnly) list = list.filter((t) => !!t.lyrics);
    return sortTracks(list, sort).map((t) => t.id);
  }, [all, q, sort, favOnly, lyricsOnly]);

  const total = useMemo(() => ids.reduce((n, id) => n + (tracks[id]?.duration ?? 0), 0), [ids, tracks]);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-8">
      <ViewHeader title="Songs" subtitle={`${pluralize(ids.length, "song")} · ${fmtLong(total)}`}>
        <button className="btn btn-primary" disabled={!ids.length} onClick={() => playList(ids, { shuffle: false })}>
          <Icon name="play" size={14} fill /> Play all
        </button>
        <button className="btn" disabled={!ids.length} onClick={() => playList(ids, { shuffle: true })}>
          <Icon name="shuffle" size={14} /> Shuffle
        </button>
      </ViewHeader>

      {all.length === 0 ? (
        <EmptyState icon="music" title="No songs yet" text="Add audio files from your device to fill your library.">
          <button className="btn btn-primary" onClick={() => void pickAndAdd(false)}>
            <Icon name="plus" size={16} /> Add music
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input
                ref={searchRef}
                className="field !pl-9"
                placeholder="Search title, artist, album, genre…  ( / )"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search songs"
              />
              {q && (
                <button className="iconbtn absolute right-1 top-1/2 !h-7 !w-7 -translate-y-1/2" onClick={() => setQ("")} aria-label="Clear search" data-sfx="back">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort songs">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <button className="chip" data-on={favOnly} onClick={() => setFavOnly((v) => !v)}>
              <Icon name="heart" size={13} fill={favOnly} /> Favorites
            </button>
            <button className="chip" data-on={lyricsOnly} onClick={() => setLyricsOnly((v) => !v)}>
              <Icon name="mic" size={13} /> Has lyrics
            </button>
          </div>
          <div className="panel p-2">
            <TrackList
              ids={ids}
              empty={<div className="px-4 py-10 text-center text-sm text-mute">No songs match your search.</div>}
            />
          </div>
        </>
      )}
    </div>
  );
}
