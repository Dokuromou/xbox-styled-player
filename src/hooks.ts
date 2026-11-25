import { useEffect, useState } from "react";
import { useStore } from "./store";
import { engine } from "./lib/engine";
import type { Track } from "./lib/types";

/** Live playback position (seconds) – updated via rAF, only re-renders when the value changes. */
export function useCurrentTime(fps = 15): number {
  const [t, setT] = useState(() => engine.audio.currentTime || 0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 1000 / fps) {
        last = ts;
        setT(engine.audio.currentTime || 0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}

export function useCoverUrl(coverId: string | null | undefined): string | null {
  return useStore((s) => (coverId ? s.covers[coverId] ?? null : null));
}

export function useCurrentTrack(): Track | null {
  return useStore((s) => (s.currentId ? s.tracks[s.currentId] ?? null : null));
}

export function useMediaQuery(query: string): boolean {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setM(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return m;
}
