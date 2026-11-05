/* =========================================================
   MPAria — application logic
   Vanilla JS, offline first, no build step.
   ========================================================= */
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name, cls = "") => `<svg class="icon ${cls}"><use href="#i-${name}"/></svg>`;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000];
  const EQ_LABELS = ["60", "230", "910", "3.6k", "14k"];
  const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0],
    bass: [8, 5, 0, -1, -2],
    vocal: [-2, 1, 4, 3, 0],
    rock: [5, 2, -1, 3, 5],
    electronic: [6, 3, 0, 4, 7]
  };
  const VIDEO_EXTENSIONS = ["mp4","m4v","mov","avi","mkv","webm","wmv","mpg","mpeg","mpe","3gp","3g2","m2ts","ts","mts","m2t","qt"];
  const AUDIO_EXTENSIONS = ["mp1","mp2","mp3","mp4","m4a","m4b","m4p","m4r","m4v","aac","flac","wav","wave","ogg","oga","opus","webm","aif","aiff","aifc","alac","wma","wmv","mov","avi","mkv","mpa","mpga","mpe","mpeg","mpg","3gp","3g2","amr","awb","caf","dsf","dff","mka","ra","ram","rm","rma","spx","tta","voc","vox","vqf","wv","xm","mod","s3m","it","mtm","umx","mo3","ac3","dts","mlp","thd","eac3","m2ts","ts","mts","m2t","m1a","m2a","mp4a","mp4v","qt","m3u","pls"];
  const UNKNOWN_ARTIST = "Unknown artist";
  const UNKNOWN_ALBUM = "Unknown album";

  const COVER_PALETTES = [
    ["#5a3c67", "#1b1624", "#c06a56"],
    ["#2d5661", "#111c21", "#72c5b9"],
    ["#6b4a37", "#1e1510", "#d09a63"],
    ["#3f466f", "#151625", "#8a95dd"],
    ["#69384b", "#1c1119", "#d16979"],
    ["#3b5a3e", "#111c14", "#9bc17a"],
    ["#5e5236", "#1e1a11", "#d7bb6c"],
    ["#4f3651", "#17111a", "#b57ec1"],
    ["#325763", "#101a1e", "#66a9bd"],
    ["#65422f", "#1d130e", "#cd7f4f"]
  ];

  const state = {
    tracks: [],
    playlists: [],
    tracksById: new Map(),
    playlistsById: new Map(),
    view: { type: "home" },
    lastView: { type: "home" },
    searchQuery: "",
    viewTracks: [],
    viewLabel: "All songs",
    sort: "added-desc",
    currentTrackId: null,
    queue: [],
    baseQueue: [],
    queueIndex: -1,
    queueLabel: "",
    isPlaying: false,
    shuffle: false,
    repeat: "off",
    volume: 0.82,
    muted: false,
    playbackRate: 1,
    theme: "dark",
    nowTab: "queue",
    eq: { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 },
    eqPreset: "flat",
    prefs: { autoName: true, autoThumbnail: true, autoMatchCovers: true, autoplayNext: true, rememberPosition: false },
    importing: false,
    importCancelled: false,
    sleepAtEnd: false,
    lastRenderKey: "",
    lastNonSearchView: { type: "home" },
    history: [{ type: "home" }],
    historyIndex: 0,
    lastDeleted: null
  };

  const el = {
    root: $("#viewRoot"),
    content: $("#contentScroll"),
    sidebar: $("#sidebar"),
    navPlaylists: $("#sidebarPlaylists"),
    navSongs: $("#navSongCount"),
    navFavs: $("#navFavCount"),
    globalSearch: $("#globalSearch"),
    modalLayer: $("#modalLayer"),
    modal: $("#modal"),
    contextMenu: $("#contextMenu"),
    toastStack: $("#toastStack"),
    importProgress: $("#importProgress"),
    importTitle: $("#importProgressTitle"),
    importDetail: $("#importProgressDetail"),
    fileInput: $("#fileInput"),
    folderInput: $("#folderInput"),
    audio: $("#audio"),
    ytOverlay: $("#ytOverlay"),
    ytPlayerHost: $("#ytPlayer"),
    nowPanel: $("#nowPanel"),
    nowArt: $("#nowArtwork"),
    nowReflection: $("#nowArtReflection"),
    nowInitials: $("#nowArtInitials"),
    nowTitle: $("#nowTitle"),
    nowArtist: $("#nowArtist"),
    nowAlbum: $("#nowAlbum"),
    nowFavorite: $("#nowFavorite"),
    miniArt: $("#miniArtwork"),
    miniInitials: $("#miniArtInitials"),
    playerTitle: $("#playerTitle"),
    playerArtist: $("#playerArtist"),
    playerFavorite: $("#playerFavorite"),
    playBtn: $("#playPauseBtn"),
    progress: $("#progressRange"),
    currentTime: $("#currentTime"),
    durationTime: $("#durationTime"),
    volume: $("#volumeRange"),
    muteBtn: $("#muteBtn"),
    shuffleBtn: $("#shuffleBtn"),
    repeatBtn: $("#repeatBtn"),
    queueList: $("#queueList"),
    queueSummary: $("#queueSummary"),
    visualizer: $("#visualizer"),
    visualizerIdle: $("#visualizerIdle"),
    storageBar: $("#storageBar"),
    storageDetail: $("#storageDetail"),
    storageLabel: $("#storageLabel"),
    onlineDot: $("#onlineDot"),
    offlinePill: $("#offlinePill"),
    dropOverlay: $("#dropOverlay"),
    themeToggle: $("#themeToggle"),
    historyBack: $("#historyBack"),
    historyForward: $("#historyForward"),
    eqBands: $("#eqBands"),
    eqPreset: $("#eqPreset")
  };

  const coverUrlCache = new Map();
  let currentAudioUrl = null;
  let playToken = 0;
  let artworkToken = 0;
  let sessionSaveTimer = 0;
  let searchTimer = 0;
  let confirmCallback = null;
  let lastFocused = null;
  let contextTrackId = null;
  let dragDepth = 0;
  let sleepTimeout = 0;
  let audioContext = null;
  let mediaSource = null;
  let analyser = null;
  let eqFilters = [];
  let visualizerFrame = 0;

  /* ---------- Small utilities ---------- */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "mparia");
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function formatTime(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function formatTotalDuration(seconds) {
    const mins = Math.round((Number(seconds) || 0) / 60);
    if (mins < 1) return "Less than a minute";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diff = start - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (diff === 0) return "Today";
    if (diff === 86400000) return "Yesterday";
    if (diff > 0 && diff < 7 * 86400000) return `${Math.round(diff / 86400000)} days ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }

  function plural(count, singular, pluralWord) {
    return `${count} ${count === 1 ? singular : (pluralWord || `${singular}s`)}`;
  }

  function currentTrack() {
    return state.currentTrackId ? state.tracksById.get(state.currentTrackId) || null : null;
  }

  function findTrack(id) {
    return state.tracksById.get(id) || null;
  }

  function initialsFor(text) {
    return String(text || "?")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "♪";
  }

  function coverPalette(seed) {
    const palette = COVER_PALETTES[hashString(seed) % COVER_PALETTES.length];
    return palette;
  }

  function coverStyle(seed) {
    const [a, b, c] = coverPalette(seed);
    return `--c1:${a};--c2:${b};--c3:${c};--cover-angle:${110 + (hashString(seed) % 100)}deg`;
  }

  function coverMarkup(track, extraClass = "") {
    if (!track) {
      return `<div class="cover ${extraClass}" style="${coverStyle("mparia")}"><span class="cover-initials">♪</span></div>`;
    }
    const seed = `${track.album || ""}|${track.title || track.fileName || ""}|${track.id || ""}`;
    const artAttr = track.hasArtwork ? ` data-cover-id="${escapeHtml(track.id)}"` : "";
    const remoteArt = track && track.artworkUrl ? ` data-artwork-url="${escapeHtml(track.artworkUrl)}"` : "";
    return `<div class="cover ${extraClass}" style="${coverStyle(seed)}"${artAttr}${remoteArt} aria-hidden="true">
      <span class="cover-initials">${escapeHtml(initialsFor(track.album || track.title))}</span>
      <span class="art-glyph">${icon("music")}</span>
    </div>`;
  }

  function albumKeyFor(track) {
    return `${normalizeKey(track.album || UNKNOWN_ALBUM)}::${normalizeKey(track.albumArtist || track.artist || UNKNOWN_ARTIST)}`;
  }

  function getAlbums(list = state.tracks) {
    const map = new Map();
    list.forEach((track) => {
      const key = track.albumKey || albumKeyFor(track);
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: track.album || UNKNOWN_ALBUM,
          artist: track.albumArtist || track.artist || UNKNOWN_ARTIST,
          tracks: [],
          coverTrack: track,
          year: track.year || ""
        });
      }
      const album = map.get(key);
      album.tracks.push(track);
      if (!album.coverTrack.hasArtwork && track.hasArtwork) album.coverTrack = track;
      if (!album.year && track.year) album.year = track.year;
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  function getArtists(list = state.tracks) {
    const map = new Map();
    list.forEach((track) => {
      const name = track.artist || UNKNOWN_ARTIST;
      if (!map.has(name)) map.set(name, { name, tracks: [], coverTrack: track });
      map.get(name).tracks.push(track);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function sortTracks(list, mode) {
    const tracks = list.slice();
    switch (mode) {
      case "title":
        return tracks.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      case "artist":
        return tracks.sort((a, b) => (a.artist || "").localeCompare(b.artist || "") || (a.title || "").localeCompare(b.title || ""));
      case "album":
        return tracks.sort((a, b) => (a.album || "").localeCompare(b.album || "") || (a.trackNumber || 0) - (b.trackNumber || 0));
      case "duration":
        return tracks.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      case "added-asc":
        return tracks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      default:
        return tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
  }

  function shuffleArray(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function setRangeFill(input, percent) {
    if (!input) return;
    input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent || 0))}%`);
  }

  function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* private mode */ }
  }

  function debounceSaveSession() {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(saveSession, 320);
  }

  function saveSession() {
    if (!window.MPAriaDB) return;
    const session = {
      currentTrackId: state.currentTrackId,
      queue: state.queue,
      baseQueue: state.baseQueue,
      queueIndex: state.queueIndex,
      queueLabel: state.queueLabel,
      shuffle: state.shuffle,
      repeat: state.repeat,
      volume: state.volume,
      muted: state.muted
    };
    window.MPAriaDB.setSetting("player", session);
  }

  function showToast(message, iconName = "sparkle", duration = 3200) {
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>`;
    el.toastStack.appendChild(node);
    setTimeout(() => {
      node.classList.add("is-out");
      setTimeout(() => node.remove(), 240);
    }, duration);
  }

  function setImportProgress(title, detail) {
    el.importTitle.textContent = title;
    el.importDetail.textContent = detail;
  }

  function showImportProgress() {
    el.importProgress.hidden = false;
  }

  function hideImportProgress() {
    el.importProgress.hidden = true;
  }

  function updateOnlineStatus() {
    const offline = !navigator.onLine;
    el.offlinePill.hidden = !offline;
    el.onlineDot.classList.toggle("is-offline", offline);
    el.storageLabel.textContent = offline ? "Offline — library ready" : "Stored on this Mac";
  }

  async function updateStorageUI() {
    const libraryBytes = state.tracks.reduce((sum, track) => sum + (Number(track.fileSize) || 0), 0);
    const quota = 25 * 1024 * 1024 * 1024;
    const percent = Math.min(100, (libraryBytes / quota) * 100);
    el.storageBar.style.width = `${percent}%`;
    el.storageDetail.textContent = `${state.tracks.length} songs · ${formatBytes(libraryBytes)} used`;
  }

  /* ---------- Artwork loading ---------- */

  async function getCoverUrl(id) {
    if (!id) return null;
    if (coverUrlCache.has(id)) return coverUrlCache.get(id);
    try {
      const blob = await window.MPAriaDB.getCover(id);
      if (!blob) {
        coverUrlCache.set(id, null);
        return null;
      }
      const url = URL.createObjectURL(blob);
      coverUrlCache.set(id, url);
      return url;
    } catch (_) {
      return null;
    }
  }
  async function setTrackCover(trackId, coverBlob) {
    const track = findTrack(trackId);
    if (!track || !coverBlob) return false;
    track.hasArtwork = true;
    track.artworkMime = coverBlob.type || "";
    const audioBlob = await window.MPAriaDB.getAudio(track.id);
    await window.MPAriaDB.putTrack(track, audioBlob, coverBlob);
    const cached = coverUrlCache.get(track.id);
    if (cached) URL.revokeObjectURL(cached);
    coverUrlCache.delete(track.id);
    return true;
  }

  function hydrateCovers(root = document) {
    $$("[data-cover-id], [data-artwork-url]", root).forEach(async (node) => {
      const remote = node.getAttribute("data-artwork-url");
      if (remote) {
        if (node.classList.contains("has-art")) return;
        node.style.backgroundImage = `url("${remote}")`;
        node.classList.add("has-art");
        return;
      }
      const id = node.getAttribute("data-cover-id");
      if (!id || node.classList.contains("has-art")) return;
      const url = await getCoverUrl(id);
      if (!url || !node.isConnected) return;
      node.style.backgroundImage = `url("${url}")`;
      node.classList.add("has-art");
    });
  }

  function revokeCachedCovers() {
    coverUrlCache.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    coverUrlCache.clear();
  }

  /* ---------- Reusable UI pieces ---------- */

  function albumCard(album) {
    return `<button class="album-card" data-action="open-album" data-key="${encodeURIComponent(album.key)}" title="Open ${escapeHtml(album.title)}">
      ${coverMarkup(album.coverTrack)}
      <span class="card-title">${escapeHtml(album.title)}</span>
      <span class="card-sub">${escapeHtml(album.artist)}${album.year ? ` · ${escapeHtml(album.year)}` : ""}</span>
    </button>`;
  }

  function artistCard(artist) {
    const [a, b] = coverPalette(artist.name);
    return `<button class="artist-card" data-action="open-artist" data-artist="${encodeURIComponent(artist.name)}">
      <span class="artist-avatar" style="--a1:${a};--a2:${b}">${escapeHtml(initialsFor(artist.name))}</span>
      <strong>${escapeHtml(artist.name)}</strong>
      <span>${plural(artist.tracks.length, "song")}</span>
    </button>`;
  }

  function playlistArt(playlist) {
    const tracks = playlist.trackIds.map(findTrack).filter(Boolean);
    if (!tracks.length) {
      const [a, b] = coverPalette(playlist.name);
      return `<div class="playlist-art"><div class="plain-art" style="--a1:${a};--a2:${b}">${icon("playlist")}</div></div>`;
    }
    return `<div class="playlist-art">${tracks.slice(0, 4).map((track) => coverMarkup(track)).join("")}</div>`;
  }

  function playlistCard(playlist) {
    const count = playlist.trackIds.filter((id) => state.tracksById.has(id)).length;
    return `<button class="playlist-card" data-action="open-playlist" data-id="${escapeHtml(playlist.id)}">
      ${playlistArt(playlist)}
      <strong>${escapeHtml(playlist.name)}</strong>
      <span>${plural(count, "song")}</span>
    </button>`;
  }

  function trackRow(track, index) {
    const isCurrent = state.currentTrackId === track.id;
    const isPlaying = isCurrent && state.isPlaying;
    return `<div class="track-row${isCurrent ? " is-current" : ""}${isPlaying ? " is-playing" : ""}" data-track-id="${escapeHtml(track.id)}" data-index="${index}" role="row" aria-label="${escapeHtml(track.title)} by ${escapeHtml(track.artist)}">
      <div class="track-num">
        <span class="num-text">${index + 1}</span>
        <button class="num-play" data-action="play-index" data-index="${index}" title="Play ${escapeHtml(track.title)}" aria-label="Play ${escapeHtml(track.title)}">${icon("play")}</button>
      </div>
      <div class="track-main">
        ${coverMarkup(track)}
        <div class="track-title-wrap">
          <span class="track-name" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</span>
          <span class="track-artist-mobile">${escapeHtml(track.artist)}</span>
        </div>
      </div>
      <div class="track-artist"><button data-action="open-artist" data-artist="${encodeURIComponent(track.artist || UNKNOWN_ARTIST)}">${escapeHtml(track.artist)}</button></div>
      <div class="track-album">${track.album && track.album !== UNKNOWN_ALBUM ? `<button data-action="open-album" data-key="${encodeURIComponent(track.albumKey || albumKeyFor(track))}">${escapeHtml(track.album)}</button>` : "—"}</div>
      <div class="track-added">${formatDate(track.addedAt)}</div>
      <div class="track-duration">${formatTime(track.duration)}</div>
      <div class="track-actions">
        <button class="icon-btn fav-row-btn${track.favorite ? " is-favorite" : ""}" data-action="toggle-favorite" data-id="${escapeHtml(track.id)}" data-fav-id="${escapeHtml(track.id)}" title="${track.favorite ? "Remove from favorites" : "Add to favorites"}" aria-label="${track.favorite ? "Remove from favorites" : "Add to favorites"}">${icon(track.favorite ? "heart-fill" : "heart")}</button>
        <button class="icon-btn" data-action="track-menu" data-id="${escapeHtml(track.id)}" title="More options" aria-label="More options for ${escapeHtml(track.title)}">${icon("more")}</button>
      </div>
    </div>`;
  }

  function trackTable(tracks, label, options = {}) {
    state.viewTracks = tracks.map((track) => track.id);
    state.viewLabel = label || "All songs";
    if (!tracks.length) {
      return `<div class="track-table"><div class="library-empty">${icon(options.icon || "music")}<p>${escapeHtml(options.empty || "Nothing here yet.")}</p></div></div>`;
    }
    return `<div class="track-table" role="table" aria-label="${escapeHtml(label)}">
      <div class="track-head" role="row">
        <span>#</span><span>Title</span><span>Artist</span><span>Album</span><span>Added</span><span>Time</span><span></span>
      </div>
      ${tracks.map(trackRow).join("")}
    </div>`;
  }

  function sectionHead(title, subtitle, linkLabel, action) {
    return `<div class="section-head">
      <div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>
      ${action ? `<button class="section-link" data-action="${action}">${escapeHtml(linkLabel || "See all")} ${icon("chevron-right")}</button>` : ""}
    </div>`;
  }

  function quickTiles(tracks) {
    if (!tracks.length) return "";
    return `<div class="quick-grid">${tracks.map((track) => `<button class="quick-tile" data-action="play-id" data-id="${escapeHtml(track.id)}">
      ${coverMarkup(track)}
      <span>${escapeHtml(track.title)}</span>
      <span class="play-hint">${icon("play")}</span>
    </button>`).join("")}</div>`;
  }

  function onboarding() {
    return `<section class="empty-state">
      <div class="empty-art">${icon("music")}</div>
      <h2>Your music. Your machine.</h2>
      <p>Add the songs you own and MPAria keeps them on this Mac. No account, no ads, no cloud — just your library, ready even when the internet isn't.</p>
      <div class="empty-actions">
        <button class="btn primary" data-action="import-files">${icon("plus")} Add music</button>
        <button class="btn" data-action="import-folder">${icon("folder")} Choose a folder</button>
        <button class="btn" data-action="add-starter">${icon("sparkle")} Try starter tracks</button>
        <button class="btn ghost" data-nav="discover">${icon("globe")} Browse free music</button>
      </div>
      <p class="empty-note">MP3, M4A, FLAC, WAV, OGG and more · Files stay in your browser's private local storage.<br>MPAria does not bundle or download copyrighted music.</p>
    </section>`;
  }

  function emptyLibrary(title, message, actionLabel, action) {
    return `<section class="empty-state">
      <div class="empty-art">${icon("sparkle")}</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="empty-actions"><button class="btn primary" data-action="${action || "import-files"}">${escapeHtml(actionLabel || "Add music")}</button></div>
    </section>`;
  }

  /* ---------- Views ---------- */

  function renderHome() {
    if (!state.tracks.length) return onboarding();

    const recent = sortTracks(state.tracks, "added-desc");
    const albums = getAlbums(state.tracks).sort((a, b) => {
      const at = Math.max(...a.tracks.map((t) => t.addedAt || 0));
      const bt = Math.max(...b.tracks.map((t) => t.addedAt || 0));
      return bt - at;
    }).slice(0, 8);
    const played = recent.filter((track) => track.lastPlayedAt).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, 5);
    const quick = (played.length ? played : recent.slice(0, 5)).slice(0, 5);
    const top = state.tracks.filter((track) => track.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 5);
    const totalSeconds = state.tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
    const coverSet = recent.slice(0, 3).map((track) => coverMarkup(track)).join("");

    return `<div class="home-hero">
      <div class="hero-copy">
        <span class="eyebrow">Listen Now</span>
        <h1>Music that stays <span>with you.</span></h1>
        <p>${plural(state.tracks.length, "song")} in your collection. Nothing here depends on a connection — every track lives on this Mac.</p>
        <div class="hero-actions">
          <button class="btn primary" data-action="play-library">${icon("play")} Play library</button>
          <button class="btn" data-action="shuffle-library">${icon("shuffle")} Shuffle everything</button>
          <button class="btn ghost" data-action="import-files">${icon("plus")} Add music</button>
        </div>
        <div class="hero-stats">
          <span><strong>${state.tracks.length}</strong>Songs</span>
          <span><strong>${getAlbums(state.tracks).length}</strong>Albums</span>
          <span><strong>${formatTotalDuration(totalSeconds)}</strong>Listening</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-disc"></div>
        <div class="hero-cover-set">${coverSet}</div>
      </div>
    </div>

    ${quick.length ? `<section class="section-block">
      ${sectionHead("Jump back in", "Picked up where you left off", "Shuffle", "shuffle-library")}
      ${quickTiles(quick)}
    </section>` : ""}

    ${albums.length ? `<section class="section-block">
      ${sectionHead("Recently added", "New arrivals in your collection", "All albums", "nav-albums")}
      <div class="card-row">${albums.map(albumCard).join("")}</div>
    </section>` : ""}

    ${top.length ? `<section class="section-block">
      ${sectionHead("On repeat", "Your most-played tracks", "All songs", "nav-songs")}
      ${trackTable(top, "On repeat")}
    </section>` : ""}

    ${state.playlists.length ? `<section class="section-block">
      ${sectionHead("Your playlists", "Made by you, stored locally", "New playlist", "new-playlist")}
      <div class="playlist-grid">${state.playlists.slice(0, 5).map(playlistCard).join("")}</div>
    </section>` : ""}`;
  }

  function renderSongs() {
    if (!state.tracks.length) return emptyLibrary('No songs yet', 'Import audio files to build your library.', 'Add music');
    const tracks = sortTracks(state.tracks, state.sort);
    const seconds = state.tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
    return `<div class="page-head">
      <div>
        <span class="eyebrow">Library</span>
        <h1>Songs</h1>
        <p class="page-sub">${plural(tracks.length, "song")} · ${formatTotalDuration(seconds)}</p>
      </div>
      <div class="page-actions">
        <select class="mini-select" id="songSort" aria-label="Sort songs">
          <option value="added-desc"${state.sort === "added-desc" ? " selected" : ""}>Recently added</option>
          <option value="title"${state.sort === "title" ? " selected" : ""}>Title</option>
          <option value="artist"${state.sort === "artist" ? " selected" : ""}>Artist</option>
          <option value="album"${state.sort === "album" ? " selected" : ""}>Album</option>
          <option value="duration"${state.sort === "duration" ? " selected" : ""}>Duration</option>
        </select>
        <button class="btn" data-action="play-view">${icon("play")} Play all</button>
        <button class="btn primary" data-action="shuffle-view">${icon("shuffle")} Shuffle</button>
      </div>
    </div>
    ${trackTable(tracks, "All songs")}`;
  }

  function renderFavorites() {
    const favorites = sortTracks(state.tracks.filter((track) => track.favorite), "added-desc");
    if (!favorites.length) {
      return `<div class="page-head"><div><span class="eyebrow">Collection</span><h1>Favorites</h1><p class="page-sub">The tracks you keep coming back to.</p></div></div>
      ${emptyLibrary("No favorites yet", "Tap the heart next to any song and it will appear here, ready offline.", "Browse songs", "nav-songs")}`;
    }
    return `<div class="page-head">
      <div><span class="eyebrow">Collection</span><h1>Favorites</h1><p class="page-sub">${plural(favorites.length, "song")} you love</p></div>
      <div class="page-actions">
        <button class="btn" data-action="play-view">${icon("play")} Play all</button>
        <button class="btn primary" data-action="shuffle-view">${icon("shuffle")} Shuffle</button>
      </div>
    </div>
    ${trackTable(favorites, "Favorites", { icon: "heart" })}`;
  }

  function renderAlbums() {
    if (!state.tracks.length) return emptyLibrary('No albums yet', 'Albums appear from imported music metadata.', 'Add music');
    const albums = getAlbums(state.tracks);
    return `<div class="page-head">
      <div><span class="eyebrow">Collection</span><h1>Albums</h1><p class="page-sub">${plural(albums.length, "album")} in your library</p></div>
      <div class="page-actions"><button class="btn" data-action="import-files">${icon("plus")} Add music</button></div>
    </div>
    <div class="album-grid">${albums.map(albumCard).join("")}</div>`;
  }

  function renderArtists() {
    if (!state.tracks.length) return emptyLibrary('No artists yet', 'Artists are grouped from imported tracks.', 'Add music');
    const artists = getArtists(state.tracks);
    return `<div class="page-head">
      <div><span class="eyebrow">Collection</span><h1>Artists</h1><p class="page-sub">${plural(artists.length, "artist")}</p></div>
    </div>
    <div class="artist-grid">${artists.map(artistCard).join("")}</div>`;
  }

  function renderPlaylists() {
    return `<div class="page-head">
      <div><span class="eyebrow">Collection</span><h1>Playlists</h1><p class="page-sub">${plural(state.playlists.length, "playlist")} · private to this library</p></div>
      <div class="page-actions"><button class="btn" data-action="import-playlist">${icon("download")} Import playlist</button><button class="btn primary" data-action="new-playlist">${icon("plus")} New playlist</button></div>
    </div>
    ${state.playlists.length ? `<div class="playlist-grid">${state.playlists.map(playlistCard).join("")}<button class="new-playlist-card" data-action="new-playlist"><span class="plus-ring">${icon("plus")}</span><span>New playlist</span></button></div>` : `<section class="empty-state">
      <div class="empty-art">${icon("playlist")}</div>
      <h2>Make a playlist</h2>
      <p>Group songs for a drive, a workout, or a rainy afternoon. Playlists are stored locally with your library.</p>
      <div class="empty-actions"><button class="btn primary" data-action="new-playlist">${icon("plus")} Create playlist</button></div>
    </section>`}`;
  }

  function renderPlaylistDetail(id) {
    const playlist = state.playlistsById.get(id);
    if (!playlist) return emptyLibrary("Playlist not found", "It may have been deleted.", "Back to playlists", "nav-playlists");
    const tracks = playlist.trackIds.map(findTrack).filter(Boolean);
    const first = tracks[0];
    const seconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
    return `<button class="back-btn" data-nav="playlists">${icon("chevron-left")} Playlists</button>
    <div class="detail-hero">
      ${first ? coverMarkup(first) : `<div class="cover" style="${coverStyle(playlist.name)}"><span class="cover-initials">${escapeHtml(initialsFor(playlist.name))}</span><span class="art-glyph">${icon("playlist")}</span></div>`}
      <div class="detail-copy">
        <span class="eyebrow">Playlist</span>
        <h1>${escapeHtml(playlist.name)}</h1>
        <div class="detail-meta"><span>${plural(tracks.length, "song")}</span><span class="dot"></span><span>${formatTotalDuration(seconds)}</span><span class="dot"></span><span>Made locally</span></div>
        <div class="detail-actions">
          ${tracks.length ? `<button class="btn primary" data-action="play-view">${icon("play")} Play</button>
          <button class="btn" data-action="shuffle-view">${icon("shuffle")} Shuffle</button>` : ""}
          <button class="btn ghost" data-action="export-playlist" data-id="${escapeHtml(playlist.id)}">${icon("download")} Export</button>
          <button class="btn ghost" data-action="rename-playlist" data-id="${escapeHtml(playlist.id)}">${icon("settings")} Rename</button>
          <button class="btn ghost" data-action="delete-playlist" data-id="${escapeHtml(playlist.id)}">${icon("trash")} Delete</button>
        </div>
      </div>
    </div>
    ${tracks.length ? trackTable(tracks, playlist.name) : `<div class="track-table"><div class="library-empty">${icon("playlist")}<p>This playlist is empty. Use the ··· menu on any song to add it here.</p><button class="btn" data-nav="songs">Browse songs</button></div></div>`}`;
  }

  function renderAlbumDetail(key) {
    const album = getAlbums(state.tracks).find((item) => item.key === key);
    if (!album) return emptyLibrary("Album not found", "It may have been removed from your library.", "Back to albums", "nav-albums");
    const tracks = album.tracks.slice().sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0) || (a.title || "").localeCompare(b.title || ""));
    const seconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
    return `<button class="back-btn" data-nav="albums">${icon("chevron-left")} Albums</button>
    <div class="detail-hero">
      ${coverMarkup(album.coverTrack)}
      <div class="detail-copy">
        <span class="eyebrow">Album</span>
        <h1>${escapeHtml(album.title)}</h1>
        <div class="detail-meta">
          <button class="text-btn" style="font-size:10.5px;color:var(--text-soft)" data-action="open-artist" data-artist="${encodeURIComponent(album.artist)}">${escapeHtml(album.artist)}</button>
          ${album.year ? `<span class="dot"></span><span>${escapeHtml(album.year)}</span>` : ""}
          <span class="dot"></span><span>${plural(tracks.length, "song")}</span><span class="dot"></span><span>${formatTotalDuration(seconds)}</span>
        </div>
        <div class="detail-actions">
          <button class="btn primary" data-action="play-view">${icon("play")} Play</button>
          <button class="btn" data-action="shuffle-view">${icon("shuffle")} Shuffle</button>
        </div>
      </div>
    </div>
    ${trackTable(tracks, album.title)}`;
  }

  function renderArtistDetail(name) {
    const artist = getArtists(state.tracks).find((item) => item.name === name);
    if (!artist) return emptyLibrary("Artist not found", "There are no tracks by this artist in your library.", "Back to artists", "nav-artists");
    const tracks = sortTracks(artist.tracks, "album");
    const albums = getAlbums(artist.tracks);
    const [a, b] = coverPalette(name);
    return `<button class="back-btn" data-nav="artists">${icon("chevron-left")} Artists</button>
    <div class="detail-hero">
      <div class="artist-avatar" style="--a1:${a};--a2:${b}">${escapeHtml(initialsFor(name))}</div>
      <div class="detail-copy">
        <span class="eyebrow">Artist</span>
        <h1>${escapeHtml(name)}</h1>
        <div class="detail-meta"><span>${plural(tracks.length, "song")}</span><span class="dot"></span><span>${plural(albums.length, "album")}</span></div>
        <div class="detail-actions">
          <button class="btn primary" data-action="play-view">${icon("play")} Play</button>
          <button class="btn" data-action="shuffle-view">${icon("shuffle")} Shuffle</button>
        </div>
      </div>
    </div>
    ${albums.length > 1 ? `<section class="section-block">${sectionHead("Albums", "", "", "")}<div class="card-row">${albums.map(albumCard).join("")}</div></section>` : ""}
    ${trackTable(tracks, name)}`;
  }

  function renderSearch() {
    const query = state.searchQuery.trim();
    if (!query) {
      return `<div class="page-head"><div><span class="eyebrow">Search</span><h1>Find anything</h1><p class="page-sub">Search your songs, albums, artists and genres.</p></div></div>`;
    }
    const q = normalizeKey(query);
    const matchedTracks = state.tracks.filter((track) =>
      [track.title, track.artist, track.album, track.genre, track.fileName].some((value) => normalizeKey(value).includes(q))
    );
    const albums = getAlbums(state.tracks).filter((album) =>
      normalizeKey(album.title).includes(q) || normalizeKey(album.artist).includes(q)
    );
    const artists = getArtists(state.tracks).filter((artist) => normalizeKey(artist.name).includes(q));
    const total = matchedTracks.length + albums.length + artists.length;

    if (!total) {
      return `<div class="page-head"><div><span class="eyebrow">Search</span><h1>“${escapeHtml(query)}”</h1><p class="page-sub">No matches in your library.</p></div></div>
      ${emptyLibrary("Nothing found", "Try a different title, artist, album or genre. Only music stored in MPAria is searched.", "Back to songs", "nav-songs")}`;
    }

    let html = `<div class="page-head"><div><span class="eyebrow">Search results</span><h1>“${escapeHtml(query)}”</h1><p class="page-sub">${plural(total, "result")} across your library</p></div></div>`;

    if (artists.length) {
      html += `<section class="section-block">${sectionHead("Artists", `${artists.length} matched`)}<div class="artist-grid">${artists.slice(0, 6).map(artistCard).join("")}</div></section>`;
    }
    if (albums.length) {
      html += `<section class="section-block">${sectionHead("Albums", `${albums.length} matched`)}<div class="card-row">${albums.slice(0, 8).map(albumCard).join("")}</div></section>`;
    }
    if (matchedTracks.length) {
      html += `<section class="section-block">${sectionHead("Songs", `${matchedTracks.length} matched`)}${trackTable(matchedTracks, `Search: ${query}`)}</section>`;
    } else {
      state.viewTracks = [];
      state.viewLabel = "Search";
    }
    return html;
  }

  function renderDiscover() {
    const sources = [
      { name: "Internet Archive", icon: "globe", text: "Millions of public-domain and Creative Commons recordings, from live concerts to vintage radio.", url: "https://archive.org/details/audio" },
      { name: "Free Music Archive", icon: "music", text: "Curated, legal downloads across independent genres. Check each track's license before redistributing.", url: "https://freemusicarchive.org" },
      { name: "Jamendo", icon: "disc", text: "Independent artists offering free and licensed music for personal listening.", url: "https://www.jamendo.com" },
      { name: "Library of Congress", icon: "mic", text: "Historic sound recordings and public-domain performances from the national archive.", url: "https://www.loc.gov/collections/?fa=original-format:audio" }
    ];
    return `<div class="discover-hero">
      <span class="eyebrow">Browse</span>
      <h1>Good music, on the level.</h1>
      <p>MPAria cannot bundle popular commercial tracks — those recordings are copyrighted. What it can do is play the music you already own and help you discover free, legal sources. Download a file in your browser, then import it here and it becomes part of your offline library.</p>
      <div class="hero-actions" style="margin-top:18px">
        <button class="btn primary" data-action="import-url">${icon("download")} Import from URL</button>
        <button class="btn" data-action="import-files">${icon("plus")} Import a file</button>
      </div>
    </div>
    <section class="section-block">
      ${sectionHead("Legal places to find music", "Open a source, download what you love, then bring it back")}
      <div class="source-grid">${sources.map((source) => `<div class="source-card">
        <span class="source-icon">${icon(source.icon)}</span>
        <strong>${escapeHtml(source.name)}</strong>
        <p>${escapeHtml(source.text)}</p>
        <a href="${source.url}" target="_blank" rel="noopener noreferrer">Browse ${icon("chevron-right")}</a>
      </div>`).join("")}</div>
    </section>
    <div class="legal-note">${icon("sparkle")}<span><strong>Why no chart hits?</strong> Distributing copyrighted music without a license is illegal. MPAria is a player for your own collection — not a music downloader. Always check the license on any free track before you keep or share it.</span></div>`;
  }

  function renderView() {
    let html = "";
    // Views that render a track table set these again; reset first so an empty
    // view can never play a stale queue from the previous screen.
    state.viewTracks = [];
    state.viewLabel = "All songs";
    switch (state.view.type) {
      case "songs": html = renderSongs(); break;
      case "favorites": html = renderFavorites(); break;
      case "albums": html = renderAlbums(); break;
      case "artists": html = renderArtists(); break;
      case "playlists": html = renderPlaylists(); break;
      case "playlist": html = renderPlaylistDetail(state.view.id); break;
      case "album": html = renderAlbumDetail(state.view.key); break;
      case "artist": html = renderArtistDetail(state.view.name); break;
      case "search": html = renderSearch(); break;
      case "discover": html = renderDiscover(); break;
      default: html = renderHome();
    }
    return html;
  }

  function renderSidebar() {
    el.navSongs.textContent = state.tracks.length ? String(state.tracks.length) : "";
    el.navFavs.textContent = state.tracks.filter((track) => track.favorite).length || "";
    const navMap = {
      home: "home",
      songs: "songs",
      favorites: "favorites",
      albums: "albums",
      artist: "artists",
      artists: "artists",
      playlists: "playlists",
      playlist: "playlists",
      discover: "discover"
    };
    $$(".nav-item", el.sidebar).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.nav === navMap[state.view.type]);
    });
    if (!state.playlists.length) {
      el.navPlaylists.innerHTML = `<button class="playlist-mini" data-action="new-playlist"><span class="mini-cover" style="background:var(--hover);display:grid;place-items:center">${icon("plus")}</span><span>New playlist</span></button>`;
    } else {
      el.navPlaylists.innerHTML = state.playlists.map((playlist) => {
        const first = playlist.trackIds.map(findTrack).filter(Boolean)[0] || null;
        return `<button class="playlist-mini${state.view.type === "playlist" && state.view.id === playlist.id ? " is-active" : ""}" data-action="open-playlist" data-id="${escapeHtml(playlist.id)}">
          ${coverMarkup(first, "mini-cover")}
          <span>${escapeHtml(playlist.name)}</span>
        </button>`;
      }).join("");
    }
  }

  function updatePlayingRows() {
    $$(".track-row").forEach((row) => {
      const isCurrent = row.dataset.trackId === state.currentTrackId;
      row.classList.toggle("is-current", isCurrent);
      row.classList.toggle("is-playing", isCurrent && state.isPlaying);
    });
  }

  function render() {
    const renderKey = JSON.stringify(state.view) + "|" + state.searchQuery;
    const changed = renderKey !== state.lastRenderKey;
    el.root.innerHTML = renderView();
    if (changed) {
      el.content.scrollTop = 0;
      state.lastRenderKey = renderKey;
    }
    hydrateCovers(el.root);
    renderSidebar();
    hydrateCovers(el.sidebar);
    updatePlayingRows();
  }

  /* ---------- Navigation ---------- */

  function updateHistoryUI() {
    if (el.historyBack) el.historyBack.disabled = state.historyIndex <= 0;
    if (el.historyForward) el.historyForward.disabled = state.historyIndex >= state.history.length - 1;
  }

  function applyView(view) {
    state.view = { ...view };
    if (view.type === "search") {
      state.searchQuery = view.query || "";
      el.globalSearch.value = state.searchQuery;
    } else {
      state.searchQuery = "";
      el.globalSearch.value = "";
    }
    document.body.classList.remove("nav-open");
    render();
    updateHistoryUI();
    el.content.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(type, extra = {}) {
    const next = { type, ...extra };
    if (JSON.stringify(next) !== JSON.stringify(state.view)) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(next);
      if (state.history.length > 60) {
        state.history.shift();
      } else {
        state.historyIndex++;
      }
      state.historyIndex = state.history.length - 1;
    }
    applyView(next);
  }

  function goHistory(delta) {
    const nextIndex = state.historyIndex + delta;
    if (nextIndex < 0 || nextIndex >= state.history.length) return;
    state.historyIndex = nextIndex;
    applyView(state.history[nextIndex]);
  }

  function updateSearchView(query) {
    if (!query) {
      if (state.view.type === "search") clearSearchView();
      return;
    }
    if (state.view.type === "search") {
      // Keep one history entry while the user types, so Back does not
      // walk through every intermediate query.
      const entry = { type: "search", query };
      state.history[state.historyIndex] = entry;
      applyView(entry);
      return;
    }
    state.lastNonSearchView = state.view;
    navigate("search", { query });
  }

  function clearSearchView() {
    if (state.view.type !== "search") return;
    const fallback = state.lastNonSearchView || { type: "home" };
    const previous = state.history[state.historyIndex - 1];
    if (previous && JSON.stringify(previous) === JSON.stringify(fallback)) {
      // Clearing the field should land exactly where search started,
      // not create a duplicate entry that makes Back look broken.
      state.history.splice(state.historyIndex, 1);
      state.historyIndex = Math.max(0, state.historyIndex - 1);
    } else {
      state.history[state.historyIndex] = { ...fallback };
    }
    applyView(fallback);
  }

  /* ---------- Player UI ---------- */

  let artworkTrackId = null;

  function updatePlayIcons() {
    const name = state.isPlaying ? "pause" : "play";
    $$("[data-play-icon]").forEach((node) => {
      node.innerHTML = `<use href="#i-${name}"/>`;
    });
    el.playBtn.setAttribute("aria-label", state.isPlaying ? "Pause" : "Play");
    el.playBtn.title = state.isPlaying ? "Pause (Space)" : "Play (Space)";
  }

  function updateVolumeUI() {
    const value = state.muted ? 0 : state.volume;
    if (el.volume) {
      el.volume.value = String(value);
      setRangeFill(el.volume, value * 100);
    }
    el.muteBtn.innerHTML = icon(value === 0 ? "volume-mute" : "volume");
    el.muteBtn.setAttribute("aria-label", value === 0 ? "Unmute" : "Mute");
    el.muteBtn.title = value === 0 ? "Unmute (M)" : "Mute (M)";
  }

  function updateShuffleUI() {
    el.shuffleBtn.classList.toggle("is-active", state.shuffle);
    el.shuffleBtn.setAttribute("aria-label", state.shuffle ? "Shuffle on" : "Shuffle off");
    el.repeatBtn.classList.toggle("is-active", state.repeat !== "off");
    const repeatIcon = state.repeat === "one" ? "repeat-one" : "repeat";
    el.repeatBtn.innerHTML = icon(repeatIcon);
    el.repeatBtn.setAttribute("aria-label", `Repeat ${state.repeat}`);
    el.repeatBtn.title = `Repeat: ${state.repeat} (R)`;
  }

  function updateFavoriteButtons(track = currentTrack()) {
    const enabled = Boolean(track);
    const favorite = Boolean(track && track.favorite);
    [el.nowFavorite, el.playerFavorite].forEach((button) => {
      button.disabled = !enabled;
      button.classList.toggle("is-favorite", favorite);
      button.innerHTML = icon(favorite ? "heart-fill" : "heart");
      button.setAttribute("aria-label", favorite ? "Remove current song from favorites" : "Favorite current song");
    });
    $$("[data-fav-id]").forEach((button) => {
      const item = findTrack(button.dataset.favId);
      if (!item) return;
      button.classList.toggle("is-favorite", item.favorite);
      button.innerHTML = icon(item.favorite ? "heart-fill" : "heart");
      button.title = item.favorite ? "Remove from favorites" : "Add to favorites";
    });
  }

  async function updateArtwork(force = false) {
    const track = currentTrack();
    if (!force && artworkTrackId === (track ? track.id : "__none__")) return;
    artworkTrackId = track ? track.id : "__none__";
    const token = ++artworkToken;

    el.nowArt.className = "now-art placeholder-art";
    el.nowArt.style.backgroundImage = "";
    el.miniArt.className = "mini-art placeholder-art";
    el.miniArt.style.backgroundImage = "";
    el.nowInitials.textContent = "";
    el.miniInitials.textContent = "";
    el.nowArt.dataset.empty = track ? "false" : "true";

    if (!track) {
      el.nowTitle.textContent = "Nothing playing";
      el.nowArtist.textContent = "Add a song or choose one from your library";
      el.nowAlbum.textContent = "";
      updateMediaSession(null);
      return;
    }

    el.nowInitials.textContent = initialsFor(track.album || track.title);
    el.miniInitials.textContent = initialsFor(track.album || track.title);
    const [, , glow] = coverPalette(`${track.album}|${track.title}`);
    el.nowReflection.style.background = glow;

    if (!track.hasArtwork) {
      updateMediaSession();
      return;
    }

    const url = await getCoverUrl(track.id);
    if (!url || token !== artworkToken || state.currentTrackId !== track.id) {
      updateMediaSession();
      return;
    }
    el.nowArt.classList.add("has-art");
    el.nowArt.style.backgroundImage = `url("${url}")`;
    el.miniArt.classList.add("has-art");
    el.miniArt.style.backgroundImage = `url("${url}")`;
    updateMediaSession(url);
  }

  function updatePlayerUI() {
    const track = currentTrack();
    const title = track ? track.title : "Choose a song";
    const artist = track ? track.artist : "Your library, offline";
    el.playerTitle.textContent = title;
    el.playerArtist.textContent = track ? `${track.artist}${track.album && track.album !== UNKNOWN_ALBUM ? ` · ${track.album}` : ""}` : artist;
    el.nowTitle.textContent = track ? track.title : "Nothing playing";
    el.nowArtist.textContent = track ? track.artist : "Add a song or choose one from your library";
    el.nowAlbum.textContent = track && track.album && track.album !== UNKNOWN_ALBUM ? track.album : "";
    el.playerTitle.title = title;
    document.title = track ? `${track.title} · ${track.artist} — MPAria` : "MPAria — Offline Music Player";
    updatePlayIcons();
    updateFavoriteButtons(track);
    updateShuffleUI();
    updateVolumeUI();
    const speedBtn = document.getElementById("speedBtn");
    if (speedBtn) speedBtn.textContent = `${state.playbackRate || 1}x`;
    updateArtwork();
    updateProgressUI();
    updatePlayingRows();
    updateQueueUI();
    if ("mediaSession" in navigator && "playbackState" in navigator.mediaSession) {
      try {
        navigator.mediaSession.playbackState = track ? (state.isPlaying ? "playing" : "paused") : "none";
      } catch (_) { /* not supported */ }
    }
  }

  function updateProgressUI() {
    const track = currentTrack();
      const video = el.ytPlayerHost ? el.ytPlayerHost.querySelector("video") : null;
      const media = video || el.audio;
      const duration = Number.isFinite(media.duration) && media.duration > 0
        ? media.duration
        : (track && track.duration ? track.duration : 0);
      const current = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    el.currentTime.textContent = formatTime(current);
    el.durationTime.textContent = formatTime(duration);
    el.progress.max = String(duration || 100);
    el.progress.value = String(Math.min(current, duration || 100));
    setRangeFill(el.progress, duration ? (current / duration) * 100 : 0);
  }

  function updateQueueUI() {
    const tracks = state.queue.map(findTrack).filter(Boolean);
    el.queueSummary.textContent = tracks.length
      ? `${tracks.length} ${state.queueLabel ? `· ${state.queueLabel}` : "in queue"}`
      : "Queue is empty";
    if (!tracks.length) {
      el.queueList.innerHTML = `<div class="panel-empty">${icon("queue")}<p>Play a song to start a queue.</p></div>`;
      return;
    }
    el.queueList.innerHTML = state.queue.map((id, index) => {
      const track = findTrack(id);
      if (!track) return "";
      const active = index === state.queueIndex;
      return `<div class="queue-item${active ? " is-current" : ""}" data-action="play-queue" data-index="${index}" role="button" tabindex="0" aria-label="Play ${escapeHtml(track.title)}">
        ${coverMarkup(track)}
        <div class="queue-item-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></div>
        <button class="queue-remove" data-action="remove-queue" data-index="${index}" title="Remove from queue" aria-label="Remove ${escapeHtml(track.title)} from queue">${icon("close")}</button>
      </div>`;
    }).join("");
    hydrateCovers(el.queueList);
  }

  function updateNowTab() {
    $$(".now-tab").forEach((tab) => {
      const active = tab.dataset.nowTab === state.nowTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $("#queuePanel").hidden = state.nowTab !== "queue";
    $("#eqPanel").hidden = state.nowTab !== "eq";
  }

  function updateMediaSession(artUrl) {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    const track = currentTrack();
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artwork = artUrl ? [{ src: artUrl, sizes: "512x512", type: track.artworkMime || "image/jpeg" }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album && track.album !== UNKNOWN_ALBUM ? track.album : "",
      artwork
    });
  }

  /* ---------- Audio graph & visualizer ---------- */

  function ensureAudioGraph() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      audioContext = new AudioCtx();
      const filters = EQ_FREQUENCIES.map((frequency, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = frequency;
        filter.Q.value = 1.05;
        filter.gain.value = Number(state.eq[frequency] || 0);
        if (index === 0) filter.type = "lowshelf";
        if (index === EQ_FREQUENCIES.length - 1) filter.type = "highshelf";
        return filter;
      });
      const nextAnalyser = audioContext.createAnalyser();
      nextAnalyser.fftSize = 128;
      nextAnalyser.smoothingTimeConstant = 0.76;

      // Create the media source only after the rest of the graph exists, so a
      // failure here cannot leave the audio element routed into silence.
      mediaSource = audioContext.createMediaElementSource(el.audio);
      mediaSource.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
      filters[filters.length - 1].connect(nextAnalyser);
      nextAnalyser.connect(audioContext.destination);
      eqFilters = filters;
      analyser = nextAnalyser;
      return true;
    } catch (error) {
      console.warn("MPAria: audio graph unavailable", error);
      audioContext = null;
      analyser = null;
      eqFilters = [];
      return false;
    }
  }

  function applyEq() {
    eqFilters.forEach((filter, index) => {
      filter.gain.value = Number(state.eq[EQ_FREQUENCIES[index]] || 0);
    });
  }

  function startVisualizer() {
    if (!analyser || visualizerFrame) return;
    el.visualizerIdle.hidden = true;
    const context = el.visualizer.getContext("2d");
    if (!context) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || "#ff7a59";

    const draw = () => {
      visualizerFrame = requestAnimationFrame(draw);
      const rect = el.visualizer.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      if (el.visualizer.width !== Math.floor(rect.width * dpr) || el.visualizer.height !== Math.floor(rect.height * dpr)) {
        el.visualizer.width = Math.floor(rect.width * dpr);
        el.visualizer.height = Math.floor(rect.height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      analyser.getByteFrequencyData(data);
      const bars = 34;
      const gap = 2.5;
      const barWidth = Math.max(1, (rect.width - gap * (bars - 1)) / bars);
      const gradient = context.createLinearGradient(0, 0, rect.width, 0);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, styles.getPropertyValue("--violet").trim() || "#9a8cff");
      context.fillStyle = gradient;
      context.globalAlpha = 0.82;
      for (let i = 0; i < bars; i++) {
        const index = Math.floor((i / bars) * (data.length * 0.76));
        const value = data[index] / 255;
        const height = 3 + value * (rect.height - 5);
        const x = i * (barWidth + gap);
        const y = (rect.height - height) / 2;
        const radius = Math.min(barWidth / 2, 2);
        context.beginPath();
        if (typeof context.roundRect === "function") {
          context.roundRect(x, y, barWidth, height, radius);
        } else {
          context.rect(x, y, barWidth, height);
        }
        context.fill();
      }
      context.globalAlpha = 1;
    };
    draw();
  }

  function stopVisualizer() {
    if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
    visualizerFrame = 0;
    el.visualizerIdle.hidden = false;
    const context = el.visualizer.getContext("2d");
    if (context) context.clearRect(0, 0, el.visualizer.width, el.visualizer.height);
  }

  /* ---------- Playback ---------- */

  async function recordPlay(track) {
    if (!track) return;
    track.playCount = (track.playCount || 0) + 1;
    track.lastPlayedAt = Date.now();
    try {
      await window.MPAriaDB.updateTrack(track);
    } catch (_) { /* play count is non-critical */ }
  }

  async function playTrack(id, options = {}) {
    const track = findTrack(id);
    if (track && track.source === "youtube" && track.youtubeUrl) {
      playYouTubeTrack(track);
      return;
    }
    if (ytPlayer) { try { ytPlayer.stopVideo(); } catch (_) {} stopYtTimeUpdates(); if (el.ytOverlay) el.ytOverlay.hidden = true; }
    if (track.source === "youtube" && track.youtubeUrl) {
      playYouTubeTrack(track);
      return;
    }

    if (state.currentTrackId === id && currentAudioUrl && !options.force) {
      if (el.audio.paused) {
        try { await el.audio.play(); } catch (_) { showToast("Could not start playback.", "volume-mute"); }
      } else {
        el.audio.pause();
      }
      return;
    }

    const token = ++playToken;
    state.currentTrackId = id;
    state.isPlaying = false;
    try { el.audio.pause(); } catch (_) { /* already paused */ }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    el.audio.removeAttribute("src");
    el.playBtn.classList.add("is-loading");
    updatePlayerUI();

    // Create or resume the Web Audio graph while we still have the user's
    // gesture. Safari can leave a context suspended if it is created later.
    ensureAudioGraph();

    try {
      const blob = await window.MPAriaDB.getAudio(id);
      if (token !== playToken) return;
      if (!blob) throw new Error("Audio data is missing for this track.");
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = URL.createObjectURL(blob);
      const ext = String(track.fileName || "").split(".").pop().toLowerCase();
      if (VIDEO_EXTENSIONS.includes(ext) || String(track.mime || "").startsWith("video/")) {
        if (el.ytOverlay) el.ytOverlay.hidden = false;
        if (el.ytPlayerHost) el.ytPlayerHost.innerHTML = `<video src="${currentAudioUrl}" autoplay controls playsinline style="width:100%;height:100%;background:#000;"></video>`;
        const video = el.ytPlayerHost ? el.ytPlayerHost.querySelector("video") : null;
        if (video) {
          video.volume = state.muted ? 0 : state.volume;
          video.play().catch(() => showToast("Could not start playback.", "volume-mute"));
          video.onended = () => { state.isPlaying = false; updatePlayerUI(); nextTrack(true); };
        }
        if (token !== playToken) return;
        state.isPlaying = true;
        recordPlay(track);
        saveSession();
        updatePlayerUI();
        if (token === playToken) el.playBtn.classList.remove("is-loading");
        return;
      }
      el.audio.src = currentAudioUrl;
      el.audio.volume = state.muted ? 0 : state.volume;
      el.audio.playbackRate = state.playbackRate || 1;
      el.audio.load();
      ensureAudioGraph();
      await el.audio.play();
      if (token !== playToken) return;
      state.isPlaying = true;
      recordPlay(track);
      saveSession();
      updatePlayerUI();
      startVisualizer();
    } catch (error) {
      if (token !== playToken) return;
      state.isPlaying = false;
      updatePlayerUI();
      const message = error && error.name === "NotAllowedError"
        ? "Press play to start the audio."
        : "Could not play this file. The browser may not support its format.";
      showToast(message, "volume-mute");
    } finally {
      if (token === playToken) el.playBtn.classList.remove("is-loading");
    }
  }

  function startQueue(ids, startIndex, label, options = {}) {
    const clean = ids.filter((id) => state.tracksById.has(id));
    if (!clean.length) return;
    const index = Math.max(0, Math.min(Number(startIndex) || 0, clean.length - 1));
    const currentId = clean[index];
    state.baseQueue = clean.slice();
    state.queueLabel = label || "Queue";
    if (state.shuffle || options.shuffle) {
      state.shuffle = true;
      const rest = shuffleArray(clean.filter((id) => id !== currentId));
      state.queue = [currentId, ...rest];
      state.queueIndex = 0;
    } else {
      state.queue = clean.slice();
      state.queueIndex = index;
    }
    updateQueueUI();
    updateShuffleUI();
    playTrack(currentId, { force: true });
    saveSession();
  }

  function playFromView(index) {
    if (!state.viewTracks.length) return;
    startQueue(state.viewTracks, index, state.viewLabel);
  }

  function playById(id) {
    let list = state.viewTracks;
    let index = list.indexOf(id);
    if (index < 0) {
      list = sortTracks(state.tracks, "added-desc").map((track) => track.id);
      index = list.indexOf(id);
    }
    if (index < 0) return;
    startQueue(list, index, state.viewLabel || "Your library");
  }

  function playLibrary() {
    if (!state.tracks.length) {
      showToast("Add some music first.", "music");
      return;
    }
    const tracks = sortTracks(state.tracks, "added-desc");
    startQueue(tracks.map((track) => track.id), 0, "Your library");
  }

  function shuffleLibrary() {
    if (!state.tracks.length) {
      showToast("Add some music first.", "music");
      return;
    }
    const ids = shuffleArray(state.tracks.map((track) => track.id));
    state.shuffle = true;
    state.baseQueue = state.tracks.map((track) => track.id);
    state.queue = ids;
    state.queueIndex = 0;
    state.queueLabel = "Shuffle · Your library";
    state.isPlaying = false;
    updateShuffleUI();
    updateQueueUI();
    playTrack(ids[0], { force: true });
    saveSession();
  }

  function playView() {
    if (!state.viewTracks.length) {
      playLibrary();
      return;
    }
    startQueue(state.viewTracks, 0, state.viewLabel);
  }

  function shuffleView() {
    if (!state.viewTracks.length) {
      shuffleLibrary();
      return;
    }
    const currentId = state.viewTracks[Math.floor(Math.random() * state.viewTracks.length)];
    state.shuffle = true;
    state.baseQueue = state.viewTracks.slice();
    state.queue = [currentId, ...shuffleArray(state.viewTracks.filter((id) => id !== currentId))];
    state.queueIndex = 0;
    state.queueLabel = `Shuffle · ${state.viewLabel}`;
    updateShuffleUI();
    updateQueueUI();
    playTrack(currentId, { force: true });
    saveSession();
  }

  function togglePlay() {
    const track = currentTrack();
    if (track && track.source === "youtube") {
      if (!ytPlayer) { playTrack(track.id, { force: true }); return; }
      if (state.isPlaying) { ytPlayer.pauseVideo(); state.isPlaying = false; }
      else { ytPlayer.playVideo(); state.isPlaying = true; }
      updatePlayerUI();
      return;
    }
    const trackExt = track ? String(track.fileName || "").split(".").pop().toLowerCase() : "";
    if (track && (VIDEO_EXTENSIONS.includes(trackExt) || String(track.mime || "").startsWith("video/"))) {
      const video = el.ytPlayerHost ? el.ytPlayerHost.querySelector("video") : null;
      if (!video || (el.ytOverlay && el.ytOverlay.hidden)) { playTrack(track.id, { force: true }); return; }
      if (state.isPlaying) { video.pause(); state.isPlaying = false; }
      else { video.play().catch(() => {}); state.isPlaying = true; }
      updatePlayerUI();
      return;
    }
    if (!track) {
      if (state.tracks.length) {
        const ordered = sortTracks(state.tracks, "added-desc");
        startQueue(ordered.map((item) => item.id), 0, "Your library");
      } else {
        showToast("Import a song to start listening.", "plus");
      }
      return;
    }
    if (!currentAudioUrl) {
      playTrack(track.id, { force: true });
      return;
    }
    if (el.audio.paused) {
      if (el.audio.ended || el.audio.currentTime >= (el.audio.duration || 0) - 0.1) el.audio.currentTime = 0;
      el.audio.play().catch(() => showToast("Could not start playback.", "volume-mute"));
    } else {
      el.audio.pause();
    }
  }

  let ytPlayer = null;
  let ytApiPromise = null;
  let ytTimeTimer = null;

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "").split("/")[0];
      return u.searchParams.get("v");
    } catch (_) { return null; }
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof previous === "function") previous(); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
    return ytApiPromise;
  }

  function stopYtTimeUpdates() {
    if (ytTimeTimer) { clearInterval(ytTimeTimer); ytTimeTimer = null; }
  }

  function startYtTimeUpdates() {
    stopYtTimeUpdates();
    ytTimeTimer = setInterval(() => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
      const cur = ytPlayer.getCurrentTime() || 0;
      const dur = ytPlayer.getDuration() || 0;
      el.currentTime.textContent = formatTime(cur);
      if (dur) {
        el.durationTime.textContent = formatTime(dur);
        el.progress.value = String((cur / dur) * 100);
      }
    }, 250);
  }

  function playYouTubeTrack(track) {
    const videoId = extractYouTubeId(track.youtubeUrl);
    if (!videoId) { showToast("Invalid or mistyped URL.", "download"); return; }
    state.currentTrackId = track.id;
    state.isPlaying = true;
    if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
    el.audio.removeAttribute("src");
    updatePlayerUI();
    if (el.ytOverlay) el.ytOverlay.hidden = false;
    if (el.ytPlayerHost) {
      el.ytPlayerHost.innerHTML = `<iframe id="ytIframe" src="https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>`;
    }
    el.durationTime.textContent = track.duration ? formatTime(track.duration) : "—";
    loadYouTubeApi().then(() => {
      try {
        const iframe = document.getElementById("ytIframe");
        if (!iframe) return;
        ytPlayer = new YT.Player(iframe, {
          events: {
            onReady: (e) => {
              const applyDuration = () => {
                const dur = e.target.getDuration() || track.duration || 0;
                if (dur) {
                  if (track.duration !== dur) { track.duration = dur; window.MPAriaDB.updateTrack(track).catch(() => {}); }
                  el.durationTime.textContent = formatTime(dur);
                  return true;
                }
                return false;
              };
              if (!applyDuration()) {
                setTimeout(() => { applyDuration(); }, 700);
              }
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) { state.isPlaying = true; updatePlayerUI(); }
              else if (e.data === YT.PlayerState.PAUSED) { state.isPlaying = false; updatePlayerUI(); }
              else if (e.data === YT.PlayerState.ENDED) { state.isPlaying = false; updatePlayerUI(); nextTrack(true); }
            }
          }
        });
      } catch (_) { /* keep iframe playback */ }
    });
  }

  function closeYouTubePlayer() {
    if (ytPlayer) {
      try { ytPlayer.stopVideo(); } catch (_) {}
      try { ytPlayer.destroy(); } catch (_) {}
      ytPlayer = null;
    }
    if (el.ytPlayerHost) el.ytPlayerHost.innerHTML = "";
    if (el.ytOverlay) el.ytOverlay.hidden = true;
    state.isPlaying = false;
    updatePlayerUI();
  }

  function nextTrack(auto = false) {
    if (!state.queue.length) return;
    if (state.queueIndex < state.queue.length - 1) {
      state.queueIndex++;
      playTrack(state.queue[state.queueIndex], { force: true });
      saveSession();
      return;
    }
    if (state.repeat === "all") {
      state.queueIndex = 0;
      playTrack(state.queue[0], { force: true });
      saveSession();
      return;
    }
    if (auto) {
      state.isPlaying = false;
      updatePlayerUI();
      saveSession();
    }
  }

  function toggleMiniPlayer() {
    document.body.classList.toggle("mini-player");
    showToast(document.body.classList.contains("mini-player") ? "Mini player on." : "Mini player off.", "music", 1800);
  }

  function seekBy(seconds) {
    const audio = el.audio;
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, (audio.currentTime || 0) + seconds));
    updateProgressUI();
  }

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  function cyclePlaybackSpeed() {
    const current = state.playbackRate || 1;
    const idx = PLAYBACK_SPEEDS.indexOf(current);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    state.playbackRate = next;
    el.audio.playbackRate = next;
    savePreferences();
    showToast(`Playback speed: ${next}x`, "clock", 2000);
    const btn = document.getElementById("speedBtn");
    if (btn) btn.textContent = `${next}x`;
    updatePlayerUI();
  }
  function applyPlaybackRate() {
    try { el.audio.playbackRate = state.playbackRate || 1; } catch (_) {}
  }

  function previousTrack() {
    if (!state.queue.length) return;
    if (el.audio.currentTime > 3) {
      el.audio.currentTime = 0;
      return;
    }
    if (state.queueIndex > 0) {
      state.queueIndex--;
      playTrack(state.queue[state.queueIndex], { force: true });
      saveSession();
      return;
    }
    if (state.repeat === "all") {
      state.queueIndex = state.queue.length - 1;
      playTrack(state.queue[state.queueIndex], { force: true });
    } else {
      el.audio.currentTime = 0;
    }
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    const currentId = state.queue[state.queueIndex];
    if (state.shuffle) {
      state.baseQueue = state.queue.slice();
      if (currentId && state.queue.length > 1) {
        const rest = shuffleArray(state.queue.filter((id) => id !== currentId));
        state.queue = [currentId, ...rest];
        state.queueIndex = 0;
      }
    } else if (state.baseQueue.length) {
      state.queue = state.baseQueue.slice();
      state.queueIndex = currentId ? Math.max(0, state.queue.indexOf(currentId)) : 0;
    }
    updateShuffleUI();
    updateQueueUI();
    saveSession();
  }

  function cycleRepeat() {
    state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    updateShuffleUI();
    saveSession();
  }

  function toggleMute() {
    state.muted = !state.muted;
    el.audio.volume = state.muted ? 0 : state.volume;
    updateVolumeUI();
    saveSession();
  }

  function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (state.volume > 0) state.muted = false;
    el.audio.volume = state.muted ? 0 : state.volume;
    updateVolumeUI();
    saveSession();
  }

  function playQueueIndex(index) {
    const id = state.queue[index];
    if (!id) return;
    state.queueIndex = index;
    playTrack(id, { force: true });
    saveSession();
  }

  function removeQueueIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.queue.splice(index, 1);
    if (index < state.queueIndex) state.queueIndex--;
    else if (index === state.queueIndex) state.queueIndex = Math.min(state.queueIndex, state.queue.length - 1);
    if (!state.queue.length) state.queueIndex = -1;
    updateQueueUI();
    saveSession();
  }

  function clearQueue() {
    const track = currentTrack();
    if (track) {
      state.queue = [track.id];
      state.queueIndex = 0;
    } else {
      state.queue = [];
      state.queueIndex = -1;
    }
    updateQueueUI();
    saveSession();
    showToast("Queue cleared.", "queue");
  }

  function queueAddNext(id) {
    const track = findTrack(id);
    if (!track) return;
    if (!state.queue.length) {
      state.queue = [id];
      state.queueIndex = 0;
      updateQueueUI();
      saveSession();
      showToast(`“${track.title}” is up next.`, "queue");
      return;
    }
    state.queue.splice(state.queueIndex + 1, 0, id);
    updateQueueUI();
    saveSession();
    showToast(`“${track.title}” will play next.`, "queue");
  }

  function queueAdd(id) {
    const track = findTrack(id);
    if (!track) return;
    state.queue.push(id);
    if (state.queueIndex < 0) state.queueIndex = 0;
    updateQueueUI();
    saveSession();
    showToast(`Added “${track.title}” to the queue.`, "queue");
  }

  async function toggleFavorite(id) {
    const track = findTrack(id);
    if (!track) return;
    track.favorite = !track.favorite;
    try {
      await window.MPAriaDB.updateTrack(track);
    } catch (_) {
      showToast("Could not save the favorite.", "heart");
    }
    updateFavoriteButtons();
    render();
  }

  /* ---------- Importing ---------- */

  const IMAGE_EXTENSIONS = ["jpg","jpeg","png","gif","webp","bmp","tiff","tif","heic","heif","svg","avif","ico"];
  function isAudioFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("audio/")) return true;
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  }
  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }
  function isVideoFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("video/")) return true;
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }
  function baseNameNoExt(name) {
    return String(name || "").replace(/\.[^.]+$/, "").trim().toLowerCase();
  }
  function extractVideoFrame(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      let settled = false;
      const finish = (blob) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        resolve(blob || null);
      };
      const timer = setTimeout(() => finish(null), 12000);
      video.onloadedmetadata = () => {
        try { video.currentTime = Math.min(0.1, (video.duration || 1) / 10); } catch (_) { finish(null); }
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, w, h);
          canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.85);
        } catch (_) { finish(null); }
      };
      video.onerror = () => finish(null);
      video.src = url;
    });
  }

  function mimeForFile(file) {
    if (file.type && file.type.startsWith("audio/")) return file.type;
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    const map = {
      mp1: "audio/mpeg", mp2: "audio/mpeg", mp3: "audio/mpeg", mp4: "video/mp4",
      m4a: "audio/mp4", m4b: "audio/mp4", m4p: "audio/mp4", m4r: "audio/mp4",
      m4v: "video/mp4", aac: "audio/aac", flac: "audio/flac", wav: "audio/wav",
      wave: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus",
      webm: "video/webm", aif: "audio/aiff", aiff: "audio/aiff", aifc: "audio/aiff",
      alac: "audio/alac", wma: "audio/x-ms-wma", wmv: "video/x-ms-wmv",
      mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
      mpa: "audio/mpeg", mpga: "audio/mpeg", mpe: "video/mpeg", mpeg: "video/mpeg",
      mpg: "video/mpeg", "3gp": "video/3gpp", "3g2": "video/3gpp2",
      amr: "audio/amr", awb: "audio/amr-wb", caf: "audio/x-caf",
      dsf: "audio/dsf", dff: "audio/dff", mka: "audio/x-matroska",
      ra: "audio/x-realaudio", ram: "audio/x-pn-realaudio", rm: "application/vnd.rn-realmedia",
      rma: "application/vnd.rn-realmedia", spx: "audio/ogg", tta: "audio/x-tta",
      voc: "audio/x-voc", vox: "audio/x-voxware", vqf: "audio/x-twinvq",
      wv: "audio/x-wavpack", xm: "audio/xm", mod: "audio/mod", s3m: "audio/s3m",
      it: "audio/it", mtm: "audio/mtm", umx: "audio/xm", mo3: "audio/mo3",
      ac3: "audio/ac3", dts: "audio/vnd.dts", mlp: "audio/mlp", thd: "audio/thd",
      eac3: "audio/eac3", m2ts: "video/mp2t", ts: "video/mp2t", mts: "video/mp2t",
      m2t: "video/mp2t", m1a: "audio/mpeg", m2a: "audio/mpeg", mp4a: "audio/mp4",
      mp4v: "video/mp4", qt: "video/quicktime", m3u: "audio/mpegurl", pls: "audio/x-scpls"
    };
    return map[ext] || "audio/mpeg";
  }

  function parseFileName(name) {
    let base = String(name || "Untitled").replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
    base = base.replace(/^\d{1,3}[\s.\-–—]+/, "").trim();
    const split = base.split(/\s+[-–—]\s+/);
    if (split.length >= 2 && split[0] && split.slice(1).join(" - ")) {
      return { artist: split[0].trim(), title: split.slice(1).join(" - ").trim() };
    }
    return { artist: UNKNOWN_ARTIST, title: base || "Untitled" };
  }

  function readAudioDuration(file) {
    return new Promise((resolve) => {
      const probe = document.createElement("audio");
      const url = URL.createObjectURL(file);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        probe.removeAttribute("src");
        resolve(Number.isFinite(value) && value > 0 ? value : 0);
      };
      const timer = setTimeout(() => finish(0), 9000);
      probe.preload = "metadata";
      probe.onloadedmetadata = () => finish(probe.duration);
      probe.onerror = () => finish(0);
      probe.src = url;
    });
  }

  function parseTrackNumber(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function normalizedYear(value) {
    const match = String(value || "").match(/\d{4}/);
    return match ? match[0] : "";
  }

  function makeTrack(file, tags, cover, duration, fingerprint) {
    const fallback = state.prefs.autoName ? parseFileName(file.name) : { title: "", artist: UNKNOWN_ARTIST };
    const title = (tags.title || "").trim() || (state.prefs.autoName ? fallback.title : "Untitled");
    const artist = (tags.artist || "").trim() || (state.prefs.autoName ? fallback.artist : UNKNOWN_ARTIST);
    const album = (tags.album || "").trim() || UNKNOWN_ALBUM;
    const albumArtist = (tags.albumArtist || "").trim() || artist;
    return {
      id: uid(),
      title,
      artist,
      album,
      albumArtist,
      albumKey: `${normalizeKey(album)}::${normalizeKey(albumArtist)}`,
      genre: (tags.genre || "").trim(),
      year: normalizedYear(tags.year),
      trackNumber: parseTrackNumber(tags.track),
      discNumber: parseTrackNumber(tags.disc),
      duration: Number(duration) || 0,
      fileName: file.name,
      fileSize: file.size,
      mime: mimeForFile(file),
      addedAt: Date.now(),
      lastPlayedAt: 0,
      playCount: 0,
      favorite: false,
      hasArtwork: Boolean(cover),
      artworkMime: cover ? cover.type : "",
      fingerprint,
      source: "import"
    };
  }

  function fingerprintFor(file) {
    return `${file.name}|${file.size}|${file.lastModified || 0}`;
  }

  async function checkStorageCapacity(extraBytes) {
    const limit = 25 * 1024 * 1024 * 1024;
    let used = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        used = est.usage || 0;
      }
    } catch (_) { /* ignore */ }
    if (used + (extraBytes || 0) > limit) {
      openModal(`<div class="modal-head">
        <div><h2 id="modalTitle">Ran Out of storage</h2><p>Your library has reached the 25 GB limit. Free up space to import more music.</p></div>
        <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
      </div>
      <div style="display:grid;place-items:center;padding:26px 0 10px">
        <svg width="74" height="74" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--accent)"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.2h.01" stroke-linecap="round"/></svg>
        <p style="margin:14px 0 0;text-align:center;color:var(--muted);font-size:12px;line-height:1.6;max-width:320px">MPAria stores music locally on this Mac. You've used all 25 GB available to your library.</p>
      </div>
      <div class="modal-actions"><button class="btn primary" data-action="close-modal">Got it</button></div>`);
      return false;
    }
    return true;
  }

  async function importFiles(files, options = {}) {
    const allFiles = Array.from(files || []);
    const imageFiles = allFiles.filter(isImageFile);
    const list = allFiles.filter(isAudioFile);
    if (!list.length && !imageFiles.length) {
      showToast("No supported audio or image files found.", "music");
      return;
    }
    if (!list.length && imageFiles.length) {
      // Accept dragged images: attach to the current track if possible.
      const track = currentTrack();
      if (track) {
        try {
          await setTrackCover(track.id, imageFiles[0]);
          render();
          updatePlayerUI();
          showToast(`Artwork updated for “${track.title}”.`, "check");
        } catch (_) {
          showToast("Could not apply the image.", "sparkle");
        }
      } else {
        showToast("Drag an image onto a song to set its artwork.", "sparkle");
      }
      return;
    }
    const extra = list.reduce((sum, f) => sum + (f.size || 0), 0);
    if (!(await checkStorageCapacity(extra))) return;
    if (state.importing) {
      showToast("An import is already running.", "download");
      return;
    }

    const coverMap = new Map();
    if (state.prefs.autoMatchCovers) {
      imageFiles.forEach((f) => {
        const key = baseNameNoExt(f.name);
        if (key && !coverMap.has(key)) coverMap.set(key, f);
      });
    }

    state.importing = true;
    state.importCancelled = false;
    showImportProgress();
    const fingerprints = new Set(state.tracks.map((track) => track.fingerprint).filter(Boolean));
    let imported = 0;
    let duplicates = 0;
    let failed = 0;

    try {
      for (let index = 0; index < list.length; index++) {
        if (state.importCancelled) break;
        const file = list[index];
        setImportProgress(`Importing ${index + 1} of ${list.length}`, file.name);

        if (!file.size) {
          failed++;
          continue;
        }

        const fingerprint = fingerprintFor(file);
        if (fingerprints.has(fingerprint)) {
          duplicates++;
          continue;
        }

        try {
          const head = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
          const tail = await file.slice(Math.max(0, file.size - 128)).arrayBuffer();
          const parsed = window.MPAriaTags.parse(file, head, tail);
          const override = options.overrides && options.overrides.get(file);
          const tags = override && override.tags ? {
            title: override.tags.title || parsed.title,
            artist: override.tags.artist || parsed.artist,
            album: override.tags.album || parsed.album,
            albumArtist: override.tags.albumArtist || parsed.albumArtist,
            genre: override.tags.genre || parsed.genre,
            year: override.tags.year || parsed.year,
            track: override.tags.track || parsed.track,
            disc: override.tags.disc || parsed.disc
          } : parsed;
          let cover = (override && override.cover) || parsed.artwork || null;
          if (!cover && state.prefs.autoMatchCovers) {
            const matched = coverMap.get(baseNameNoExt(file.name));
            if (matched) cover = matched;
          }
          if (!cover && state.prefs.autoThumbnail && isVideoFile(file)) {
            cover = await extractVideoFrame(file);
          }
          const duration = await readAudioDuration(file);
          if (state.importCancelled) break;

          const track = makeTrack(file, tags, cover, duration, fingerprint);
          await window.MPAriaDB.putTrack(track, file, cover);
          state.tracks.push(track);
          state.tracksById.set(track.id, track);
          fingerprints.add(fingerprint);
          imported++;
        } catch (error) {
          console.warn("MPAria could not import", file.name, error);
          failed++;
        }
      }
    } finally {
      state.importing = false;
      hideImportProgress();
    }

    await window.MPAriaDB.persistStorage().catch(() => {});
    await updateStorageUI();
    render();
    updatePlayerUI();
    if (state.currentTrackId) {
      const existing = findTrack(state.currentTrackId);
      if (!existing) {
        state.currentTrackId = null;
        currentAudioUrl = null;
        el.audio.pause();
        el.audio.removeAttribute("src");
      }
    }

    const parts = [];
    if (imported) parts.push(`${plural(imported, "song")} added`);
    if (duplicates) parts.push(`${duplicates} already here`);
    if (failed) parts.push(`${failed} couldn't be read`);
    if (state.importCancelled) parts.push("import cancelled");
    showToast(parts.join(" · ") || "Nothing was imported.", imported ? "check" : "sparkle", 4200);
  }

  async function addStarterTracks() {
    if (state.importing) {
      showToast("Wait for the current import to finish.", "download");
      return;
    }
    if (!window.MPAriaAudioLab) {
      showToast("The starter audio engine is unavailable.", "music");
      return;
    }

    showImportProgress();
    setImportProgress("Composing starter tracks", "Synthesizing original audio on this Mac…");
    try {
      const results = await window.MPAriaAudioLab.createStarterTracks((current, total, title) => {
        setImportProgress(`Composing starter track ${current} of ${total}`, title);
      });
      const existing = new Set(state.tracks.map((track) => `${normalizeKey(track.title)}|${normalizeKey(track.artist)}`));
      const fresh = results.filter((result) => !existing.has(`${normalizeKey(result.tags.title)}|${normalizeKey(result.tags.artist)}`));
      if (!fresh.length) {
        hideImportProgress();
        showToast("The starter tracks are already in your library.", "check");
        return;
      }
      const overrides = new Map();
      fresh.forEach((result) => overrides.set(result.file, { tags: result.tags, cover: result.cover }));
      hideImportProgress();
      await importFiles(fresh.map((result) => result.file), { overrides });
    } catch (error) {
      hideImportProgress();
      console.error(error);
      showToast("The starter tracks could not be generated.", "sparkle");
    }
  }

  function downloadFileName(url, mime) {
    const types = {
      "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
      "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/flac": "flac",
      "audio/x-flac": "flac", "audio/wav": "wav", "audio/x-wav": "wav",
      "audio/ogg": "ogg", "audio/opus": "opus", "audio/webm": "webm"
    };
    let name = "download";
    try {
      const path = new URL(url, location.href).pathname;
      name = decodeURIComponent(path.split("/").filter(Boolean).pop() || "download");
    } catch (_) { /* keep the fallback name */ }
    name = name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "download";
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
      name += "." + (types[String(mime || "").split(";")[0].trim().toLowerCase()] || "mp3");
    }
    return name;
  }

  async function downloadAudio(url) {
    // The bundled localhost server relays the download, so remote CORS rules
    // do not block it. If the page is opened from file:// (or an older helper
    // is running), fall back to fetching the URL directly.
    const attempts = (location.protocol === "http:" || location.protocol === "https:")
      ? [{ target: `/__mparia_fetch?url=${encodeURIComponent(url)}`, proxy: true }, { target: url, proxy: false }]
      : [{ target: url, proxy: false }];
    let lastError = null;

    for (const attempt of attempts) {
      let response;
      try {
        response = await fetch(attempt.target, {
          headers: attempt.proxy
            ? { Accept: "audio/*,application/octet-stream,*/*;q=0.8", "X-MPAria-Download": "1" }
            : {},
          cache: "no-store",
          redirect: "follow"
        });
      } catch (error) {
        lastError = error;
        continue;
      }
      if (attempt.proxy && (response.status === 404 || response.status === 405)) {
        // An older copy of the local server is still running; retry directly.
        lastError = new Error("The local download helper is not available.");
        continue;
      }
      if (!response.ok) {
        let detail = "";
        if (attempt.proxy) {
          try {
            const payload = await response.json();
            detail = payload && payload.error ? String(payload.error) : "";
          } catch (_) { /* not a JSON error */ }
        }
        throw new Error(detail || `The server returned ${response.status}.`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("The file was empty.");
      if (/^(text\/|application\/json)/i.test(blob.type || "")) {
        throw new Error("That link returned a web page, not an audio file.");
      }
      return { blob, name: downloadFileName(url, blob.type) };
    }

    if (lastError && /fetch|network|load failed/i.test(String(lastError.message || ""))) {
      throw new Error("MPAria could not reach that URL. If this is the packaged app, quit and reopen it so the local download helper starts, then try again.");
    }
    throw lastError || new Error("Could not download that URL.");
  }

  function openImportUrl() {
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Import from URL</h2><p>Paste a YouTube link. MPAria validates it and copies it to your clipboard — no downloads or installs needed.</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <form id="urlImportForm">
      <label class="field-label" for="audioUrl">YouTube URL</label>
      <input class="field" id="audioUrl" name="url" type="url" placeholder="https://www.youtube.com/watch?v=..." required autocomplete="off">
      <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">${icon("download")} Import link</button></div>
      <p class="modal-note">Only YouTube links (youtube.com or youtu.be) are supported. The link is copied exactly as entered.</p>
    </form>`, {
      onMount(modal) {
        const form = $("#urlImportForm", modal);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = form.querySelector('button[type="submit"]');
          const data = new FormData(form);
          const url = String(data.get("url") || "").trim();
          if (!url) return;
          let parsed;
          try { parsed = new URL(url); } catch (_) { parsed = null; }
          const host = parsed ? parsed.hostname.replace(/^www\./, "") : "";
          const isYouTube = host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com" || host === "music.youtube.com";
          if (!parsed || !isYouTube) {
            showToast("Invalid or mistyped URL.", "download", 4000);
            return;
          }
          submit.disabled = true;
          submit.textContent = "Importing...";
          try {
            // Avoid importing the same link twice.
            const fingerprint = `youtube|${url}`;
            if (state.tracks.some((t) => t.fingerprint === fingerprint)) {
              showToast("That YouTube link is already in your library.", "check", 3000);
              submit.disabled = false;
              submit.textContent = "Import link";
              return;
            }
            let title = "YouTube video";
            let artist = "YouTube";
            let duration = 0;
            let thumbnailUrl = null;
            // Prefer the local server's metadata extractor (includes duration).
            try {
              const infoUrl = `/__mparia_youtube_info?url=${encodeURIComponent(url)}`;
              const infoResponse = await fetch(infoUrl, { headers: { "X-MPAria-Download": "1" } });
              if (infoResponse.ok) {
                const info = await infoResponse.json();
                title = info.title || title;
                artist = info.author || artist;
                duration = Number(info.duration) || 0;
                thumbnailUrl = info.thumbnail || thumbnailUrl;
              }
            } catch (_) { /* fall through to oEmbed */ }
            if (!thumbnailUrl || title === "YouTube video") {
              try {
                const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
                if (oembed.ok) {
                  const info = await oembed.json();
                  title = info.title || title;
                  artist = info.author_name || artist;
                  thumbnailUrl = info.thumbnail_url || thumbnailUrl;
                }
              } catch (_) { /* keep fallbacks */ }
            }
            // Thumbnails are cross-origin and cannot be fetched as blobs.
            // Store the remote URL and render it directly instead.
            const coverBlob = null;
            const track = {
              id: uid(),
              title,
              artist,
              album: "YouTube",
              albumArtist: artist,
              albumKey: `${normalizeKey("YouTube")}::${normalizeKey(artist)}`,
              genre: "",
              year: "",
              trackNumber: 0,
              discNumber: 0,
              duration: duration,
              fileName: url,
              fileSize: 0,
              mime: "video/youtube",
              addedAt: Date.now(),
              lastPlayedAt: 0,
              playCount: 0,
              favorite: false,
              hasArtwork: false,
              artworkMime: "",
              artworkUrl: thumbnailUrl || null,
              fingerprint,
              source: "youtube",
              youtubeUrl: url
            };
            await window.MPAriaDB.putTrack(track, new Blob([]), coverBlob);
            state.tracks.push(track);
            state.tracksById.set(track.id, track);
            // Also copy the link for convenience.
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
            } catch (_) { /* clipboard optional */ }
            closeModal();
            render();
            updatePlayerUI();
            updateStorageUI();
            showToast("YouTube link imported.", "check", 3000);
          } catch (error) {
            submit.disabled = false;
            submit.innerHTML = `${icon("download")} Import link`;
            showToast(error && error.message ? error.message : "Could not import that link.", "download", 4600);
          }
        });
      }
    });
  }

  /* ---------- Playlists ---------- */

  function createPlaylist(name, trackIds = [], navigateAfter = true) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const playlist = {
      id: uid(),
      name: cleanName.slice(0, 80),
      trackIds: trackIds.filter((id) => state.tracksById.has(id)),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.playlists.push(playlist);
    state.playlistsById.set(playlist.id, playlist);
    window.MPAriaDB.putPlaylist(playlist).catch(() => showToast("Could not save the playlist.", "playlist"));
    renderSidebar();
    if (navigateAfter) navigate("playlist", { id: playlist.id });
    else render();
    updateStorageUI();
    showToast(`Playlist “${playlist.name}” created.`, "playlist");
    return playlist;
  }

  function exportPlaylist(id) {
    const playlist = state.playlistsById.get(id);
    if (!playlist) return;
    const tracks = playlist.trackIds.map(findTrack).filter(Boolean).map((t) => ({
      title: t.title, artist: t.artist, album: t.album, fingerprint: t.fingerprint, fileName: t.fileName
    }));
    const payload = { name: playlist.name, tracks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${playlist.name}.mparia-playlist.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Playlist exported.", "check");
  }

  function importPlaylistFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.mparia-playlist.json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const name = (data && data.name) || file.name.replace(/\.[^.]+$/, "");
        const items = Array.isArray(data.tracks) ? data.tracks : [];
        const ids = [];
        items.forEach((item) => {
          const match = state.tracks.find((t) =>
            (item.fingerprint && t.fingerprint === item.fingerprint) ||
            (item.title && item.artist && normalizeKey(t.title) === normalizeKey(item.title) && normalizeKey(t.artist) === normalizeKey(item.artist))
          );
          if (match && !ids.includes(match.id)) ids.push(match.id);
        });
        createPlaylist(name, ids, true);
        showToast(`Imported playlist “${name}” with ${ids.length} matched songs.`, "playlist");
      } catch (error) {
        showToast("Could not import playlist file.", "download");
      }
    });
    input.click();
  }

  function openCreatePlaylist(trackId = null) {
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">New playlist</h2><p>Give it a name. You can add more songs from any track's ··· menu.</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <form id="createPlaylistForm">
      <label class="field-label" for="playlistName">Playlist name</label>
      <input class="field" id="playlistName" name="name" maxlength="80" placeholder="Late night drive" required autocomplete="off" autofocus>
      <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${icon("plus")} Create</button></div>
    </form>`, {
      onMount(modal) {
        const form = $("#createPlaylistForm", modal);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const name = new FormData(form).get("name");
          const playlist = createPlaylist(name, trackId ? [trackId] : [], true);
          if (playlist) closeModal();
        });
      }
    });
  }

  function openAddToPlaylist(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    const choices = state.playlists.length
      ? state.playlists.map((playlist) => {
        const inPlaylist = playlist.trackIds.includes(trackId);
        const first = playlist.trackIds.map(findTrack).filter(Boolean)[0];
        return `<button class="playlist-choice${inPlaylist ? " is-in" : ""}" data-action="choose-playlist" data-playlist-id="${escapeHtml(playlist.id)}" data-track-id="${escapeHtml(trackId)}">
          ${coverMarkup(first, "mini-cover")}
          <span>${escapeHtml(playlist.name)}</span>
          <span class="check">${icon("check")}</span>
        </button>`;
      }).join("")
      : `<div class="library-empty" style="padding:22px 10px">${icon("playlist")}<p>No playlists yet. Create one below.</p></div>`;

    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Add to playlist</h2><p>“${escapeHtml(track.title)}” · ${escapeHtml(track.artist)}</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="playlist-choice-list">${choices}</div>
    <div class="modal-actions"><button class="btn soft" data-action="new-playlist-with-track" data-track-id="${escapeHtml(trackId)}">${icon("plus")} New playlist</button><button class="btn" data-action="close-modal">Done</button></div>`, {
      onMount(modal) { hydrateCovers(modal); }
    });
  }

  function togglePlaylistMembership(playlistId, trackId) {
    const playlist = state.playlistsById.get(playlistId);
    const track = findTrack(trackId);
    if (!playlist || !track) return;
    const index = playlist.trackIds.indexOf(trackId);
    if (index >= 0) {
      playlist.trackIds.splice(index, 1);
      showToast(`Removed from “${playlist.name}”.`, "playlist");
    } else {
      playlist.trackIds.push(trackId);
      showToast(`Added to “${playlist.name}”.`, "check");
    }
    playlist.updatedAt = Date.now();
    window.MPAriaDB.putPlaylist(playlist).catch(() => showToast("Could not save that change.", "playlist"));
    render();
    openAddToPlaylist(trackId);
  }

  function openRenamePlaylist(playlistId) {
    const playlist = state.playlistsById.get(playlistId);
    if (!playlist) return;
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Rename playlist</h2><p>Choose a new name for this collection.</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <form id="renamePlaylistForm">
      <label class="field-label" for="renamePlaylist">Playlist name</label>
      <input class="field" id="renamePlaylist" name="name" maxlength="80" value="${escapeHtml(playlist.name)}" required autocomplete="off" autofocus>
      <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save</button></div>
    </form>`, {
      onMount(modal) {
        const form = $("#renamePlaylistForm", modal);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const name = String(new FormData(form).get("name") || "").trim();
          if (!name) return;
          playlist.name = name.slice(0, 80);
          playlist.updatedAt = Date.now();
          window.MPAriaDB.putPlaylist(playlist).catch(() => showToast("Could not save the playlist.", "playlist"));
          closeModal();
          render();
          showToast("Playlist renamed.", "check");
        });
      }
    });
  }

  function deletePlaylist(playlistId) {
    const playlist = state.playlistsById.get(playlistId);
    if (!playlist) return;
    confirmAction({
      title: "Delete this playlist?",
      message: `“${playlist.name}” will be removed. The songs themselves stay in your library.`,
      confirmLabel: "Delete playlist",
      destructive: true,
      onConfirm: () => {
        state.playlists = state.playlists.filter((item) => item.id !== playlistId);
        state.playlistsById.delete(playlistId);
        window.MPAriaDB.deletePlaylist(playlistId).catch(() => showToast("Could not delete the playlist.", "trash"));
        navigate("playlists");
        showToast("Playlist deleted.", "trash");
      }
    });
  }

  function removeFromPlaylist(playlistId, trackId) {
    const playlist = state.playlistsById.get(playlistId);
    if (!playlist) return;
    playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    playlist.updatedAt = Date.now();
    window.MPAriaDB.putPlaylist(playlist).catch(() => {});
    render();
    showToast("Removed from playlist.", "playlist");
  }

  /* ---------- Modals, menus and settings ---------- */

  function openModal(markup, options = {}) {
    lastFocused = document.activeElement;
    confirmCallback = null;
    el.modal.innerHTML = markup;
    el.modalLayer.hidden = false;
    if (options.onMount) options.onMount(el.modal);
    setTimeout(() => {
      const focusable = el.modal.querySelector("[autofocus], input, textarea, select, button");
      if (focusable) focusable.focus();
    }, 60);
  }

  function closeModal() {
    el.modalLayer.hidden = true;
    el.modal.innerHTML = "";
    confirmCallback = null;
    if (lastFocused && typeof lastFocused.focus === "function") {
      try { lastFocused.focus(); } catch (_) { /* focus moved */ }
    }
  }

  function confirmAction({ title, message, confirmLabel = "Confirm", destructive = false, onConfirm }) {
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn ${destructive ? "danger" : "primary"}" data-action="run-confirm">${escapeHtml(confirmLabel)}</button>
    </div>`);
    confirmCallback = onConfirm;
  }

  function showTrackMenu(trackId, anchor) {
    const track = findTrack(trackId);
    if (!track) return;
    contextTrackId = trackId;
    const inPlaylist = state.view.type === "playlist";
    const inFavorites = Boolean(track.favorite);
    const items = [
      ["play", "play", "Play now"],
      ["play-next", "queue", "Play next"],
      ["add-queue", "playlist", "Add to queue"],
      ["add-to-playlist", "plus", "Add to playlist…"],
      ["toggle-favorite-context", "heart", inFavorites ? "Remove from favorites" : "Add to favorites"]
    ];
    items.push(["rename-track", "settings", "Rename"]);
    items.push(["lyrics-track", "mic", "Lyrics"]);
    if (track.album && track.album !== UNKNOWN_ALBUM) items.push(["go-album", "disc", "Go to album"]);
    if (track.artist && track.artist !== UNKNOWN_ARTIST) items.push(["go-artist", "mic", "Go to artist"]);
    if (track.source === "youtube" && track.youtubeUrl) items.push(["copy-youtube-link", "globe", "Copy YouTube link"]);
    if (inPlaylist) items.push(["remove-from-playlist", "close", "Remove from this playlist"]);
    items.push(["remove-library", "trash", "Remove from library…"]);

    el.contextMenu.innerHTML = items.map(([action, iconName, label], index) => {
      const sep = (action === "toggle-favorite-context" || action === "go-album" || action === "remove-library") ? `<div class="menu-sep"></div>` : "";
      const danger = action === "remove-library" || action === "remove-from-playlist" ? " danger" : "";
      return `${action === "toggle-favorite-context" || action === "remove-library" || action === "go-album" ? sep : ""}<button class="menu-item${danger}" data-action="${action}">${icon(iconName)}${escapeHtml(label)}</button>`;
    }).join("");
    el.contextMenu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const menuRect = el.contextMenu.getBoundingClientRect();
    let left = rect.right - menuRect.width;
    let top = rect.bottom + 5;
    if (top + menuRect.height > window.innerHeight - 8) top = rect.top - menuRect.height - 5;
    left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - menuRect.height - 8));
    el.contextMenu.style.left = `${left}px`;
    el.contextMenu.style.top = `${top}px`;
  }

  function hideContextMenu() {
    el.contextMenu.hidden = true;
    el.contextMenu.innerHTML = "";
    contextTrackId = null;
  }

  function removeTrackFromLibrary(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    confirmAction({
      title: "Remove this song?",
      message: `“${track.title}” will be removed from your library and all playlists. The original file on your computer is not touched.`,
      confirmLabel: "Remove song",
      destructive: true,
      onConfirm: async () => {
        if (state.currentTrackId === trackId) {
          el.audio.pause();
          el.audio.removeAttribute("src");
          if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
          currentAudioUrl = null;
          state.currentTrackId = null;
          state.isPlaying = false;
          stopVisualizer();
          artworkTrackId = null;
        }
        state.tracks = state.tracks.filter((item) => item.id !== trackId);
        state.tracksById.delete(trackId);
        state.playlists.forEach((playlist) => {
          if (playlist.trackIds.includes(trackId)) {
            playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
            playlist.updatedAt = Date.now();
            window.MPAriaDB.putPlaylist(playlist).catch(() => {});
          }
        });
        const audioBlob = await window.MPAriaDB.getAudio(trackId);
        const coverBlob = await window.MPAriaDB.getCover(trackId);
        const playlistSnapshots = state.playlists
          .filter((p) => p.trackIds.includes(trackId))
          .map((p) => ({ id: p.id, trackIds: p.trackIds.slice() }));
        const removedIndex = state.queue.indexOf(trackId);
        if (removedIndex >= 0) {
          state.queue.splice(removedIndex, 1);
          if (removedIndex < state.queueIndex) state.queueIndex--;
          else if (removedIndex === state.queueIndex) state.queueIndex = Math.min(state.queueIndex, state.queue.length - 1);
        }
        state.baseQueue = state.baseQueue.filter((id) => id !== trackId);
        if (!state.queue.length) state.queueIndex = -1;
        const cached = coverUrlCache.get(trackId);
        if (cached) {
          URL.revokeObjectURL(cached);
          coverUrlCache.delete(trackId);
        }
        await window.MPAriaDB.deleteTrack(trackId);
        state.lastDeleted = { track, audioBlob, coverBlob, playlistSnapshots };
        hideContextMenu();
        render();
        updatePlayerUI();
        updateStorageUI();
        showToast("Song removed. Press U to undo.", "trash", 6000);
      }
    });
  }

  async function removeDuplicates() {
    const seen = new Set();
    const toDelete = [];
    state.tracks.forEach((t) => {
      const key = t.fingerprint || `${normalizeKey(t.title)}|${normalizeKey(t.artist)}`;
      if (seen.has(key)) toDelete.push(t.id);
      else seen.add(key);
    });
    if (!toDelete.length) {
      showToast("No duplicates found.", "check");
      return;
    }
    for (const id of toDelete) {
      await window.MPAriaDB.deleteTrack(id);
      state.tracks = state.tracks.filter((t) => t.id !== id);
      state.tracksById.delete(id);
    }
    render();
    updateStorageUI();
    showToast(`Removed ${toDelete.length} duplicate(s).`, "trash");
  }

  async function restoreLastDeleted() {
    const data = state.lastDeleted;
    if (!data || !data.track) {
      showToast("Nothing to undo.", "sparkle");
      return;
    }
    const track = data.track;
    await window.MPAriaDB.putTrack(track, data.audioBlob, data.coverBlob);
    state.tracks.push(track);
    state.tracksById.set(track.id, track);
    if (data.playlistSnapshots) {
      data.playlistSnapshots.forEach((snap) => {
        const pl = state.playlistsById.get(snap.id);
        if (pl && !pl.trackIds.includes(track.id)) {
          pl.trackIds = snap.trackIds.slice();
          window.MPAriaDB.putPlaylist(pl).catch(() => {});
        }
      });
    }
    state.lastDeleted = null;
    render();
    updatePlayerUI();
    updateStorageUI();
    showToast(`Restored “${track.title}”.`, "check");
  }

  async function openSettings() {
    const libraryBytes = state.tracks.reduce((sum, track) => sum + (Number(track.fileSize) || 0), 0);
    const limit = 25 * 1024 * 1024 * 1024;
    const usage = formatBytes(libraryBytes);
    const available = formatBytes(Math.max(0, limit - libraryBytes));
    const p = state.prefs || {};
    const toggle = (key, label, desc) => `<div class="settings-row">
        <div><strong style="font-size:11px">${escapeHtml(label)}</strong><p>${escapeHtml(desc)}</p></div>
        <button class="btn ${p[key] ? "primary" : ""}" data-action="toggle-setting" data-setting="${escapeHtml(key)}">${p[key] ? "On" : "Off"}</button>
      </div>`;
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Settings</h2><p>MPAria keeps everything private and local.</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="settings-section">
      <h3>Appearance</h3>
      <div class="settings-row">
        <div><strong style="font-size:11px">Theme</strong><p>Switch between the light and dark look.</p></div>
        <div class="segmented">
          <button class="${state.theme === "dark" ? "is-active" : ""}" data-action="set-theme" data-theme="dark">Dark</button>
          <button class="${state.theme === "light" ? "is-active" : ""}" data-action="set-theme" data-theme="light">Light</button>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <h3>Playback</h3>
      ${toggle("autoplayNext", "Auto-play next", "Automatically play the next track when a song ends.")}
      ${toggle("rememberPosition", "Remember position", "Resume playback position when reopening a track.")}
    </div>
    <div class="settings-section">
      <h3>Import & metadata</h3>
      ${toggle("autoName", "Auto Namer", "Name imported tracks from their file names when tags are missing.")}
      ${toggle("autoThumbnail", "Auto Thumbnail", "Use the first frame of a video as its thumbnail.")}
      ${toggle("autoMatchCovers", "Auto-match covers", "Match image files to tracks by file name when importing.")}
      <div class="settings-row" style="margin-top:14px;align-items:flex-start">
        <div><strong style="font-size:11px">Remove duplicates</strong><p>Scan the library and remove duplicate tracks.</p></div>
        <button class="btn danger" data-action="remove-duplicates">${icon("trash")} Scan</button>
      </div>
    </div>
    <div class="settings-section">
      <h3>Local library</h3>
      <div class="storage-stats">
        <div class="storage-stat"><span>Songs</span><strong>${state.tracks.length}</strong></div>
        <div class="storage-stat"><span>Playlists</span><strong>${state.playlists.length}</strong></div>
        <div class="storage-stat"><span>Used</span><strong>${escapeHtml(usage)}</strong></div>
        <div class="storage-stat"><span>Available</span><strong>${escapeHtml(available)}</strong></div>
      </div>
      <div class="settings-row" style="margin-top:14px;align-items:flex-start">
        <div><strong style="font-size:11px">Clear library</strong><p>Remove all imported songs, playlists and stored audio from this browser. Files outside MPAria are untouched.</p></div>
        <button class="btn danger" data-action="clear-library">${icon("trash")} Clear</button>
      </div>
    </div>
    <div class="settings-section">
      <h3>About MPAria</h3>
      <div class="about-box">
        <span><strong>Offline-first music player.</strong> Audio files are stored in this browser's private IndexedDB storage on this Mac. Nothing is uploaded anywhere.</span>
        <span>Popular commercial music is copyrighted, so MPAria does not bundle or download it. Import your own files or use the legal sources in <strong>Browse</strong>.</span>
        <span>Version 2.0 · Made for your collection.</span>
      </div>
    </div>`, {
      onMount(modal) {
        modal.querySelectorAll("[data-action='toggle-setting']").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.setting;
            if (!(key in state.prefs)) return;
            state.prefs[key] = !state.prefs[key];
            savePreferences();
            openSettings();
          });
        });
      }
    });
  }

  function openLyrics(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Lyrics</h2><p>${escapeHtml(track.title)} — ${escapeHtml(track.artist)}</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <form id="lyricsForm">
      <label class="field-label" for="lyricsText">Lyrics</label>
      <textarea class="field" id="lyricsText" rows="12" placeholder="Paste lyrics here…" style="min-height:200px">${escapeHtml(track.lyrics || "")}</textarea>
      <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save</button></div>
    </form>`, {
      onMount(modal) {
        const form = $("#lyricsForm", modal);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          track.lyrics = String(new FormData(form).get("lyricsText") || "").trim();
          track.updatedAt = Date.now();
          window.MPAriaDB.updateTrack(track).catch(() => showToast("Could not save lyrics.", "download"));
          closeModal();
          showToast("Lyrics saved.", "check");
        });
      }
    });
  }

  function openRenameTrack(trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Rename song</h2><p>Choose a new title (4 to 64 characters).</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <form id="renameTrackForm">
      <label class="field-label" for="renameTrack">Song title</label>
      <input class="field" id="renameTrack" name="name" minlength="4" maxlength="64" value="${escapeHtml(track.title)}" required autocomplete="off" autofocus>
      <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save</button></div>
    </form>`, {
      onMount(modal) {
        const form = $("#renameTrackForm", modal);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const name = String(new FormData(form).get("name") || "").trim();
          if (name.length < 4 || name.length > 64) {
            showToast("Title must be 4 to 64 characters.", "download", 3200);
            return;
          }
          track.title = name;
          track.updatedAt = Date.now();
          window.MPAriaDB.updateTrack(track).catch(() => showToast("Could not save the rename.", "download"));
          closeModal();
          render();
          updatePlayerUI();
          showToast("Song renamed.", "check");
        });
      }
    });
  }

  function clearLibrary() {
    confirmAction({
      title: "Clear the whole library?",
      message: "Every imported song, playlist and piece of artwork will be deleted from MPAria. This cannot be undone. Your original files are untouched.",
      confirmLabel: "Clear library",
      destructive: true,
      onConfirm: async () => {
        el.audio.pause();
        el.audio.removeAttribute("src");
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
        stopVisualizer();
        revokeCachedCovers();
        await window.MPAriaDB.clearLibrary();
        state.tracks = [];
        state.playlists = [];
        state.tracksById.clear();
        state.playlistsById.clear();
        state.currentTrackId = null;
        state.queue = [];
        state.baseQueue = [];
        state.queueIndex = -1;
        state.isPlaying = false;
        state.viewTracks = [];
        artworkTrackId = null;
        closeModal();
        navigate("home");
        updatePlayerUI();
        updateStorageUI();
        showToast("Library cleared. Add music whenever you're ready.", "sparkle");
      }
    });
  }

  function openSleepTimer() {
    const active = state.sleepAtEnd || sleepTimeout;
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Sleep timer</h2><p>MPAria will pause playback and stay quiet.</p></div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="quick-grid">
      <button class="quick-tile" data-action="set-sleep" data-minutes="15"><span>15 minutes</span></button>
      <button class="quick-tile" data-action="set-sleep" data-minutes="30"><span>30 minutes</span></button>
      <button class="quick-tile" data-action="set-sleep" data-minutes="45"><span>45 minutes</span></button>
      <button class="quick-tile" data-action="set-sleep" data-minutes="60"><span>60 minutes</span></button>
      <button class="quick-tile" data-action="set-sleep" data-minutes="end"><span>End of track</span></button>
      <button class="quick-tile" data-action="set-sleep" data-minutes="off"><span>${active ? "Turn off timer" : "No timer"}</span></button>
    </div>
    <p class="modal-note">The timer stays active only for the current session.</p>`);
  }

  function setSleepTimer(minutes) {
    clearTimeout(sleepTimeout);
    sleepTimeout = 0;
    state.sleepAtEnd = false;
    if (minutes === "off") {
      closeModal();
      showToast("Sleep timer turned off.", "clock");
      return;
    }
    if (minutes === "end") {
      state.sleepAtEnd = true;
      closeModal();
      showToast("MPAria will pause at the end of this track.", "clock");
      return;
    }
    const value = Number(minutes);
    if (!value) return;
    sleepTimeout = setTimeout(() => {
      el.audio.pause();
      sleepTimeout = 0;
      showToast("Sleep timer — playback paused.", "clock");
    }, value * 60 * 1000);
    closeModal();
    showToast(`Sleep timer set for ${value} minutes.`, "clock");
  }

  /* ---------- Equalizer & theme ---------- */

  function savePreferences() {
    safeLocalSet("mparia-theme", state.theme);
    safeLocalSet("mparia-sort", state.sort);
    window.MPAriaDB.setSetting("preferences", {
      theme: state.theme,
      eq: state.eq,
      eqPreset: state.eqPreset,
      sort: state.sort,
      playbackRate: state.playbackRate,
      prefs: state.prefs
    });
  }

  function applyTheme(theme, persist = false) {
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = state.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "light" ? "#ffffff" : "#000000");
    if (persist) {
      savePreferences();
      $$("[data-action='set-theme']").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.theme === state.theme);
      });
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark", true);
  }

  function initEqBands() {
    el.eqBands.innerHTML = EQ_FREQUENCIES.map((frequency, index) => `<div class="eq-row">
      <span>${EQ_LABELS[index]} Hz</span>
      <input class="eq-range" type="range" min="-12" max="12" step="1" value="${Number(state.eq[frequency] || 0)}" data-eq-frequency="${frequency}" aria-label="${EQ_LABELS[index]} hertz">
      <output data-eq-output="${frequency}">${Number(state.eq[frequency] || 0) > 0 ? "+" : ""}${Number(state.eq[frequency] || 0)} dB</output>
    </div>`).join("");
    el.eqPreset.value = state.eqPreset;
  }

  function refreshEqUI() {
    EQ_FREQUENCIES.forEach((frequency) => {
      const input = el.eqBands.querySelector(`[data-eq-frequency="${frequency}"]`);
      const output = el.eqBands.querySelector(`[data-eq-output="${frequency}"]`);
      const value = Number(state.eq[frequency] || 0);
      if (input) input.value = String(value);
      if (output) output.textContent = `${value > 0 ? "+" : ""}${value} dB`;
    });
    el.eqPreset.value = state.eqPreset;
    applyEq();
  }

  function setEqValue(frequency, value) {
    state.eq[frequency] = Number(value);
    state.eqPreset = "custom";
    el.eqPreset.value = "custom";
    const output = el.eqBands.querySelector(`[data-eq-output="${frequency}"]`);
    if (output) output.textContent = `${Number(value) > 0 ? "+" : ""}${Number(value)} dB`;
    applyEq();
    savePreferences();
  }

  function applyEqPreset(name) {
    if (name === "custom" || !EQ_PRESETS[name]) {
      state.eqPreset = "custom";
      el.eqPreset.value = "custom";
      return;
    }
    state.eqPreset = name;
    EQ_FREQUENCIES.forEach((frequency, index) => {
      state.eq[frequency] = EQ_PRESETS[name][index];
    });
    refreshEqUI();
    savePreferences();
    showToast(`Equalizer preset: ${name}.`, "eq");
  }

  /* ---------- Actions ---------- */

  async function handleAction(action, node) {
    switch (action) {
      case "go-home":
        navigate("home");
        break;
      case "history-back":
        goHistory(-1);
        break;
      case "history-forward":
        goHistory(1);
        break;
      case "import-files":
        el.fileInput.click();
        break;
      case "import-folder":
        el.folderInput.click();
        break;
      case "import-url":
        openImportUrl();
        break;
      case "add-starter":
        addStarterTracks();
        break;
      case "open-settings":
        openSettings();
        break;
      case "new-playlist":
        openCreatePlaylist();
        break;
      case "export-playlist":
        exportPlaylist(node.dataset.id);
        break;
      case "import-playlist":
        importPlaylistFile();
        break;
      case "remove-duplicates":
        removeDuplicates();
        break;
      case "new-playlist-with-track":
        closeModal();
        openCreatePlaylist(node.dataset.trackId || null);
        break;
      case "open-playlist":
        navigate("playlist", { id: node.dataset.id });
        break;
      case "open-album":
        navigate("album", { key: decodeURIComponent(node.dataset.key || "") });
        break;
      case "open-artist":
        navigate("artist", { name: decodeURIComponent(node.dataset.artist || "") });
        break;
      case "rename-playlist":
        openRenamePlaylist(node.dataset.id);
        break;
      case "rename-track":
        openRenameTrack(contextTrackId || node.dataset.id);
        break;
      case "lyrics-track":
        openLyrics(contextTrackId || node.dataset.id);
        break;
      case "delete-playlist":
        deletePlaylist(node.dataset.id);
        break;
      case "choose-playlist":
        togglePlaylistMembership(node.dataset.playlistId, node.dataset.trackId);
        break;
      case "toggle-play":
        togglePlay();
        break;
      case "previous":
        previousTrack();
        break;
      case "next":
        nextTrack(false);
        break;
      case "seek-back":
        seekBy(-10);
        break;
      case "seek-forward":
        seekBy(10);
        break;
      case "cycle-speed":
        cyclePlaybackSpeed();
        break;
      case "toggle-mini":
        toggleMiniPlayer();
        break;
      case "play-library":
        playLibrary();
        break;
      case "shuffle-library":
        shuffleLibrary();
        break;
      case "play-view":
        playView();
        break;
      case "shuffle-view":
        shuffleView();
        break;
      case "play-index":
        playFromView(Number(node.dataset.index));
        break;
      case "play-id":
        playById(node.dataset.id);
        break;
      case "play-queue":
        playQueueIndex(Number(node.dataset.index));
        break;
      case "remove-queue":
        removeQueueIndex(Number(node.dataset.index));
        break;
      case "clear-queue":
        clearQueue();
        break;
      case "toggle-shuffle":
        toggleShuffle();
        break;
      case "cycle-repeat":
        cycleRepeat();
        break;
      case "toggle-mute":
        toggleMute();
        break;
      case "toggle-current-favorite": {
        const track = currentTrack();
        if (track) toggleFavorite(track.id);
        break;
      }
      case "toggle-favorite":
        toggleFavorite(node.dataset.id);
        break;
      case "track-menu":
        showTrackMenu(node.dataset.id, node);
        break;
      case "play":
        if (contextTrackId) playById(contextTrackId);
        hideContextMenu();
        break;
      case "play-next":
        if (contextTrackId) queueAddNext(contextTrackId);
        hideContextMenu();
        break;
      case "add-queue":
        if (contextTrackId) queueAdd(contextTrackId);
        hideContextMenu();
        break;
      case "copy-youtube-link": {
        const t = contextTrackId ? findTrack(contextTrackId) : null;
        if (t && t.youtubeUrl) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(t.youtubeUrl);
            else {
              const ta = document.createElement("textarea"); ta.value = t.youtubeUrl; ta.style.position="fixed"; ta.style.opacity="0";
              document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
            }
            showToast("YouTube link copied.", "check", 2600);
          } catch (_) { showToast("Could not copy the link.", "download", 3000); }
        }
        hideContextMenu();
        break;
      }
      case "add-to-playlist":
        if (contextTrackId) openAddToPlaylist(contextTrackId);
        hideContextMenu();
        break;
      case "toggle-favorite-context":
        if (contextTrackId) toggleFavorite(contextTrackId);
        hideContextMenu();
        break;
      case "go-album": {
        const track = contextTrackId ? findTrack(contextTrackId) : null;
        hideContextMenu();
        if (track) navigate("album", { key: track.albumKey || albumKeyFor(track) });
        break;
      }
      case "go-artist": {
        const track = contextTrackId ? findTrack(contextTrackId) : null;
        hideContextMenu();
        if (track) navigate("artist", { name: track.artist || UNKNOWN_ARTIST });
        break;
      }
      case "remove-from-playlist":
        if (state.view.type === "playlist" && contextTrackId) removeFromPlaylist(state.view.id, contextTrackId);
        hideContextMenu();
        break;
      case "remove-library":
        if (contextTrackId) removeTrackFromLibrary(contextTrackId);
        hideContextMenu();
        break;
      case "toggle-now":
        if (window.innerWidth <= 1160) {
          document.body.classList.toggle("now-open");
        } else {
          state.nowTab = "queue";
          updateNowTab();
        }
        break;
      case "toggle-eq":
        state.nowTab = "eq";
        updateNowTab();
        if (window.innerWidth <= 1160) document.body.classList.add("now-open");
        break;
      case "toggle-nav":
        document.body.classList.toggle("nav-open");
        break;
      case "close-modal":
        closeModal();
        break;
      case "agree-policy":
        safeLocalSet("mparia-agreed", "1");
        closeModal();
        break;
      case "close-yt":
        closeYouTubePlayer();
        break;
      case "run-confirm": {
        const callback = confirmCallback;
        closeModal();
        if (callback) await callback();
        break;
      }
      case "set-theme":
        applyTheme(node.dataset.theme, true);
        break;
      case "clear-library":
        clearLibrary();
        break;
      case "sleep-timer":
        openSleepTimer();
        break;
      case "set-sleep":
        setSleepTimer(node.dataset.minutes);
        break;
      case "cancel-import":
        state.importCancelled = true;
        setImportProgress("Finishing current file…", "The import will stop after this one.");
        break;
      case "reload":
        location.reload();
        break;
      case "nav-home":
        navigate("home");
        break;
      case "nav-songs":
        navigate("songs");
        break;
      case "nav-albums":
        navigate("albums");
        break;
      case "nav-artists":
        navigate("artists");
        break;
      case "nav-playlists":
        navigate("playlists");
        break;
      case "nav-favorites":
        navigate("favorites");
        break;
      default:
        break;
    }
  }

  /* ---------- Restore session and boot ---------- */

  async function restoreSession() {
    const session = await window.MPAriaDB.getSetting("player", null);
    if (!session) return;
    state.volume = Number.isFinite(Number(session.volume)) ? Math.max(0, Math.min(1, Number(session.volume))) : state.volume;
    state.muted = Boolean(session.muted);
    state.shuffle = Boolean(session.shuffle);
    state.repeat = ["off", "all", "one"].includes(session.repeat) ? session.repeat : "off";

    const queue = Array.isArray(session.queue) ? session.queue.filter((id) => state.tracksById.has(id)) : [];
    const baseQueue = Array.isArray(session.baseQueue) ? session.baseQueue.filter((id) => state.tracksById.has(id)) : [];
    const currentId = session.currentTrackId && state.tracksById.has(session.currentTrackId) ? session.currentTrackId : null;

    state.currentTrackId = currentId;
    state.queue = queue;
    state.baseQueue = baseQueue.length ? baseQueue : queue.slice();
    state.queueIndex = Number.isInteger(session.queueIndex) ? session.queueIndex : (currentId ? 0 : -1);
    state.queueLabel = session.queueLabel || "";
    if (currentId && !state.queue.includes(currentId)) state.queue = [currentId, ...state.queue];
    if (!state.queue.length) state.queueIndex = -1;
    else state.queueIndex = Math.max(0, Math.min(state.queueIndex, state.queue.length - 1));
    el.audio.volume = state.muted ? 0 : state.volume;
    updateQueueUI();
  }

  function openPolicyModal() {
    openModal(`<div class="modal-head">
      <div><h2 id="modalTitle">Welcome to MPAria</h2><p>Read and agree before using the app.</p></div>
    </div>
    <div style="font-size:12px;line-height:1.65;color:var(--text);max-height:52vh;overflow:auto;padding-right:4px">
      <p>Welcome to MPAria. This app stores your music locally on this Mac and never uploads your files. You are responsible for the content you import. Do not import or share copyrighted music you do not own or have rights to use. MPAria is a player for your personal collection and legal downloads only. To use the app, add music with the Add Music button, then browse songs, albums, and artists. Create playlists, search your library, and use the player bar to play, pause, skip, shuffle, repeat, and adjust volume. Import from URL accepts only YouTube links and saves them as playable items. You can rename songs, clear your library, and change themes in Settings. Storage is limited to 25 GB. By continuing, you agree to respect copyright laws and the app's local-only privacy model. Your library remains available even without an internet connection. Click Agree to Policy to enter MPAria and start listening.</p>
    </div>
    <div class="modal-actions"><button class="btn primary" data-action="agree-policy">Agree to Policy</button></div>`, {
      onMount(modal) {
        const btn = modal.querySelector('[data-action="agree-policy"]');
        if (btn) btn.addEventListener("click", () => {
          safeLocalSet("mparia-agreed", "1");
          closeModal();
        });
      }
    });
  }

  async function init() {
    bindEvents();
    applyTheme(safeLocalGet("mparia-theme") || "light");
    updateOnlineStatus();
    updateHistoryUI();

    try {
      const [tracks, playlists, preferences] = await Promise.all([
        window.MPAriaDB.allTracks(),
        window.MPAriaDB.allPlaylists(),
        window.MPAriaDB.getSetting("preferences", null)
      ]);

      state.tracks = Array.isArray(tracks) ? tracks : [];
      state.tracks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      state.tracksById = new Map(state.tracks.map((track) => [track.id, track]));
      state.playlists = Array.isArray(playlists) ? playlists.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) : [];
      state.playlistsById = new Map(state.playlists.map((playlist) => [playlist.id, playlist]));

      if (preferences) {
        if (preferences.eq && typeof preferences.eq === "object") {
          EQ_FREQUENCIES.forEach((frequency) => {
            const value = Number(preferences.eq[frequency]);
            if (Number.isFinite(value)) state.eq[frequency] = Math.max(-12, Math.min(12, value));
          });
        }
        if (preferences.eqPreset) state.eqPreset = preferences.eqPreset;
        if (preferences.sort) state.sort = preferences.sort;
        if (preferences.playbackRate) state.playbackRate = preferences.playbackRate;
        if (preferences.theme) applyTheme(preferences.theme);
        if (preferences.prefs && typeof preferences.prefs === "object") {
          state.prefs = Object.assign({}, state.prefs, preferences.prefs);
        }
      } else {
        state.sort = safeLocalGet("mparia-sort") || state.sort;
      }

      await restoreSession();
      initEqBands();
      render();
      updatePlayerUI();
      updateNowTab();
       updateStorageUI();
       registerServiceWorker();
       if (!safeLocalGet("mparia-agreed")) setTimeout(() => openPolicyModal(), 250);
       window.MPAriaDB.persistStorage().catch(() => {});
       setInterval(() => { window.MPAriaDB.persistStorage().catch(() => {}); }, 15000);
       window.addEventListener("beforeunload", () => { window.MPAriaDB.persistStorage().catch(() => {}); });
       window.addEventListener("pagehide", () => { window.MPAriaDB.persistStorage().catch(() => {}); });
    } catch (error) {
      console.error(error);
      renderStartupError(error);
    }
  }

  function renderStartupError(error) {
    const isFile = location.protocol === "file:";
    el.root.innerHTML = `<section class="empty-state">
      <div class="empty-art">${icon("wifi-off")}</div>
      <h2>Local library unavailable</h2>
      <p>${isFile
        ? "This browser blocked persistent storage for a file:// page. Open MPAria through its included launcher, or serve this folder over localhost to use the offline library."
        : "MPAria could not open its local database. Close any other MPAria tabs, check that private browsing is off, then try again."}</p>
      <div class="empty-actions">
        <button class="btn primary" data-action="reload">${icon("sparkle")} Try again</button>
        <button class="btn" data-action="import-files">${icon("plus")} Add music</button>
      </div>
      <p class="empty-note">${escapeHtml(error && error.message ? error.message : "Unknown storage error")}</p>
    </section>`;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline shell caching is a progressive enhancement.
    });
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    window.closeYouTubePlayer = closeYouTubePlayer;
    if (el.ytOverlay) el.ytOverlay.addEventListener("click", (event) => {
      if (event.target === el.ytOverlay) closeYouTubePlayer();
    });
    $("#importButton").addEventListener("click", () => el.fileInput.click());
    el.fileInput.addEventListener("change", () => {
      if (el.fileInput.files && el.fileInput.files.length) importFiles(el.fileInput.files);
      el.fileInput.value = "";
    });
    el.folderInput.addEventListener("change", () => {
      if (el.folderInput.files && el.folderInput.files.length) importFiles(el.folderInput.files);
      el.folderInput.value = "";
    });
    el.themeToggle.addEventListener("click", toggleTheme);

    document.addEventListener("click", (event) => {
      const actionNode = event.target.closest("[data-action]");
      if (actionNode) {
        event.preventDefault();
        const action = actionNode.dataset.action;
        const contextActions = ["play", "play-next", "add-queue", "add-to-playlist", "toggle-favorite-context", "go-album", "go-artist", "remove-from-playlist", "remove-library", "rename-track", "lyrics-track"];
        if (action !== "track-menu" && !contextActions.includes(action)) hideContextMenu();
        handleAction(action, actionNode);
        return;
      }

      const navNode = event.target.closest("[data-nav]");
      if (navNode) {
        event.preventDefault();
        navigate(navNode.dataset.nav);
        return;
      }

      if (!event.target.closest("#contextMenu")) hideContextMenu();

      const row = event.target.closest(".track-row");
      if (row && !event.target.closest("button, a, input")) {
        playFromView(Number(row.dataset.index));
      }
    });

    document.addEventListener("contextmenu", (event) => {
      const row = event.target.closest(".track-row");
      if (row && row.dataset.trackId) {
        event.preventDefault();
        const anchor = row.querySelector('.track-actions [data-action="track-menu"]') || row;
        showTrackMenu(row.dataset.trackId, anchor);
        return;
      }
      if (!event.target.closest("#contextMenu")) hideContextMenu();
    });

    el.nowPanel.addEventListener("click", (event) => {
      const tab = event.target.closest(".now-tab");
      if (!tab) return;
      state.nowTab = tab.dataset.nowTab;
      updateNowTab();
    });

    el.eqBands.addEventListener("input", (event) => {
      const input = event.target.closest("[data-eq-frequency]");
      if (!input) return;
      setEqValue(input.dataset.eqFrequency, input.value);
    });
    el.eqPreset.addEventListener("change", () => applyEqPreset(el.eqPreset.value));

    document.addEventListener("change", (event) => {
      const sortSelect = event.target.closest("#songSort");
      if (!sortSelect) return;
      state.sort = sortSelect.value;
      savePreferences();
      render();
    });

    el.globalSearch.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        updateSearchView(el.globalSearch.value.trim());
      }, 130);
    });

    el.progress.addEventListener("input", () => {
      const value = Number(el.progress.value);
      if (Number.isFinite(value) && Number.isFinite(el.audio.duration)) {
        el.audio.currentTime = value;
        updateProgressUI();
      }
    });

    el.volume.addEventListener("input", () => setVolume(el.volume.value));

    el.audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayerUI();
      startVisualizer();
      debounceSaveSession();
    });
    el.audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayerUI();
      stopVisualizer();
      debounceSaveSession();
    });
    el.audio.addEventListener("timeupdate", () => {
      updateProgressUI();
      if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
        const duration = el.audio.duration;
        if (Number.isFinite(duration) && duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration,
              playbackRate: el.audio.playbackRate || 1,
              position: Math.min(el.audio.currentTime, duration)
            });
          } catch (_) { /* some browsers reject frequent updates */ }
        }
      }
    });
    el.audio.addEventListener("loadedmetadata", () => {
      const track = currentTrack();
      if (track && !track.duration && Number.isFinite(el.audio.duration)) {
        track.duration = el.audio.duration;
        window.MPAriaDB.updateTrack(track).catch(() => {});
      }
      updateProgressUI();
    });
    el.audio.addEventListener("ended", () => {
      if (state.sleepAtEnd) {
        state.sleepAtEnd = false;
        el.audio.pause();
        showToast("Sleep timer — playback paused.", "clock");
        return;
      }
      if (state.repeat === "one") {
        el.audio.currentTime = 0;
        el.audio.play().catch(() => {});
        return;
      }
      if (!state.prefs.autoplayNext) {
        state.isPlaying = false;
        updatePlayerUI();
        saveSession();
        return;
      }
      nextTrack(true);
    });
    let lastErrorAt = 0;
    el.audio.addEventListener("error", () => {
      if (!currentAudioUrl) return;
      if (Date.now() - lastErrorAt < 2500) return;
      lastErrorAt = Date.now();
      state.isPlaying = false;
      updatePlayerUI();
      showToast("This audio file could not be decoded. Try MP3, M4A, FLAC, WAV or OGG.", "volume-mute", 4800);
    });

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = Boolean(target && target.closest && (target.closest("input, textarea, select, [contenteditable='true']") || target.tagName === "BUTTON" || target.tagName === "A"));
        if (event.key === "Escape") {
          if (!el.modalLayer.hidden) closeModal();
          else if (el.ytOverlay && !el.ytOverlay.hidden) closeYouTubePlayer();
          else if (!el.contextMenu.hidden) hideContextMenu();
        else if (document.body.classList.contains("now-open")) document.body.classList.remove("now-open");
        else if (document.body.classList.contains("nav-open")) document.body.classList.remove("nav-open");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        el.globalSearch.focus();
        el.globalSearch.select();
        return;
      }
      if (typing) return;
      if (event.code === "Space" && !event.target.closest(".queue-item")) {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        nextTrack(false);
      } else if (event.key === "ArrowLeft" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        previousTrack();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (el.audio.duration) el.audio.currentTime = Math.min(el.audio.duration, el.audio.currentTime + 5);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        el.audio.currentTime = Math.max(0, el.audio.currentTime - 5);
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key.toLowerCase() === "u") {
        restoreLastDeleted();
      } else if (event.key.toLowerCase() === "s") {
        toggleShuffle();
      } else if (event.key.toLowerCase() === "r") {
        cycleRepeat();
      } else if (event.key.toLowerCase() === "f") {
        const track = currentTrack();
        if (track) toggleFavorite(track.id);
      } else if (event.key === "/") {
        event.preventDefault();
        el.globalSearch.focus();
      }
    });

    // Row and queue keyboard access.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const queueItem = event.target.closest(".queue-item");
      if (queueItem && event.target === queueItem) {
        event.preventDefault();
        playQueueIndex(Number(queueItem.dataset.index));
      }
    });

    window.addEventListener("dragenter", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      event.preventDefault();
      dragDepth++;
      el.dropOverlay.classList.add("is-visible");
    });
    window.addEventListener("dragover", (event) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) event.preventDefault();
    });
    window.addEventListener("dragleave", (event) => {
      if (!event.dataTransfer) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) el.dropOverlay.classList.remove("is-visible");
    });
    window.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      el.dropOverlay.classList.remove("is-visible");
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        importFiles(event.dataTransfer.files);
      }
    });

    el.modalLayer.addEventListener("click", (event) => {
      if (event.target === el.modalLayer) closeModal();
    });

    window.addEventListener("beforeunload", saveSession);

    if ("mediaSession" in navigator) {
      const handlers = {
        play: () => togglePlay(),
        pause: () => el.audio.pause(),
        previoustrack: () => previousTrack(),
        nexttrack: () => nextTrack(false),
        stop: () => el.audio.pause(),
        seekbackward: (details) => { el.audio.currentTime = Math.max(0, el.audio.currentTime - (details.seekOffset || 10)); },
        seekforward: (details) => { el.audio.currentTime = Math.min(el.audio.duration || 0, el.audio.currentTime + (details.seekOffset || 10)); },
        seekto: (details) => { if (Number.isFinite(details.seekTime)) el.audio.currentTime = details.seekTime; }
      };
      Object.entries(handlers).forEach(([name, handler]) => {
        try { navigator.mediaSession.setActionHandler(name, handler); } catch (_) { /* unsupported action */ }
      });
    }
  }

  init();
})();
