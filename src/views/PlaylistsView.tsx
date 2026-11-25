import { useMemo, useState } from "react";
import { useStore } from "../store";
import { fmtLong, pluralize } from "../lib/format";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../components/Icons";
import { TrackList } from "../components/TrackList";
import { EmptyState, ViewHeader } from "../components/ViewHeader";

const SMART: { id: string; name: string; icon: IconName; hint: string }[] = [
  { id: "smart:added", name: "Recently added", icon: "plus", hint: "Newest 100 songs" },
  { id: "smart:played", name: "Recently played", icon: "clock", hint: "Your last 100 plays" },
  { id: "smart:top", name: "Most played", icon: "activity", hint: "Your top 100 songs" },
];

export function PlaylistsView() {
  const tracks = useStore((s) => s.tracks);
  const playlists = useStore((s) => s.playlists);
  const playList = useStore((s) => s.playList);
  const enqueueLast = useStore((s) => s.enqueueLast);
  const openModal = useStore((s) => s.openModal);
  const removeFromPlaylist = useStore((s) => s.removeFromPlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const [sel, setSel] = useState("smart:added");

  const user = playlists.find((p) => p.id === sel) ?? null;
  const smart = SMART.find((s) => s.id === sel) ?? null;

  const ids = useMemo(() => {
    const all = Object.values(tracks);
    if (user) return user.trackIds.filter((id) => tracks[id]);
    if (sel === "smart:added") return all.sort((a, b) => b.addedAt - a.addedAt).slice(0, 100).map((t) => t.id);
    if (sel === "smart:played")
      return all
        .filter((t) => t.lastPlayed > 0)
        .sort((a, b) => b.lastPlayed - a.lastPlayed)
        .slice(0, 100)
        .map((t) => t.id);
    if (sel === "smart:top")
      return all
        .filter((t) => t.plays > 0)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 100)
        .map((t) => t.id);
    return [];
  }, [tracks, user, sel]);

  const total = useMemo(() => ids.reduce((n, id) => n + (tracks[id]?.duration ?? 0), 0), [ids, tracks]);
  const title = user?.name ?? smart?.name ?? "Playlist";

  const renderItem = (id: string, name: string, icon: IconName, sub: string) => (
    <button
      key={id}
      onClick={() => setSel(id)}
      className={cn(
        "flex min-w-[170px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors lg:min-w-0",
        sel === id ? "border-accent/50 bg-accent/15 shadow-[0_0_18px_rgb(var(--glow)/0.2)]" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.07]"
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", sel === id ? "bg-accent text-onaccent" : "bg-white/10 text-mute")}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-semibold", sel === id ? "text-accent" : "text-ink")}>{name}</span>
        <span className="block truncate text-xs text-mute">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-8 lg:overflow-hidden">
      <div className="grid gap-4 lg:h-full lg:grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-ink [text-shadow:0_0_26px_rgb(var(--glow)/0.55)]">Playlists</h1>
            <button className="btn !px-3" onClick={() => openModal({ type: "newPlaylist" })} aria-label="New playlist">
              <Icon name="plus" size={14} /> New
            </button>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:scroll-thin lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {SMART.map((s) => renderItem(s.id, s.name, s.icon, s.hint))}
            {playlists.length > 0 && <div className="label hidden px-1 pt-2 lg:block">My playlists</div>}
            {playlists.map((p) => renderItem(p.id, p.name, "music", pluralize(p.trackIds.length, "song")))}
          </div>
        </aside>

        <section className="min-h-0 lg:flex lg:flex-col">
          <ViewHeader title={title} subtitle={`${pluralize(ids.length, "song")} · ${fmtLong(total)}`}>
            <button className="btn btn-primary" disabled={!ids.length} onClick={() => playList(ids, { shuffle: false })}>
              <Icon name="play" size={14} fill /> Play
            </button>
            <button className="btn" disabled={!ids.length} onClick={() => playList(ids, { shuffle: true })}>
              <Icon name="shuffle" size={14} /> Shuffle
            </button>
            <button className="btn" disabled={!ids.length} onClick={() => enqueueLast(ids)}>
              <Icon name="queue" size={14} /> Queue
            </button>
            {user && (
              <>
                <button className="btn" onClick={() => openModal({ type: "renamePlaylist", id: user.id })}>
                  <Icon name="edit" size={14} /> Rename
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() =>
                    openModal({
                      type: "confirm",
                      title: "Delete playlist",
                      message: `Delete “${user.name}”? The songs stay in your library.`,
                      confirmLabel: "Delete",
                      danger: true,
                      onConfirm: () => {
                        deletePlaylist(user.id);
                        setSel("smart:added");
                      },
                    })
                  }
                >
                  <Icon name="trash" size={14} /> Delete
                </button>
              </>
            )}
          </ViewHeader>
          <div className="scroll-thin min-h-0 flex-1 lg:overflow-y-auto lg:pb-4">
            {ids.length === 0 ? (
              <EmptyState
                icon={user ? "music" : "clock"}
                title={user ? "Empty playlist" : "Nothing here yet"}
                text={
                  user
                    ? "Use the ⋮ menu on any song and choose “Add to playlist…”."
                    : "Play some music and this list will fill itself automatically."
                }
              />
            ) : (
              <div className="panel p-2">
                <TrackList
                  ids={ids}
                  rowExtra={
                    user
                      ? (_id, i) => [{ label: "Remove from playlist", icon: "close", onClick: () => removeFromPlaylist(user.id, i) }]
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
