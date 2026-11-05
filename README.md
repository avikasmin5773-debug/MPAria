# MPAria — Offline Music Player

Source code for the MPAria desktop app. The native shell lives in `MPAria.app/Contents`; this folder contains the web UI.

## Structure
- `index.html` — app shell and icons
- `css/app.css` — styles
- `js/app.js` — application logic
- `js/db.js` — IndexedDB storage
- `js/tags.js` — audio metadata reader
- `js/audio-lab.js` — starter track generator
- `sw.js` — service worker
- `manifest.webmanifest` — PWA manifest

## Run
Open `MPAria.app` or serve this folder over http://127.0.0.1.
