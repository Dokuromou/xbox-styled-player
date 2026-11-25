import { memo, useMemo } from "react";
import { useStore } from "../store";
import type { Track } from "../lib/types";
import { fmtTime } from "../lib/format";
import { cn } from "../utils/cn";
import { CoverArt } from "./Cover";
import { Icon } from "./Icons";
import { MenuButton, type MenuItem } from "./MenuButton";

interface RowProps {
  track: Track;
  index: number;
  active: boolean;
  playing: boolean;
  numbering: "index" | "trackNo";
  showCover: boolean;
  showAlbum: boolean;
  onPlay: () => void;
  extraItems?: MenuItem[];
}

const TrackRow = memo(function TrackRow({ track: t, index, active, playing, numbering, showCover, showAlbum, onPlay, extraItems }: RowProps) {
  const getItems = (): MenuItem[] => {
    const s = useStore.getState();
    return [
      { label: "Play next", icon: "next", onClick: () => s.enqueueNext([t.id]) },
      { label: "Add to queue", icon: "queue", onClick: () => s.enqueueLast([t.id]) },
      { label: "Add to playlist…", icon: "plus", onClick: () => s.openModal({ type: "playlistPicker", ids: [t.id] }) },
      { label: t.favorite ? "Remove from favorites" : "Add to favorites", icon: "heart", onClick: () => s.toggleFavorite(t.id) },
      "sep",
      { label: "Edit tags…", icon: "tag", onClick: () => s.openModal({ type: "tags", ids: [t.id] }) },
      { label: "Lyrics…", icon: "mic", onClick: () => s.openModal({ type: "lyrics", id: t.id }) },
      ...(extraItems?.length ? (["sep", ...extraItems] as MenuItem[]) : []),
      "sep",
      {
        label: "Remove from library",
        icon: "trash",
        danger: true,
        onClick: () =>
          s.openModal({
            type: "confirm",
            title: "Remove track",
            message: `Remove “${t.title}” from your library? The original file on your device is not touched.`,
            confirmLabel: "Remove",
            danger: true,
            onConfirm: () => void s.deleteTracks([t.id]),
          }),
      },
    ];
  };

  const num = numbering === "trackNo" ? (t.trackNo || index + 1) : index + 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === "Enter") onPlay();
      }}
      className={cn(
        "cv-auto group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-1.5 transition-colors sm:gap-4 sm:px-3",
        "hover:border-white/10 hover:bg-white/[0.06]",
        active && "border-accent/30 bg-accent/10"
      )}
    >
      <div className="flex w-7 shrink-0 items-center justify-center text-sm tabular-nums text-mute">
        {active ? (
          <span className="eqbars" data-paused={!playing}>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <>
            <span className="group-hover:hidden">{num}</span>
            <Icon name="play" size={14} fill className="hidden text-accent group-hover:block" />
          </>
        )}
      </div>
      {showCover && (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md shadow-md ring-1 ring-white/10">
          <CoverArt coverId={t.coverId} seed={t.album + t.artist} iconSize={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[0.95rem] font-semibold", active ? "text-accent" : "text-ink")}>{t.title}</div>
        <div className="truncate text-xs text-mute">{t.artist}</div>
      </div>
      {showAlbum && <div className="hidden min-w-0 flex-1 truncate text-sm text-mute md:block">{t.album}</div>}
      <div className="hidden w-12 shrink-0 text-right text-sm tabular-nums text-mute sm:block">{fmtTime(t.duration)}</div>
      <button
        className="iconbtn shrink-0"
        data-on={t.favorite}
        data-sfx="none"
        aria-label={t.favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          useStore.getState().toggleFavorite(t.id);
        }}
      >
        <Icon name="heart" size={17} fill={t.favorite} />
      </button>
      <MenuButton getItems={getItems} />
    </div>
  );
});

interface ListProps {
  ids: string[];
  numbering?: "index" | "trackNo";
  showCover?: boolean;
  showAlbum?: boolean;
  /** called when a row is clicked, defaults to playing the list from that track */
  onPlayId?: (id: string, index: number) => void;
  rowExtra?: (id: string, index: number) => MenuItem[];
  empty?: React.ReactNode;
  className?: string;
}

export function TrackList({ ids, numbering = "index", showCover = true, showAlbum = true, onPlayId, rowExtra, empty, className }: ListProps) {
  const tracks = useStore((s) => s.tracks);
  const currentId = useStore((s) => s.currentId);
  const playing = useStore((s) => s.playing);
  const playList = useStore((s) => s.playList);

  const rows = useMemo(() => ids.map((id) => tracks[id]).filter(Boolean), [ids, tracks]);

  if (!rows.length) return <>{empty ?? null}</>;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {rows.map((t, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          track={t}
          index={i}
          active={t.id === currentId}
          playing={playing}
          numbering={numbering}
          showCover={showCover}
          showAlbum={showAlbum}
          onPlay={() => (onPlayId ? onPlayId(t.id, i) : playList(ids, { startId: t.id }))}
          extraItems={rowExtra?.(t.id, i)}
        />
      ))}
    </div>
  );
}
