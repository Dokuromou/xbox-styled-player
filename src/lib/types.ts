export type ThemeId = "toxic" | "neon" | "danger";

export type ViewId = "albums" | "songs" | "playlists" | "favorites" | "now" | "eq" | "system";

export interface Track {
  id: string;
  /** file signature used to avoid importing duplicates and to restore backups */
  sig: string;
  fileName: string;
  size: number;
  mime: string;
  addedAt: number;
  duration: number;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  trackNo: number;
  trackOf: number;
  discNo: number;
  year: number;
  genre: string;
  /** plain text or LRC formatted lyrics */
  lyrics: string;
  coverId: string | null;
  plays: number;
  lastPlayed: number;
  favorite: boolean;
  demo?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  coverId: string | null;
  trackIds: string[];
  duration: number;
  addedAt: number;
}

export type RepeatMode = "off" | "all" | "one";

export interface EqState {
  enabled: boolean;
  gains: number[];
  preamp: number;
  preset: string;
  limiter: boolean;
}

export type ModalState =
  | { type: "tags"; ids: string[] }
  | { type: "playlistPicker"; ids: string[] }
  | { type: "newPlaylist"; ids?: string[] }
  | { type: "renamePlaylist"; id: string }
  | { type: "sleep" }
  | { type: "lyrics"; id: string }
  | { type: "shortcuts" }
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    };

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}
