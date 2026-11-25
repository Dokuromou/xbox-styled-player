import { useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "../../store";
import type { Track } from "../../lib/types";
import { albumKey, UNKNOWN_ALBUM } from "../../lib/albums";
import { cn } from "../../utils/cn";
import { Modal } from "../Modal";
import { CoverArt } from "../Cover";
import { Icon } from "../Icons";

const num = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (n: number) => (n > 0 ? String(n) : "");

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function common<T>(items: T[], pick: (t: T) => string): string {
  const first = pick(items[0]);
  return items.every((i) => pick(i) === first) ? first : "";
}

export function TagEditor({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [initial] = useState<Track[]>(() => {
    const all = useStore.getState().tracks;
    return ids.map((id) => all[id]).filter(Boolean) as Track[];
  });
  const covers = useStore((s) => s.covers);
  const albums = useStore((s) => s.albums);
  const updateTracks = useStore((s) => s.updateTracks);
  const setCover = useStore((s) => s.setCover);
  const toast = useStore((s) => s.toast);

  const single = initial.length === 1;
  const t0 = initial[0];

  // single-track form
  const [f, setF] = useState(() => ({
    title: t0?.title ?? "",
    artist: t0?.artist ?? "",
    albumArtist: common(initial, (t) => t.albumArtist),
    album: common(initial, (t) => (t.album === UNKNOWN_ALBUM ? "" : t.album)),
    trackNo: str(t0?.trackNo ?? 0),
    trackOf: str(t0?.trackOf ?? 0),
    discNo: str(t0?.discNo ?? 0),
    year: common(initial, (t) => str(t.year)),
    genre: common(initial, (t) => t.genre),
  }));
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // album mode rows
  const [rows, setRows] = useState(() =>
    initial.map((t) => ({ id: t.id, trackNo: str(t.trackNo), discNo: str(t.discNo), title: t.title, artist: t.artist }))
  );
  const setRow = (i: number, k: "trackNo" | "title" | "artist" | "discNo", v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const [applyAlbum, setApplyAlbum] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);

  const siblings = useMemo(() => {
    if (!single || !t0) return [];
    const al = albums.find((a) => a.id === albumKey(t0));
    return al ? al.trackIds.filter((id) => id !== t0.id) : [];
  }, [single, t0, albums]);

  if (!t0) return null;

  const save = async () => {
    const patches: Record<string, Partial<Track>> = {};
    let coverTargets = ids;
    if (single) {
      const album = f.album.trim() || UNKNOWN_ALBUM;
      patches[t0.id] = {
        title: f.title.trim() || t0.title,
        artist: f.artist.trim() || "Unknown Artist",
        albumArtist: f.albumArtist.trim(),
        album,
        trackNo: num(f.trackNo),
        trackOf: num(f.trackOf),
        discNo: num(f.discNo),
        year: num(f.year),
        genre: f.genre.trim(),
      };
      if (applyAlbum && siblings.length) {
        siblings.forEach((id) => {
          patches[id] = { album, albumArtist: f.albumArtist.trim(), year: num(f.year), genre: f.genre.trim() };
        });
        coverTargets = [t0.id, ...siblings];
      } else coverTargets = [t0.id];
    } else {
      rows.forEach((r) => {
        const p: Partial<Track> = {
          title: r.title.trim() || initial.find((t) => t.id === r.id)?.title || "Untitled",
          artist: r.artist.trim() || "Unknown Artist",
          trackNo: num(r.trackNo),
          discNo: num(r.discNo),
        };
        if (f.album.trim()) p.album = f.album.trim();
        if (f.albumArtist.trim()) p.albumArtist = f.albumArtist.trim();
        if (f.year.trim()) p.year = num(f.year);
        if (f.genre.trim()) p.genre = f.genre.trim();
        patches[r.id] = p;
      });
    }
    updateTracks(patches);
    if (coverFile) await setCover(coverTargets, coverFile);
    else if (removeCover) {
      const rm: Record<string, Partial<Track>> = {};
      coverTargets.forEach((id) => (rm[id] = { coverId: null }));
      updateTracks(rm);
    }
    toast(single ? "Tags saved" : `Saved tags for ${initial.length} tracks`, "success");
    onClose();
  };

  const coverUrl = removeCover ? null : preview ?? (t0.coverId ? covers[t0.coverId] : null);

  return (
    <Modal
      title={single ? "Edit tags" : "Edit album"}
      onClose={onClose}
      wide={!single}
      footer={
        <>
          <button className="btn" onClick={onClose} data-sfx="back">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()}>
            <Icon name="check" size={14} strokeWidth={3} /> Save
          </button>
        </>
      }
    >
      <p className="mb-4 text-xs text-mute">
        Tags are stored inside Bladebeat&apos;s library. Your original audio files on the device stay unchanged.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:items-stretch">
          <div className="aspect-square w-28 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/15 sm:w-full">
            {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <CoverArt coverId={null} seed={t0.album + t0.artist} iconSize={32} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <button className="btn !px-3 !py-2" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={14} /> Cover
            </button>
            {(t0.coverId || coverFile) && !removeCover && (
              <button
                className="btn !px-3 !py-2"
                onClick={() => {
                  setCoverFile(null);
                  setRemoveCover(true);
                }}
              >
                <Icon name="trash" size={14} /> Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCoverFile(file);
                  setRemoveCover(false);
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3">
          {single ? (
            <>
              <Field label="Title" className="col-span-2">
                <input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus />
              </Field>
              <Field label="Artist" className="col-span-2">
                <input className="field" value={f.artist} onChange={(e) => set("artist", e.target.value)} />
              </Field>
              <Field label="Album" className="col-span-2">
                <input className="field" value={f.album} onChange={(e) => set("album", e.target.value)} placeholder={UNKNOWN_ALBUM} />
              </Field>
              <Field label="Album artist" className="col-span-2">
                <input className="field" value={f.albumArtist} onChange={(e) => set("albumArtist", e.target.value)} placeholder="Same as artist" />
              </Field>
              <Field label="Track #">
                <div className="flex items-center gap-2">
                  <input className="field" inputMode="numeric" value={f.trackNo} onChange={(e) => set("trackNo", e.target.value)} placeholder="1" />
                  <span className="text-mute">/</span>
                  <input className="field" inputMode="numeric" value={f.trackOf} onChange={(e) => set("trackOf", e.target.value)} placeholder="12" />
                </div>
              </Field>
              <Field label="Disc #">
                <input className="field" inputMode="numeric" value={f.discNo} onChange={(e) => set("discNo", e.target.value)} placeholder="1" />
              </Field>
              <Field label="Year">
                <input className="field" inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="2024" />
              </Field>
              <Field label="Genre">
                <input className="field" value={f.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Electronic" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Album" className="col-span-2">
                <input className="field" value={f.album} onChange={(e) => set("album", e.target.value)} placeholder="Keep current" />
              </Field>
              <Field label="Album artist" className="col-span-2">
                <input className="field" value={f.albumArtist} onChange={(e) => set("albumArtist", e.target.value)} placeholder="Keep current" />
              </Field>
              <Field label="Year">
                <input className="field" inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="Keep current" />
              </Field>
              <Field label="Genre">
                <input className="field" value={f.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Keep current" />
              </Field>
            </>
          )}
        </div>
      </div>

      {single && siblings.length > 0 && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={applyAlbum} onChange={(e) => setApplyAlbum(e.target.checked)} />
          <span>
            Apply album, album artist, year, genre &amp; cover to the other {siblings.length} track{siblings.length === 1 ? "" : "s"} of this album
          </span>
        </label>
      )}

      {!single && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Tracks</span>
            <button
              className="btn !px-3 !py-1.5"
              onClick={() => setRows((p) => p.map((r, i) => ({ ...r, trackNo: String(i + 1) })))}
            >
              <Icon name="queue" size={13} /> Auto-number
            </button>
          </div>
          <div className="grid grid-cols-[3.2rem_3.2rem_1fr_1fr] items-center gap-2 px-1 pb-1">
            <span className="label !text-[0.6rem]">#</span>
            <span className="label !text-[0.6rem]">Disc</span>
            <span className="label !text-[0.6rem]">Title</span>
            <span className="label !text-[0.6rem]">Artist</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[3.2rem_3.2rem_1fr_1fr] items-center gap-2">
                <input className="field !px-2 text-center" inputMode="numeric" value={r.trackNo} onChange={(e) => setRow(i, "trackNo", e.target.value)} aria-label={`Track number ${i + 1}`} />
                <input className="field !px-2 text-center" inputMode="numeric" value={r.discNo} onChange={(e) => setRow(i, "discNo", e.target.value)} aria-label={`Disc number ${i + 1}`} />
                <input className="field" value={r.title} onChange={(e) => setRow(i, "title", e.target.value)} aria-label={`Title ${i + 1}`} />
                <input className="field" value={r.artist} onChange={(e) => setRow(i, "artist", e.target.value)} aria-label={`Artist ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
