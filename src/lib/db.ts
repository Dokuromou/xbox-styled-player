import type { Playlist, Track } from "./types";

/**
 * Tiny IndexedDB wrapper. Audio files are copied into the browser's private
 * storage so the library survives reloads, even on phones where the browser
 * cannot keep a permanent handle to files outside its sandbox.
 */
const NAME = "bladebeat-db";
const VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("tracks")) d.createObjectStore("tracks", { keyPath: "id" });
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
        if (!d.objectStoreNames.contains("covers")) d.createObjectStore("covers");
        if (!d.objectStoreNames.contains("playlists")) d.createObjectStore("playlists", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export interface LoadedData {
  tracks: Track[];
  playlists: Playlist[];
  covers: { id: string; blob: Blob }[];
}

export const db = {
  async loadAll(): Promise<LoadedData> {
    const d = await open();
    const tx = d.transaction(["tracks", "playlists", "covers"], "readonly");
    const tracksP = reqP(tx.objectStore("tracks").getAll() as IDBRequest<Track[]>);
    const playlistsP = reqP(tx.objectStore("playlists").getAll() as IDBRequest<Playlist[]>);
    const coverKeysP = reqP(tx.objectStore("covers").getAllKeys());
    const coverValsP = reqP(tx.objectStore("covers").getAll() as IDBRequest<Blob[]>);
    const [tracks, playlists, keys, vals] = await Promise.all([tracksP, playlistsP, coverKeysP, coverValsP]);
    const covers = keys.map((k, i) => ({ id: String(k), blob: vals[i] }));
    return { tracks, playlists, covers };
  },

  async addTrack(track: Track, file: Blob, cover?: { id: string; blob: Blob } | null) {
    const d = await open();
    const tx = d.transaction(["tracks", "files", "covers"], "readwrite");
    tx.objectStore("tracks").put(track);
    tx.objectStore("files").put(file, track.id);
    if (cover) tx.objectStore("covers").put(cover.blob, cover.id);
    await txDone(tx);
  },

  async putTracks(tracks: Track[]) {
    if (!tracks.length) return;
    const d = await open();
    const tx = d.transaction("tracks", "readwrite");
    const s = tx.objectStore("tracks");
    tracks.forEach((t) => s.put(t));
    await txDone(tx);
  },

  async putCover(id: string, blob: Blob) {
    const d = await open();
    const tx = d.transaction("covers", "readwrite");
    tx.objectStore("covers").put(blob, id);
    await txDone(tx);
  },

  async deleteTracks(ids: string[]) {
    if (!ids.length) return;
    const d = await open();
    const tx = d.transaction(["tracks", "files"], "readwrite");
    ids.forEach((id) => {
      tx.objectStore("tracks").delete(id);
      tx.objectStore("files").delete(id);
    });
    await txDone(tx);
  },

  async deleteCovers(ids: string[]) {
    if (!ids.length) return;
    const d = await open();
    const tx = d.transaction("covers", "readwrite");
    ids.forEach((id) => tx.objectStore("covers").delete(id));
    await txDone(tx);
  },

  async getFile(id: string): Promise<Blob | undefined> {
    const d = await open();
    return reqP(d.transaction("files", "readonly").objectStore("files").get(id) as IDBRequest<Blob | undefined>);
  },

  async putPlaylist(p: Playlist) {
    const d = await open();
    const tx = d.transaction("playlists", "readwrite");
    tx.objectStore("playlists").put(p);
    await txDone(tx);
  },

  async deletePlaylist(id: string) {
    const d = await open();
    const tx = d.transaction("playlists", "readwrite");
    tx.objectStore("playlists").delete(id);
    await txDone(tx);
  },

  async clearAll() {
    const d = await open();
    const tx = d.transaction(["tracks", "files", "covers", "playlists"], "readwrite");
    ["tracks", "files", "covers", "playlists"].forEach((n) => tx.objectStore(n).clear());
    await txDone(tx);
  },
};
