/* MPAria's local database. Audio never leaves this machine. */
(function () {
  "use strict";

  const DB_NAME = "mparia-music-library";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("This browser does not support local storage for music."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("tracks")) {
          const tracks = db.createObjectStore("tracks", { keyPath: "id" });
          tracks.createIndex("addedAt", "addedAt");
          tracks.createIndex("artist", "artist");
          tracks.createIndex("albumKey", "albumKey");
          tracks.createIndex("favorite", "favorite");
        }
        if (!db.objectStoreNames.contains("audio")) {
          db.createObjectStore("audio", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("covers")) {
          db.createObjectStore("covers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("playlists")) {
          db.createObjectStore("playlists", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Could not open the local library."));
      };
      request.onblocked = () => {
        dbPromise = null;
        reject(new Error("Close other MPAria tabs and try again."));
      };
    });
    return dbPromise;
  }

  function wrap(request, transaction) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      if (transaction) {
        transaction.onabort = () => reject(transaction.error || new Error("Library transaction aborted."));
      }
    });
  }

  async function allTracks() {
    const db = await open();
    const tx = db.transaction("tracks", "readonly");
    return wrap(tx.objectStore("tracks").getAll(), tx);
  }

  async function allPlaylists() {
    const db = await open();
    const tx = db.transaction("playlists", "readonly");
    return wrap(tx.objectStore("playlists").getAll(), tx);
  }

  async function getTrack(id) {
    const db = await open();
    const tx = db.transaction("tracks", "readonly");
    return wrap(tx.objectStore("tracks").get(id), tx);
  }

  async function getAudio(id) {
    const db = await open();
    const tx = db.transaction("audio", "readonly");
    const record = await wrap(tx.objectStore("audio").get(id), tx);
    return record ? record.blob : null;
  }

  async function getCover(id) {
    const db = await open();
    const tx = db.transaction("covers", "readonly");
    const record = await wrap(tx.objectStore("covers").get(id), tx);
    return record ? record.blob : null;
  }

  async function putTrack(track, audioBlob, coverBlob) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["tracks", "audio", "covers"], "readwrite");
      tx.objectStore("tracks").put(track);
      tx.objectStore("audio").put({ id: track.id, blob: audioBlob });
      if (coverBlob) tx.objectStore("covers").put({ id: track.id, blob: coverBlob });
      tx.oncomplete = () => resolve(track);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Could not store audio."));
    });
  }

  async function updateTrack(track) {
    const db = await open();
    const tx = db.transaction("tracks", "readwrite");
    tx.objectStore("tracks").put(track);
    return wrap(tx.objectStore("tracks").get(track.id), tx);
  }

  async function deleteTrack(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["tracks", "audio", "covers"], "readwrite");
      tx.objectStore("tracks").delete(id);
      tx.objectStore("audio").delete(id);
      tx.objectStore("covers").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function putPlaylist(playlist) {
    const db = await open();
    const tx = db.transaction("playlists", "readwrite");
    tx.objectStore("playlists").put(playlist);
    return wrap(tx.objectStore("playlists").get(playlist.id), tx);
  }

  async function deletePlaylist(id) {
    const db = await open();
    const tx = db.transaction("playlists", "readwrite");
    tx.objectStore("playlists").delete(id);
    return wrap(tx.objectStore("playlists").count(), tx);
  }

  async function getSetting(key, fallback) {
    try {
      const db = await open();
      const tx = db.transaction("settings", "readonly");
      const record = await wrap(tx.objectStore("settings").get(key), tx);
      return record ? record.value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function setSetting(key, value) {
    try {
      const db = await open();
      const tx = db.transaction("settings", "readwrite");
      await wrap(tx.objectStore("settings").put({ key, value }), tx);
    } catch (_) {
      // Settings are a convenience; failure should never stop playback.
    }
  }

  async function clearLibrary() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["tracks", "audio", "covers", "playlists", "settings"], "readwrite");
      tx.objectStore("tracks").clear();
      tx.objectStore("audio").clear();
      tx.objectStore("covers").clear();
      tx.objectStore("playlists").clear();
      tx.objectStore("settings").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        return await navigator.storage.estimate();
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async function persistStorage() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist();
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  window.MPAriaDB = {
    open,
    allTracks,
    allPlaylists,
    getTrack,
    getAudio,
    getCover,
    putTrack,
    updateTrack,
    deleteTrack,
    putPlaylist,
    deletePlaylist,
    getSetting,
    setSetting,
    clearLibrary,
    storageEstimate,
    persistStorage
  };
})();
