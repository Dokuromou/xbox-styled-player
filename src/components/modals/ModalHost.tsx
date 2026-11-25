import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { cn } from "../../utils/cn";
import { Modal } from "../Modal";
import { Icon } from "../Icons";
import { Slider } from "../Slider";
import { TagEditor } from "./TagEditor";
import { LyricsEditor } from "./LyricsEditor";

function NameDialog({
  title,
  initial,
  confirmLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    onClose();
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} data-sfx="back">
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={submit}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <input
        ref={ref}
        className="field"
        placeholder="Playlist name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
    </Modal>
  );
}

function PlaylistPicker({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const playlists = useStore((s) => s.playlists);
  const addToPlaylist = useStore((s) => s.addToPlaylist);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState("");

  const create = () => {
    if (!name.trim()) return;
    createPlaylist(name, ids);
    toast(`Created “${name.trim()}” with ${ids.length} song${ids.length === 1 ? "" : "s"}`, "success");
    onClose();
  };

  return (
    <Modal title="Add to playlist" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <input
          className="field"
          placeholder="New playlist name…"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
          autoFocus
        />
        <button className="btn btn-primary" disabled={!name.trim()} onClick={create}>
          <Icon name="plus" size={14} /> Create
        </button>
      </div>
      {playlists.length === 0 ? (
        <p className="py-4 text-center text-sm text-mute">You have no playlists yet – create the first one above.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {playlists.map((p) => (
            <button
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
              onClick={() => {
                addToPlaylist(p.id, ids);
                onClose();
              }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-accent">
                <Icon name="music" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                <span className="block text-xs text-mute">{p.trackIds.length} songs</span>
              </span>
              <Icon name="plus" size={16} className="text-mute" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

const PRESET_MIN = [5, 15, 30, 45, 60, 90];

function SleepDialog({ onClose }: { onClose: () => void }) {
  const sleep = useStore((s) => s.sleep);
  const sleepLeft = useStore((s) => s.sleepLeft);
  const setSleep = useStore((s) => s.setSleep);
  const [custom, setCustom] = useState(20);
  const mm = Math.floor(sleepLeft / 60);
  const ss = String(sleepLeft % 60).padStart(2, "0");

  return (
    <Modal title="Sleep timer" onClose={onClose}>
      {sleep && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div>
            <div className="label">Active</div>
            <div className="font-display text-2xl font-bold text-accent">{sleep.mode === "track" ? "End of this track" : `${mm}:${ss}`}</div>
          </div>
          <div className="flex gap-2">
            {sleep.mode === "time" && (
              <button className="btn" onClick={() => setSleep(Math.ceil(sleepLeft / 60) + 15)}>
                +15 min
              </button>
            )}
            <button className="btn btn-danger" onClick={() => setSleep(null)}>
              Cancel timer
            </button>
          </div>
        </div>
      )}
      <div className="label mb-2">Stop playback in…</div>
      <div className="grid grid-cols-3 gap-2">
        {PRESET_MIN.map((m) => (
          <button
            key={m}
            className={cn("btn !py-3")}
            onClick={() => {
              setSleep(m);
              onClose();
            }}
          >
            {m} min
          </button>
        ))}
      </div>
      <button
        className="btn mt-2 w-full !py-3"
        onClick={() => {
          setSleep("track");
          onClose();
        }}
      >
        <Icon name="music" size={14} /> After the current track
      </button>

      <div className="label mb-1 mt-5 flex items-center justify-between">
        <span>Custom</span>
        <span className="text-sm normal-case tracking-normal text-accent">{custom} min</span>
      </div>
      <Slider min={1} max={180} step={1} value={custom} onChange={setCustom} label="Custom minutes" />
      <button
        className="btn btn-primary mt-3 w-full"
        onClick={() => {
          setSleep(custom);
          onClose();
        }}
      >
        <Icon name="moon" size={14} /> Start {custom}-minute timer
      </button>
      <p className="mt-3 text-xs text-mute">The volume fades out smoothly during the last 20 seconds.</p>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Space / K", "Play / pause"],
  ["N  ·  P", "Next / previous track"],
  ["← →", "Seek 5 s (Albums: select album)"],
  ["Shift + ← →", "Seek 10 s"],
  ["Shift + ↑ ↓  ·  + / −", "Volume"],
  ["M", "Mute"],
  ["F", "Favorite current song"],
  ["S  ·  R", "Shuffle · repeat"],
  ["Q", "Open queue"],
  ["L", "Lyrics"],
  ["E", "Equalizer"],
  ["T", "Cycle theme"],
  ["1 – 7", "Switch tab"],
  ["/", "Search songs"],
  ["Enter", "Play selected album"],
  ["?", "This help"],
];

function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard & controller" onClose={onClose}>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm">
            <kbd className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-xs text-accent">{k}</kbd>
            <span className="text-right text-mute">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-mute">
        <b className="text-ink">Game controller:</b> D-pad ◀ ▶ select album · <span className="face face-a !h-5 !w-5 !text-[0.6rem]">A</span> play ·{" "}
        <span className="face face-b !h-5 !w-5 !text-[0.6rem]">B</span> back · <span className="face face-x !h-5 !w-5 !text-[0.6rem]">X</span> shuffle ·{" "}
        <span className="face face-y !h-5 !w-5 !text-[0.6rem]">Y</span> queue · LB / RB switch tab · LT / RT previous / next track · Start play / pause.
      </div>
    </Modal>
  );
}

export function ModalHost() {
  const modal = useStore((s) => s.modal);
  const close = useStore((s) => s.closeModal);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const renamePlaylist = useStore((s) => s.renamePlaylist);
  const playlists = useStore((s) => s.playlists);
  const toast = useStore((s) => s.toast);

  if (!modal) return null;
  switch (modal.type) {
    case "tags":
      return <TagEditor ids={modal.ids} onClose={close} />;
    case "playlistPicker":
      return <PlaylistPicker ids={modal.ids} onClose={close} />;
    case "newPlaylist":
      return (
        <NameDialog
          title="New playlist"
          confirmLabel="Create"
          onClose={close}
          onSubmit={(name) => {
            createPlaylist(name, modal.ids);
            toast(`Playlist “${name}” created`, "success");
          }}
        />
      );
    case "renamePlaylist":
      return (
        <NameDialog
          title="Rename playlist"
          confirmLabel="Rename"
          initial={playlists.find((p) => p.id === modal.id)?.name}
          onClose={close}
          onSubmit={(name) => renamePlaylist(modal.id, name)}
        />
      );
    case "sleep":
      return <SleepDialog onClose={close} />;
    case "lyrics":
      return <LyricsEditor id={modal.id} onClose={close} />;
    case "shortcuts":
      return <Shortcuts onClose={close} />;
    case "confirm":
      return (
        <Modal
          title={modal.title}
          onClose={close}
          footer={
            <>
              <button className="btn" onClick={close} data-sfx="back">
                Cancel
              </button>
              <button
                className={cn("btn", modal.danger ? "btn-danger !border-red-400/60 !text-red-200" : "btn-primary")}
                onClick={() => {
                  close();
                  modal.onConfirm();
                }}
              >
                {modal.confirmLabel}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-mute">{modal.message}</p>
        </Modal>
      );
  }
}
