# Bladebeat – local music player

A retro, console-style music player that runs **100 % in your browser** and plays the audio files that are on *your* device (phone or computer). No server, no accounts, no uploads.

* **Albums as a game shelf** – scroll through 3D "game cases" like a console dashboard (mouse wheel, swipe, ← →, D-pad).
* **Three dark themes** – **Toxic** (Original-Xbox green), **Neon** (blue) and **Danger** (red). Each theme also changes the UI sound "voice".
* **Synthesised UI sounds** – clicks, blade swishes, boot chime. One tap on the ⚡ icon (or *System → Sounds*) turns them on/off.
* **10-band equalizer** with presets, pre-amp, limiter and live spectrum · playback speed.
* **Round visualizer** (Ring Bars · Wave Ring · Orbit) wrapped around a spinning disc.
* **Lyrics** – reads embedded lyrics, synced `.lrc` highlighting, import `.lrc/.txt`, optional lookup on [LRCLIB](https://lrclib.net), and a built-in *timestamp tool* to sync lines yourself.
* **Favorites, playlists, smart lists** (recent / most played), queue with reordering, shuffle, repeat.
* **Tag editor** – title, artist, album, album artist, **track #**, disc #, year, genre, cover art. Edit one song or a whole album at once (with *Auto-number*).
* **Sleep timer** – minutes or "after this track", with a gentle 20 s fade-out.
* Search, sorting, drag-and-drop of files/folders, keyboard shortcuts (`?`), game-controller support, lock-screen controls (Media Session), backup/restore of tags & playlists, installable PWA that works offline.

## How it accesses your phone's music

Browsers never let a web page silently read your storage – you grant access through the system file picker. On first launch Bladebeat shows a welcome screen; press **Allow & select music**:

* it asks the browser to make its storage *persistent* (so the library isn't evicted), and
* opens the system picker (on Android/iOS this is the normal "choose files" sheet) where you pick your MP3 / M4A / FLAC / OGG / WAV files – or a whole folder via **Select a folder**.

The chosen files are copied into the browser's private storage (IndexedDB), so they are still there next time you open the app – even offline. Nothing ever leaves the device. *(The only optional network call is the "Find lyrics online" button.)*

> No music on hand? Press **Try generated demo tracks** – the app synthesises three small demo albums with lyrics.

## Run locally

```bash
npm install
npm run dev        # development
npm run build      # production build -> dist/index.html (single self-contained file)
npm run preview
```

## Publish it with GitHub Pages

1. Create a new GitHub repository and push this project to the `main` branch.
2. In the repo go to **Settings → Pages → Build and deployment → Source: _GitHub Actions_**.
3. That's it – `.github/workflows/deploy.yml` builds the app (`npm run build -- --base=./`, so it works under `https://<user>.github.io/<repo>/`) and publishes it on every push.
4. Open the Pages URL on your phone, press **Allow & select music**, and optionally use the browser menu → **Install app / Add to Home Screen**.

## Keyboard shortcuts

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `Space` / `K` | Play / pause | `N` / `P` | Next / previous |
| `←` `→` | Seek 5 s (Albums: select album) | `Shift`+`←` `→` | Seek 10 s |
| `Shift`+`↑` `↓` / `+` `-` | Volume | `M` | Mute |
| `F` | Favorite | `S` / `R` | Shuffle / repeat |
| `Q` | Queue | `L` | Lyrics |
| `E` | Equalizer | `T` | Cycle theme |
| `1`–`7` | Switch tab | `/` | Search |
| `Enter` | Play selected album | `?` | Help |

Controller: D-pad ◀ ▶ select · **A** play · **B** back · **X** shuffle · **Y** queue · **LB/RB** switch tab · **LT/RT** previous/next track · **Start** play/pause.

## Tech

React 19 · Vite · Tailwind CSS 4 · Zustand · [music-metadata](https://github.com/Borewit/music-metadata) (tag/cover/lyrics reading) · Web Audio API · IndexedDB.

Playback depends on what your browser can decode (MP3, AAC/M4A, OGG, WAV and FLAC work in all current browsers).
