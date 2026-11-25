import { useMemo } from "react";
import { useStore } from "../store";
import { fmtLong, pluralize } from "../lib/format";
import { Icon } from "../components/Icons";
import { TrackList } from "../components/TrackList";
import { EmptyState, ViewHeader } from "../components/ViewHeader";

export function FavoritesView() {
  const tracks = useStore((s) => s.tracks);
  const playList = useStore((s) => s.playList);
  const openModal = useStore((s) => s.openModal);
  const setView = useStore((s) => s.setView);

  const ids = useMemo(
    () =>
      Object.values(tracks)
        .filter((t) => t.favorite)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
        .map((t) => t.id),
    [tracks]
  );
  const total = useMemo(() => ids.reduce((n, id) => n + (tracks[id]?.duration ?? 0), 0), [ids, tracks]);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-8">
      <ViewHeader title="Favorites" subtitle={`${pluralize(ids.length, "song")} · ${fmtLong(total)}`}>
        <button className="btn btn-primary" disabled={!ids.length} onClick={() => playList(ids, { shuffle: false })}>
          <Icon name="play" size={14} fill /> Play
        </button>
        <button className="btn" disabled={!ids.length} onClick={() => playList(ids, { shuffle: true })}>
          <Icon name="shuffle" size={14} /> Shuffle
        </button>
        <button className="btn" disabled={!ids.length} onClick={() => openModal({ type: "newPlaylist", ids })}>
          <Icon name="plus" size={14} /> Save as playlist
        </button>
      </ViewHeader>
      {ids.length === 0 ? (
        <EmptyState icon="heart" title="No favorites yet" text="Tap the heart next to any song (or press F while it plays) to keep it here.">
          <button className="btn" onClick={() => setView("songs")}>
            Browse songs
          </button>
        </EmptyState>
      ) : (
        <div className="panel p-2">
          <TrackList ids={ids} />
        </div>
      )}
    </div>
  );
}
