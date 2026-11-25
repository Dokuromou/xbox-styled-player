import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "./Icons";

export type MenuItem =
  | "sep"
  | {
      label: string;
      icon?: IconName;
      onClick: () => void;
      danger?: boolean;
      disabled?: boolean;
    };

interface Props {
  getItems: () => MenuItem[];
  className?: string;
  icon?: IconName;
  label?: string;
  size?: number;
}

const MENU_W = 232;

export function MenuButton({ getItems, className, icon = "more", label = "More actions", size = 18 }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<{ items: MenuItem[]; left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-root]") && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(null);
    const r = btn.current!.getBoundingClientRect();
    const items = getItems();
    const est = items.reduce((h, it) => h + (it === "sep" ? 9 : 40), 12);
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    if (r.bottom + est + 8 > window.innerHeight && r.top > est) setOpen({ items, left, bottom: window.innerHeight - r.top + 6 });
    else setOpen({ items, left, top: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btn}
        className={cn("iconbtn", className)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!open}
        data-on={!!open}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        <Icon name={icon} size={size} />
      </button>
      {open &&
        createPortal(
          <div
            data-menu-root
            role="menu"
            className="panel fixed z-[90] max-h-[70dvh] animate-pop overflow-y-auto py-1.5 scroll-thin"
            style={{
              width: MENU_W,
              left: open.left,
              top: open.top,
              bottom: open.bottom,
              background: "linear-gradient(180deg, rgb(255 255 255 / .09), rgb(255 255 255 / .03)), rgb(var(--panel-rgb) / .97)",
            }}
          >
            {open.items.map((it, i) =>
              it === "sep" ? (
                <div key={i} className="my-1 h-px bg-white/10" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(null);
                    it.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10",
                    it.danger ? "text-red-300 hover:bg-red-500/15" : "text-ink"
                  )}
                >
                  {it.icon && <Icon name={it.icon} size={16} className={it.danger ? "text-red-300" : "text-accent"} />}
                  <span className="truncate">{it.label}</span>
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}
