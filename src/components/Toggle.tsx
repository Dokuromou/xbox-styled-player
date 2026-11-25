import { cn } from "../utils/cn";

export function Toggle({ on, onChange, label, silent }: { on: boolean; onChange: (v: boolean) => void; label: string; silent?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-sfx={silent ? "none" : on ? "off" : "on"}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200",
        on ? "border-accent bg-accent/30 shadow-[0_0_16px_rgb(var(--glow)/0.45)]" : "border-white/20 bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full transition-all duration-200",
          on ? "left-[25px] bg-gradient-to-b from-white to-accent shadow-[0_0_10px_var(--accent)]" : "left-[3px] bg-white/70"
        )}
      />
    </button>
  );
}
