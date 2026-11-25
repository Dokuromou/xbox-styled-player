import type { CSSProperties } from "react";
import { cn } from "../utils/cn";
import { hashStr } from "../lib/format";
import { useCoverUrl } from "../hooks";
import { Icon } from "./Icons";

interface Props {
  coverId?: string | null;
  seed: string;
  className?: string;
  iconSize?: number;
  eager?: boolean;
}

/** Album art or – when a track has no embedded cover – a generated theme-coloured placeholder. */
export function CoverArt({ coverId, seed, className, iconSize = 28, eager }: Props) {
  const url = useCoverUrl(coverId);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("h-full w-full select-none object-cover", className)}
      />
    );
  }
  const h = hashStr(seed || "x") % 36;
  return (
    <div
      className={cn("fallback-art relative flex h-full w-full items-center justify-center overflow-hidden", className)}
      style={{ "--h": h } as CSSProperties}
    >
      <div className="absolute -right-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-white/10 blur-xl" />
      <Icon name="music" size={iconSize} className="relative text-white/60" strokeWidth={1.6} />
    </div>
  );
}
