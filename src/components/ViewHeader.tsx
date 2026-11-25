import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

export function ViewHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold uppercase tracking-[0.2em] text-ink sm:text-3xl [text-shadow:0_0_26px_rgb(var(--glow)/0.55)]">
          {title}
        </h1>
        {subtitle && <div className="label mt-0.5">{subtitle}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="panel mx-auto flex max-w-lg animate-rise flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent shadow-[0_0_30px_rgb(var(--glow)/0.3)]">
        <Icon name={icon} size={30} strokeWidth={1.6} />
      </span>
      <h2 className="font-display text-xl font-bold uppercase tracking-widest text-ink">{title}</h2>
      <p className="max-w-sm text-sm text-mute">{text}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
