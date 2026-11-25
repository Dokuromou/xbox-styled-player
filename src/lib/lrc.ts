export interface LyricLine {
  /** seconds, or -1 when the line has no timestamp */
  time: number;
  text: string;
}

export interface ParsedLyrics {
  synced: boolean;
  lines: LyricLine[];
}

const TS = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Parses LRC (synced) or plain text lyrics. */
export function parseLyrics(raw: string): ParsedLyrics {
  const text = (raw || "").replace(/\r/g, "");
  if (!text.trim()) return { synced: false, lines: [] };

  let offset = 0;
  const off = text.match(/\[offset:\s*(-?\d+)\]/i);
  if (off) offset = parseInt(off[1], 10) / 1000;

  const synced: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const stamps: number[] = [];
    TS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TS.exec(line))) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) / 1000 : 0;
      stamps.push(min * 60 + sec + frac);
    }
    const content = line.replace(TS, "").replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "").trim();
    if (stamps.length) {
      for (const s of stamps) synced.push({ time: Math.max(0, s + offset), text: content });
    } else if (/^\[[a-z]{2,8}:.*\]$/i.test(line.trim())) {
      // metadata tag such as [ar:Artist] – ignore
      continue;
    } else {
      plain.push({ time: -1, text: line.trim() });
    }
  }

  if (synced.length >= 2) {
    synced.sort((a, b) => a.time - b.time);
    return { synced: true, lines: synced };
  }
  // collapse long runs of blank lines
  const out: LyricLine[] = [];
  for (const l of plain) {
    if (!l.text && (!out.length || !out[out.length - 1].text)) continue;
    out.push(l);
  }
  while (out.length && !out[out.length - 1].text) out.pop();
  return { synced: false, lines: out };
}

/** Index of the active lyric line for a given time (binary search). */
export function activeLine(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t + 0.12) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function toLrcStamp(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `[${m.toString().padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`;
}
