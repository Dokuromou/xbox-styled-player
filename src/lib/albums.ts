import type { Album, Track } from "./types";
import { norm } from "./format";

export const UNKNOWN_ALBUM = "Unknown Album";
export const UNKNOWN_ARTIST = "Unknown Artist";

export function albumKey(t: Track): string {
  if (!t.album || norm(t.album) === norm(UNKNOWN_ALBUM)) return `unknown|${norm(t.albumArtist || t.artist)}`;
  return `${norm(t.album)}|${norm(t.albumArtist)}`;
}

export function compareTracks(a: Track, b: Track): number {
  if (a.discNo !== b.discNo) return (a.discNo || 1) - (b.discNo || 1);
  const an = a.trackNo || 9999;
  const bn = b.trackNo || 9999;
  if (an !== bn) return an - bn;
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

export function buildAlbums(tracks: Track[]): Album[] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = albumKey(t);
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }
  const albums: Album[] = [];
  for (const [id, list] of groups) {
    list.sort(compareTracks);
    const first = list[0];
    const artistSet = new Set(list.map((t) => norm(t.artist)));
    const artist =
      first.albumArtist ||
      (artistSet.size === 1 ? first.artist || UNKNOWN_ARTIST : "Various Artists");
    const year = list.map((t) => t.year).find((y) => y > 0) ?? 0;
    const genre = list.map((t) => t.genre).find((g) => !!g) ?? "";
    const coverId = list.map((t) => t.coverId).find((c) => !!c) ?? null;
    albums.push({
      id,
      title: first.album || UNKNOWN_ALBUM,
      artist,
      year,
      genre,
      coverId,
      trackIds: list.map((t) => t.id),
      duration: list.reduce((s, t) => s + (t.duration || 0), 0),
      addedAt: Math.max(...list.map((t) => t.addedAt)),
    });
  }
  return albums;
}

export type AlbumSort = "artist" | "title" | "recent" | "year";

export function sortAlbums(albums: Album[], by: AlbumSort): Album[] {
  const a = albums.slice();
  const cmp = (x: string, y: string) => x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
  switch (by) {
    case "title":
      return a.sort((x, y) => cmp(x.title, y.title));
    case "recent":
      return a.sort((x, y) => y.addedAt - x.addedAt || cmp(x.title, y.title));
    case "year":
      return a.sort((x, y) => (y.year || 0) - (x.year || 0) || cmp(x.title, y.title));
    default:
      return a.sort((x, y) => cmp(x.artist, y.artist) || (x.year || 0) - (y.year || 0) || cmp(x.title, y.title));
  }
}
