import { parseBlob, selectCover, TimestampFormat } from "music-metadata";
import type { ICommonTagsResult, ILyricsTag } from "music-metadata";
import type { Track } from "./types";
import { db } from "./db";
import { hashBytes, uid } from "./format";
import { UNKNOWN_ALBUM } from "./albums";
import { toLrcStamp } from "./lrc";

export const AUDIO_ACCEPT =
  "audio/*,.mp3,.m4a,.m4b,.aac,.flac,.ogg,.oga,.opus,.wav,.weba,.aif,.aiff,.amr,.3gp";
const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|flac|ogg|oga|opus|wav|weba|aif|aiff|amr|3gp)$/i;

export function isAudioFile(f: File): boolean {
  return f.type.startsWith("audio/") || AUDIO_EXT.test(f.name);
}

export function fileSig(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function guessMime(name: string, type: string): string {
  if (type && type.startsWith("audio/")) return type;
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "m4b":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "ogg":
    case "oga":
    case "opus":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "weba":
      return "audio/webm";
    case "aif":
    case "aiff":
      return "audio/aiff";
    default:
      return type || "audio/mpeg";
  }
}

function fromFilename(name: string) {
  let base = name.replace(/\.[^.]+$/, "").trim();
  let trackNo = 0;
  const m = base.match(/^(\d{1,3})\s*[-._)]\s*(.+)$/) || base.match(/^(\d{2})\s+(.+)$/);
  if (m) {
    trackNo = parseInt(m[1], 10);
    base = m[2].trim();
  }
  base = base.replace(/_/g, " ");
  let artist = "";
  let title = base;
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    artist = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  }
  return { title: title || name, artist, trackNo };
}

function lyricsFrom(common: ICommonTagsResult): string {
  const arr = (common.lyrics ?? []) as unknown[];
  let plain = "";
  for (const l of arr) {
    if (typeof l === "string") {
      if (!plain) plain = l;
      continue;
    }
    const t = l as ILyricsTag;
    if (t.syncText?.length && t.timeStampFormat === TimestampFormat.milliseconds) {
      return t.syncText.map((s) => `${toLrcStamp((s.timestamp ?? 0) / 1000)}${s.text}`).join("\n");
    }
    if (t.text && !plain) plain = t.text;
  }
  return plain.trim();
}

function toBlob(data: Uint8Array, type: string): Blob {
  const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return new Blob([copy], { type });
}

/** Crops to a square and scales an image down so covers stay light in storage. */
export async function resizeImage(blob: Blob, size = 480): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(bmp.width, bmp.height);
    const out = Math.min(size, s);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, out, out);
    bmp.close?.();
    const res = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return res ?? blob;
  } catch {
    return blob;
  }
}

export async function coverFromImageFile(file: Blob): Promise<{ id: string; blob: Blob }> {
  const blob = await resizeImage(file);
  const id = hashBytes(new Uint8Array(await blob.arrayBuffer()));
  return { id, blob };
}

function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    let finished = false;
    const done = (d: number) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      a.removeAttribute("src");
      resolve(d);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    a.src = url;
  });
}

async function buildTrack(file: File, sig: string) {
  const mime = guessMime(file.name, file.type);
  const fallback = fromFilename(file.name);
  const track: Track = {
    id: uid(),
    sig,
    fileName: file.name,
    size: file.size,
    mime,
    addedAt: Date.now(),
    duration: 0,
    title: fallback.title,
    artist: fallback.artist,
    albumArtist: "",
    album: "",
    trackNo: fallback.trackNo,
    trackOf: 0,
    discNo: 0,
    year: 0,
    genre: "",
    lyrics: "",
    coverId: null,
    plays: 0,
    lastPlayed: 0,
    favorite: false,
  };
  let cover: { id: string; blob: Blob } | null = null;

  try {
    const m = await parseBlob(file, { skipPostHeaders: true });
    const c = m.common;
    if (c.title?.trim()) track.title = c.title.trim();
    if (c.artist?.trim()) track.artist = c.artist.trim();
    else if (c.artists?.length) track.artist = c.artists.join(", ");
    if (c.albumartist?.trim()) track.albumArtist = c.albumartist.trim();
    if (c.album?.trim()) track.album = c.album.trim();
    if (c.track?.no) track.trackNo = c.track.no;
    if (c.track?.of) track.trackOf = c.track.of;
    if (c.disk?.no) track.discNo = c.disk.no;
    const y = c.year ?? (c.date ? parseInt(c.date.slice(0, 4), 10) : 0);
    if (y && Number.isFinite(y)) track.year = y;
    if (c.genre?.length) track.genre = c.genre[0];
    track.lyrics = lyricsFrom(c);
    if (m.format.duration && Number.isFinite(m.format.duration)) track.duration = m.format.duration;
    const pic = selectCover(c.picture);
    if (pic && pic.data?.length) {
      const raw = toBlob(pic.data, pic.format || "image/jpeg");
      const blob = await resizeImage(raw);
      cover = { id: hashBytes(pic.data), blob };
      track.coverId = cover.id;
    }
  } catch (e) {
    console.warn("Could not read tags for", file.name, e);
  }

  const blob = new Blob([file], { type: mime });
  if (!track.duration) track.duration = await probeDuration(blob);
  if (!track.album) track.album = UNKNOWN_ALBUM;
  if (!track.artist) track.artist = "Unknown Artist";
  return { track, blob, cover };
}

export interface ImportHooks {
  onProgress: (done: number, total: number) => void;
  onAdded: (track: Track, cover: { id: string; blob: Blob } | null) => void;
}

export async function importFiles(files: File[], existing: Set<string>, hooks: ImportHooks) {
  const list = files.filter(isAudioFile);
  const total = list.length;
  let done = 0;
  let added = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;
  hooks.onProgress(0, total);

  const worker = async () => {
    while (cursor < list.length) {
      const f = list[cursor++];
      const sig = fileSig(f);
      if (existing.has(sig)) {
        skipped++;
      } else {
        existing.add(sig);
        try {
          const { track, blob, cover } = await buildTrack(f, sig);
          await db.addTrack(track, blob, cover);
          hooks.onAdded(track, cover);
          added++;
        } catch (e) {
          console.warn("Import failed", f.name, e);
          existing.delete(sig);
          failed++;
        }
      }
      done++;
      hooks.onProgress(done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, Math.max(1, list.length)) }, worker));
  return { added, skipped, failed, ignored: files.length - list.length };
}

/** Opens the system file picker (on phones this is the permission / document picker). */
export function pickFiles(opts?: { directory?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if (opts?.directory) input.setAttribute("webkitdirectory", "");
    else input.accept = AUDIO_ACCEPT;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      resolve(Array.from(input.files ?? []));
      setTimeout(() => input.remove(), 0);
    });
    input.addEventListener("cancel", () => {
      resolve([]);
      input.remove();
    });
    input.click();
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  // Must be read synchronously, DataTransfer is emptied after the event.
  const entries = Array.from(dt.items ?? [])
    .map((i) => (i as any).webkitGetAsEntry?.())
    .filter(Boolean);
  if (!entries.length) return Array.from(dt.files);
  const walk = async (entry: any): Promise<void> => {
    if (entry.isFile) {
      const f: File = await new Promise((res, rej) => entry.file(res, rej));
      out.push(f);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch: any[] = [];
      do {
        batch = await new Promise<any[]>((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}
