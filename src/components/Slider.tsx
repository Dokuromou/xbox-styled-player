import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../utils/cn";

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  orientation?: "h" | "v";
  /** "center" fills from the middle (EQ gain sliders) */
  fillFrom?: "start" | "center";
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step,
  onChange,
  onCommit,
  orientation = "h",
  fillFrom = "start",
  className,
  label,
  disabled,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const last = useRef(value);
  const vertical = orientation === "v";

  const read = (e: PointerEvent): number => {
    const r = ref.current!.getBoundingClientRect();
    const p = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    const raw = min + Math.min(1, Math.max(0, p)) * (max - min);
    const v = step ? Math.round(raw / step) * step : raw;
    return Math.min(max, Math.max(min, v));
  };

  const down = (e: PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    const v = read(e);
    last.current = v;
    onChange(v);
  };
  const move = (e: PointerEvent) => {
    if (!dragging.current) return;
    const v = read(e);
    last.current = v;
    onChange(v);
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit?.(last.current);
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const s = step ?? (max - min) / 50;
    let v = value;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") v += s;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= s;
    else if (e.key === "Home") v = min;
    else if (e.key === "End") v = max;
    else return;
    e.preventDefault();
    e.stopPropagation();
    v = Math.min(max, Math.max(min, v));
    onChange(v);
    onCommit?.(v);
  };

  const pct = ((value - min) / (max - min)) * 100;
  const zero = ((0 - min) / (max - min)) * 100;
  const from = fillFrom === "center" ? Math.min(pct, zero) : 0;
  const to = fillFrom === "center" ? Math.max(pct, zero) : pct;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      tabIndex={disabled ? -1 : 0}
      data-sfx="none"
      data-sfx-hover="none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={cn(
        "group relative touch-none select-none outline-offset-4",
        vertical ? "h-full w-8 cursor-ns-resize" : "h-5 w-full cursor-pointer",
        disabled && "opacity-40",
        className
      )}
    >
      <div
        className={cn(
          "absolute overflow-hidden rounded-full bg-white/12",
          vertical ? "bottom-0 left-1/2 top-0 w-1.5 -translate-x-1/2" : "left-0 right-0 top-1/2 h-1.5 -translate-y-1/2"
        )}
      >
        <div
          className="absolute rounded-full bg-gradient-to-r from-accent2 to-accent shadow-[0_0_12px_var(--accent)]"
          style={
            vertical
              ? { left: 0, right: 0, bottom: `${from}%`, height: `${to - from}%`, backgroundImage: "linear-gradient(to top, var(--accent2), var(--accent))" }
              : { top: 0, bottom: 0, left: `${from}%`, width: `${to - from}%` }
          }
        />
      </div>
      <div
        className={cn(
          "absolute h-4 w-4 rounded-full border-2 border-white/80 bg-gradient-to-b from-white to-accent shadow-[0_0_12px_rgb(var(--glow)/0.8)] transition-transform group-hover:scale-110 group-active:scale-125",
          vertical ? "left-1/2 -translate-x-1/2 translate-y-1/2" : "top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={vertical ? { bottom: `${pct}%` } : { left: `${pct}%` }}
      />
    </div>
  );
}
