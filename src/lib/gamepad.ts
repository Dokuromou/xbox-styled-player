import { useStore } from "../store";
import type { ViewId } from "./types";
import { sfx } from "./sfx";

const ORDER: ViewId[] = ["albums", "songs", "playlists", "favorites", "now", "eq", "system"];
let started = false;

/** Console-style controller support: D-pad / A / B / X / Y / bumpers, just like the 360 dashboard. */
export function startGamepad() {
  if (started || typeof navigator === "undefined" || !("getGamepads" in navigator)) return;
  started = true;

  let raf = 0;
  let running = false;
  const prev: Record<number, boolean[]> = {};
  const repeatAt: Record<string, number> = {};

  const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

  const loop = () => {
    const pads = navigator.getGamepads?.() ?? [];
    let any = false;
    const now = performance.now();
    for (const pad of pads) {
      if (!pad) continue;
      any = true;
      const cur = pad.buttons.map((b) => b.pressed);
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (ax < -0.6) cur[14] = true;
      if (ax > 0.6) cur[15] = true;
      if (ay < -0.6) cur[12] = true;
      if (ay > 0.6) cur[13] = true;
      const p = prev[pad.index] ?? [];
      const edge = (i: number) => !!cur[i] && !p[i];
      const held = (i: number) => {
        if (!cur[i]) return false;
        const id = `${pad.index}:${i}`;
        if (!p[i]) {
          repeatAt[id] = now + 380;
          return true;
        }
        if (now > (repeatAt[id] ?? 0)) {
          repeatAt[id] = now + 120;
          return true;
        }
        return false;
      };
      const s = useStore.getState();

      if (s.modal || s.showQueue) {
        if (edge(1)) {
          if (s.modal) s.closeModal();
          else s.toggleQueue(false);
        }
      } else {
        if (held(14)) key("ArrowLeft");
        if (held(15)) key("ArrowRight");
        if (held(12)) s.setVolume(s.volume + 0.05);
        if (held(13)) s.setVolume(s.volume - 0.05);
        if (edge(0)) {
          if (s.view === "albums") key("Enter");
          else s.togglePlay();
        }
        if (edge(1)) s.setView("albums");
        if (edge(2)) {
          const sel = s.albums.find((a) => a.id === s.selectedAlbumId);
          if (s.view === "albums" && sel) s.playList(sel.trackIds, { shuffle: true });
          else s.toggleShuffle();
        }
        if (edge(3)) s.toggleQueue(true);
        if (edge(4) || edge(5)) {
          const i = ORDER.indexOf(s.view);
          s.setView(ORDER[(i + (edge(5) ? 1 : -1) + ORDER.length) % ORDER.length]);
          sfx.play("blade");
        }
        if (edge(6)) s.prev();
        if (edge(7)) s.next();
        if (edge(9)) s.togglePlay();
      }
      prev[pad.index] = cur;
    }
    if (any) raf = requestAnimationFrame(loop);
    else running = false;
  };

  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };

  window.addEventListener("gamepadconnected", () => {
    useStore.getState().toast("Controller connected – D-pad, A, B, X, Y & bumpers work", "success");
    start();
  });
  window.addEventListener("gamepaddisconnected", () => {
    cancelAnimationFrame(raf);
    running = false;
    start();
  });
}
