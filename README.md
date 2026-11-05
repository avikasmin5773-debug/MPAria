<div align="center">

# 🎵 MPAria

**Private, offline-first music player for the music you own.**

[![GitHub](https://img.shields.io/badge/GitHub-avikasmin5773--debug%2FMPAria-181717?logo=github)](https://github.com/avikasmin5773-debug/MPAria)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

</div>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🏷️ | **Auto Namer** | Names tracks from file names when tags are missing |
| 🖼️ | **Auto Thumbnail** | Uses the first frame of a video as its thumbnail |
| 🎨 | **Drag & Drop Artwork** | Accepts any image type to set cover art |
| 📝 | **Lyrics Editor** | Per-track lyrics, stored locally |
| 🎚️ | **Equalizer** | 5-band EQ with presets |
| ⚡ | **Playback Speed** | Cycle 0.5× → 2× |
| ⏩ | **Skip Buttons** | ±10s seek controls |
| 📀 | **Playlists** | Create, import & export (JSON) |
| 🔁 | **Duplicate Scanner** | Find and remove duplicate tracks |
| ↩️ | **Undo Delete** | Press `U` to restore a removed song |
| 🌗 | **Themes** | Dark / light |
| 📱 | **Mini Player** | Compact playback mode |

## 📸 Screenshots

<div align="center">

| Home | Songs |
|---|---|
| ![Home](assets/screenshot-home.png) | ![Songs](assets/screenshot-songs.png) |

| Albums | Artists |
|---|---|
| ![Albums](assets/screenshot-albums.png) | ![Artists](assets/screenshot-artists.png) |

| Settings |
|---|
| ![Settings](assets/screenshot-settings.png) |

</div>

## 🚀 Setup

### Run the app (macOS)

1. Open `MPAria.app` (or run `Contents/MacOS/launcher`).
2. Requires Python 3 (used to serve the local library).

### Build from source

```bash
bash Contents/Resources/build-app.sh
```

Requires Xcode Command Line Tools (`swiftc`).

### Run the web UI standalone

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000/index.html
```

## 📁 Source structure

```
MPAria-source/
├── index.html
├── css/app.css
├── js/
│   ├── app.js          # application logic
│   ├── db.js           # IndexedDB storage
│   ├── tags.js         # audio metadata reader
│   └── audio-lab.js    # starter track generator
├── sw.js               # service worker
├── manifest.webmanifest
└── assets/
```

## ⚖️ Copyright

MPAria does **not** bundle or download copyrighted music. Import only files you own or have the rights to use. A copyright reminder is shown on first launch.

---

<div align="center">
Made with ❤️ for your personal collection.
</div>
