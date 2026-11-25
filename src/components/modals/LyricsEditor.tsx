import { useMemo, useRef, useState } from "react";
import { useStore } from "../../store";
import { parseLyrics, toLrcStamp } from "../../lib/lrc";
import { fetchLyricsOnline } from "../../lib/lyricsApi";
import { engine } from "../../lib/engine";
import { fmtTime } from "../../lib/format";
import { useCurrentTime } from "../../hooks";
import { Modal } from "../Modal";
import { Icon } from "../Icons";

const STAMP_RE = /^(\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\])+\s*/;

export function LyricsEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const track = useStore((s) => s.tracks[id]);
  const currentId = useStore((s) => s.currentId);
  const playing = useStore((s) => s.playing);
  const updateTracks = useStore((s) => s.updateTracks);
  const playList = useStore((s) => s.playList);
  const togglePlay = useStore((s) => s.togglePlay);
  const seekBy = useStore((s) => s.seekBy);
  const toast = useStore((s) => s.toast);
  const time = useCurrentTime(10);

  const [text, setText] = useState(track?.lyrics ?? "");
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseLyrics(text), [text]);

  if (!track) return null;
  const isCurrent = currentId === id;

  const stamp = () => {
    const el = ta.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    let lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd < 0) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd).replace(STAMP_RE, "");
    const nl = `${toLrcStamp(engine.audio.currentTime)}${line}`;
    const next = text.slice(0, lineStart) + nl + text.slice(lineEnd);
    setText(next);
    const caret = Math.min(next.length, lineStart + nl.length + 1);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const strip = () => {
    setText(
      text
        .split("\n")
        .filter((l) => !/^\[[a-z]{2,8}:.*\]$/i.test(l.trim()))
        .map((l) => l.replace(STAMP_RE, ""))
        .join("\n")
        .trim()
    );
  };

  const online = async () => {
    setBusy(true);
    try {
      const res = await fetchLyricsOnline(track);
      if (res) {
        setText(res.text);
        toast(res.synced ? "Found synced lyrics" : "Found plain-text lyrics", "success");
      } else toast("No lyrics found online for this song", "error");
    } catch {
      toast("Could not reach the lyrics service (are you offline?)", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    setText((await file.text()).replace(/^\uFEFF/, ""));
  };

  const save = () => {
    updateTracks({ [id]: { lyrics: text.trim() } });
    toast(text.trim() ? "Lyrics saved" : "Lyrics removed", "success");
    onClose();
  };

  return (
    <Modal
      title={`Lyrics · ${track.title}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} data-sfx="back">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Icon name="check" size={14} strokeWidth={3} /> Save lyrics
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn !px-3 !py-2" onClick={() => void online()} disabled={busy}>
          <Icon name="globe" size={14} /> {busy ? "Searching…" : "Find online"}
        </button>
        <button className="btn !px-3 !py-2" onClick={() => fileRef.current?.click()}>
          <Icon name="file" size={14} /> Import .lrc / .txt
        </button>
        <button className="btn !px-3 !py-2" onClick={strip} disabled={!parsed.synced}>
          Remove timestamps
        </button>
        <input ref={fileRef} type="file" accept=".lrc,.txt,text/plain" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
        <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-mute">
          {parsed.lines.length === 0 ? "Empty" : `${parsed.synced ? "Synced" : "Plain text"} · ${parsed.lines.length} lines`}
        </span>
      </div>

      <textarea
        ref={ta}
        className="field scroll-thin h-[38vh] min-h-[200px] resize-y font-mono text-[0.85rem] leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Paste lyrics here…\n\nFor synced lyrics use LRC format:\n[00:12.40] First line\n[00:16.80] Second line"}
        spellCheck={false}
      />

      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="clock" size={14} className="text-accent" />
          <span className="label">Timestamp tool</span>
        </div>
        {isCurrent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button className="iconbtn border border-white/10" onClick={() => togglePlay()} aria-label="Play or pause" data-sfx="none">
              <Icon name={playing ? "pause" : "play"} size={16} fill />
            </button>
            <button className="btn !px-2.5 !py-2" onClick={() => seekBy(-5)}>
              −5s
            </button>
            <button className="btn !px-2.5 !py-2" onClick={() => seekBy(5)}>
              +5s
            </button>
            <span className="min-w-[3.5rem] text-center font-mono text-sm tabular-nums text-accent">{fmtTime(time)}</span>
            <button className="btn btn-primary" onClick={stamp}>
              <Icon name="clock" size={14} /> Stamp current line
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm text-mute">
            Play this song to sync lyrics line by line.
            <button className="btn !px-3 !py-2" onClick={() => playList([id], { shuffle: false })}>
              <Icon name="play" size={13} fill /> Play this song
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-mute">
          Put the cursor on a line while the song plays and press <b className="text-ink">Stamp current line</b> – it adds the time and jumps to the next line.
        </p>
      </div>
    </Modal>
  );
}
