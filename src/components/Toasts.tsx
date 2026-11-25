import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Icon } from "./Icons";

/** Achievement-style pop-ups that slide in from the bottom. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[95] flex flex-col items-center gap-2 px-4 sm:bottom-32">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel pointer-events-auto flex max-w-md animate-toast-in items-center gap-3 rounded-full py-2 pl-2 pr-5 shadow-[0_10px_40px_rgb(0_0_0/0.6)]"
          style={{ background: "linear-gradient(180deg, rgb(255 255 255 / .12), rgb(255 255 255 / .03)), rgb(var(--panel-rgb) / .96)" }}
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-onaccent shadow-[0_0_14px_rgb(var(--glow)/0.6)]",
              t.kind === "error" ? "bg-red-500 text-white" : "bg-gradient-to-b from-accent to-accent2"
            )}
          >
            <Icon name={t.kind === "error" ? "close" : t.kind === "success" ? "check" : "music"} size={18} strokeWidth={2.6} />
          </span>
          <span className="text-sm font-semibold leading-tight text-ink">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
