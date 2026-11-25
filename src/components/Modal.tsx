import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { Icon } from "./Icons";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "panel relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-b-none sm:rounded-b-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        style={{ background: "linear-gradient(180deg, rgb(255 255 255 / .08), rgb(255 255 255 / .02)), rgb(var(--panel-rgb) / .96)" }}
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-accent2 via-accent to-accent2 shadow-[0_0_16px_var(--accent)]" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-ink">{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close" data-sfx="back">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-black/25 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
