import { useStore } from "../store";
import { fmtTime } from "../lib/format";
import { cn } from "../utils/cn";
import { CoverArt } from "./Cover";
import { Icon } from "./Icons";

export function QueueDrawer() {
  const open = useStore((s) => s.showQueue);
  const toggleQueue = useStore((s) => s.toggleQueue);
  const queue = useStore((s) => s.queue);
  const qi = useStore((s) => s.qi);
  const tracks = useStore((s) => s.tracks);
  const playing = useStore((s) => s.playing);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const cycleRepeat = useStore((s) => s.cycleRepeat);
  const playIndex = useStore((s) => s.playIndex);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const moveInQueue = useStore((s) => s.moveInQueue);
  const clearQueue = useStore((s) => s.clearQueue);
  const openModal = useStore((s) => s.openModal);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => toggleQueue(false)} />
      <aside
        className="panel absolute inset-y-0 right-0 flex w-[min(430px,94vw)] animate-slide-in flex-col rounded-none rounded-l-xl"
        style={{ background: "linear-gradient(180deg, rgb(255 255 255 / .07), rgb(255 255 255 / .02)), rgb(var(--panel-rgb) / .97)" }}
      >
        <div className="h-[3px] bg-gradient-to-r from-accent2 via-accent to-accent2 shadow-[0_0_16px_var(--accent)]" />
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-[0.14em] text-ink">Up next</h2>
            <div className="label">{queue.length} in queue</div>
          </div>
          <button className="iconbtn" onClick={() => toggleQueue(false)} aria-label="Close queue" data-sfx="back">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-4 pb-3">
          <button className="chip" data-on={shuffle} onClick={toggleShuffle}>
            <Icon name="shuffle" size={13} /> Shuffle
          </button>
          <button className="chip" data-on={repeat !== "off"} onClick={cycleRepeat}>
            <Icon name={repeat === "one" ? "repeat1" : "repeat"} size={13} /> Repeat {repeat === "off" ? "off" : repeat === "all" ? "all" : "one"}
          </button>
          <button
            className="chip"
            disabled={queue.length === 0}
            onClick={() => openModal({ type: "newPlaylist", ids: queue })}
          >
            <Icon name="plus" size={13} /> Save as playlist
          </button>
          <button className="chip" disabled={queue.length < 2} onClick={clearQueue}>
            <Icon name="trash" size={13} /> Clear
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {queue.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-mute">
              The queue is empty. Play an album or use “Add to queue” from any song menu.
            </div>
          ) : (
            queue.map((id, i) => {
              const t = tracks[id];
              if (!t) return null;
              const current = i === qi;
              return (
                <div
                  key={`${id}-${i}`}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:bg-white/[0.06]",
                    current && "border-accent/30 bg-accent/10"
                  )}
                >
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => playIndex(i)}>
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
                      <CoverArt coverId={t.coverId} seed={t.album + t.artist} iconSize={16} />
                      {current && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                          <span className="eqbars" data-paused={!playing}>
                            <i />
                            <i />
                            <i />
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={cn("truncate text-sm font-semibold", current ? "text-accent" : "text-ink")}>{t.title}</div>
                      <div className="truncate text-xs text-mute">
                        {t.artist} · {fmtTime(t.duration)}
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100">
                    <button className="iconbtn !h-8 !w-8" aria-label="Move up" disabled={i === 0} onClick={() => moveInQueue(i, -1)}>
                      <Icon name="up" size={16} />
                    </button>
                    <button className="iconbtn !h-8 !w-8" aria-label="Move down" disabled={i === queue.length - 1} onClick={() => moveInQueue(i, 1)}>
                      <Icon name="down" size={16} />
                    </button>
                    <button className="iconbtn !h-8 !w-8" aria-label="Remove from queue" disabled={current} onClick={() => removeFromQueue(i)}>
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
