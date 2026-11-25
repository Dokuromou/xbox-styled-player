import type { Track } from "./types";

interface LrcLibItem {
  trackName?: string;
  artistName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

/**
 * Optional online lookup using the free, open LRCLIB service (https://lrclib.net).
 * Only the song title / artist / album / duration are sent, and only when you press the button.
 */
export async function fetchLyricsOnline(t: Track): Promise<{ text: string; synced: boolean } | null> {
  const pick = (j: LrcLibItem | undefined | null) => {
    if (!j) return null;
    if (j.syncedLyrics) return { text: j.syncedLyrics, synced: true };
    if (j.plainLyrics) return { text: j.plainLyrics, synced: false };
    return null;
  };
  const clean = (s: string) => s.replace(/\s*[([].*?(remaster|live|version|edit|feat).*?[)\]]/gi, "").trim();
  const album = t.album && t.album !== "Unknown Album" ? t.album : "";

  try {
    const exact = new URLSearchParams({ track_name: t.title, artist_name: t.artist });
    if (album) exact.set("album_name", album);
    if (t.duration) exact.set("duration", String(Math.round(t.duration)));
    const r = await fetch(`https://lrclib.net/api/get?${exact}`);
    if (r.ok) {
      const hit = pick((await r.json()) as LrcLibItem);
      if (hit) return hit;
    }
  } catch {
    /* fall through to search */
  }

  const search = new URLSearchParams({ track_name: clean(t.title), artist_name: t.artist });
  const r2 = await fetch(`https://lrclib.net/api/search?${search}`);
  if (!r2.ok) throw new Error(`LRCLIB returned ${r2.status}`);
  const list = (await r2.json()) as LrcLibItem[];
  if (!Array.isArray(list) || !list.length) return null;
  const close = list
    .filter((x) => !t.duration || !x.duration || Math.abs(x.duration - t.duration) < 8)
    .sort((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics));
  return pick(close[0]) ?? pick(list.find((x) => x.syncedLyrics) ?? list[0]);
}
