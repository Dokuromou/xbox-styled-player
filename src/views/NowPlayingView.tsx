import { useStore } from "../store";
import { useCurrentTrack, useMediaQuery } from "../hooks";
import { albumKey } from "../lib/albums";
import { cn } from "../utils/cn";
import { Visualizer, VIZ_MODES } from "../components/Visualizer";
import { LyricsPanel } from "../components/LyricsPanel";
import { Icon } from "../components/Icons";

export function NowPlayingView() {
  const track = useCurrentTrack();
  const playing = useStore((s) => s.playing);
  const vizMode = useStore((s) => s.vizMode);
  const setVizMode = useStore((s) => s.setVizMode);
  const nowTab = useStore((s) => s.nowTab);
  const setNowTab = useStore((s) => s.setNowTab);
  const setView = useStore((s) => s.setView);
  const setSelectedAlbum = useStore((s) => s.setSelectedAlbum);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const openModal = useStore((s) => s.openModal);
  const wide = useMediaQuery("(min-width: 1024px)");

  const showViz = wide || nowTab === "viz";
  const showLyrics = wide || nowTab === "lyrics";
  const cycle = () => setVizMode((vizMode + 1) % VIZ_MODES.length);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4 py-3 sm:px-8 lg:flex-row lg:gap-8">
      {!wide && (
        <div className="flex shrink-0 justify-center gap-2">
          <button className="chip" data-on={nowTab === "viz"} onClick={() => setNowTab("viz")}>
            <Icon name="activity" size={13} /> Visualizer
          </button>
          <button className="chip" data-on={nowTab === "lyrics"} onClick={() => setNowTab("lyrics")}>
            <Icon name="mic" size={13} /> Lyrics
          </button>
        </div>
      )}

      {showViz && (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-4">
          <Visualizer coverId={track?.coverId ?? null} seed={track ? track.album + track.artist : "idle"} mode={vizMode} playing={playing} onCycle={cycle} />
          <div className="w-full max-w-xl text-center">
            <h2 className="truncate font-display text-xl font-bold leading-tight text-ink sm:text-2xl [text-shadow:0_0_24px_rgb(var(--glow)/0.5)]">
              {track?.title ?? "Nothing playing"}
            </h2>
            <div className="mt-0.5 truncate text-sm text-accent sm:text-base">
              {track ? `${track.artist}${track.album ? ` · ${track.album}` : ""}${track.year ? ` · ${track.year}` : ""}` : "Choose an album to start the show"}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {track && (
                <>
                  <button className="iconbtn" data-on={track.favorite} data-sfx="none" aria-label="Toggle favorite" onClick={() => toggleFavorite(track.id)}>
                    <Icon name="heart" size={18} fill={track.favorite} />
                  </button>
                  <button className="iconbtn" aria-label="Add to playlist" onClick={() => openModal({ type: "playlistPicker", ids: [track.id] })}>
                    <Icon name="plus" size={18} />
                  </button>
                  <button className="iconbtn" aria-label="Edit tags" onClick={() => openModal({ type: "tags", ids: [track.id] })}>
                    <Icon name="tag" size={18} />
                  </button>
                  <button
                    className="iconbtn"
                    aria-label="Show album"
                    onClick={() => {
                      setSelectedAlbum(albumKey(track));
                      setView("albums");
                    }}
                  >
                    <Icon name="disc" size={18} />
                  </button>
                  <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
                </>
              )}
              {VIZ_MODES.map((m, i) => (
                <button key={m} className={cn("chip !px-2.5 !py-1 !text-[0.7rem]")} data-on={vizMode === i} onClick={() => setVizMode(i)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {showLyrics && (
        <section className="flex min-h-0 flex-1 flex-col lg:w-[44%] lg:flex-none">
          <LyricsPanel track={track} className="flex-1" />
        </section>
      )}
    </div>
  );
}
