/* MPAria tag reader — dependency-free ID3v2, MP4 and FLAC metadata.
   It intentionally reads only metadata; audio bytes are never modified. */
(function () {
  "use strict";

  const EMPTY = Object.freeze({
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    year: "",
    genre: "",
    track: "",
    disc: "",
    artwork: null,
    artworkMime: "",
    source: ""
  });

  const decoderUtf8 = new TextDecoder("utf-8");
  const decoderLatin1 = new TextDecoder("windows-1252");
  const decoderUtf16le = new TextDecoder("utf-16le");
  const decoderUtf16be = new TextDecoder("utf-16be");

  function bytesToAscii(bytes, start, end) {
    let out = "";
    for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function syncSafe(bytes, offset) {
    return ((bytes[offset] & 0x7f) << 21) |
      ((bytes[offset + 1] & 0x7f) << 14) |
      ((bytes[offset + 2] & 0x7f) << 7) |
      (bytes[offset + 3] & 0x7f);
  }

  function uint32(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0) +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3];
  }

  function uint24(bytes, offset) {
    return (bytes[offset] << 16) + (bytes[offset + 1] << 8) + bytes[offset + 2];
  }

  function cleanText(value) {
    if (!value) return "";
    return value
      .replace(/\u0000+$/g, "")
      .replace(/\u0000/g, " / ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function decodeText(bytes, encoding, start, end, stopAtNull) {
    start = Math.max(0, start || 0);
    end = Math.min(bytes.length, end == null ? bytes.length : end);
    if (end <= start) return { text: "", next: end };

    let next = end;
    let bodyEnd = end;

    if (stopAtNull) {
      if (encoding === 1 || encoding === 2) {
        for (let i = start; i + 1 < end; i += 2) {
          if (bytes[i] === 0 && bytes[i + 1] === 0) {
            bodyEnd = i;
            next = i + 2;
            break;
          }
        }
      } else {
        for (let i = start; i < end; i++) {
          if (bytes[i] === 0) {
            bodyEnd = i;
            next = i + 1;
            break;
          }
        }
      }
    }

    let text = "";
    try {
      if (encoding === 1) {
        if (bytes[start] === 0xff && bytes[start + 1] === 0xfe) {
          text = decoderUtf16le.decode(bytes.subarray(start + 2, bodyEnd));
        } else if (bytes[start] === 0xfe && bytes[start + 1] === 0xff) {
          text = decoderUtf16be.decode(bytes.subarray(start + 2, bodyEnd));
        } else {
          text = decoderUtf16le.decode(bytes.subarray(start, bodyEnd));
        }
      } else if (encoding === 2) {
        text = decoderUtf16be.decode(bytes.subarray(start, bodyEnd));
      } else if (encoding === 3) {
        text = decoderUtf8.decode(bytes.subarray(start, bodyEnd));
      } else {
        text = decoderLatin1.decode(bytes.subarray(start, bodyEnd));
      }
    } catch (_) {
      text = "";
    }

    return { text: cleanText(text), next };
  }

  function textFrame(bytes, offset, size) {
    if (!size) return "";
    const encoding = bytes[offset] || 0;
    return decodeText(bytes, encoding, offset + 1, offset + size, false).text;
  }

  function pictureFrame(bytes, offset, size, frameId) {
    if (!size) return null;
    const encoding = bytes[offset] || 0;
    let cursor = offset + 1;
    const end = offset + size;

    let mime = "";
    if (frameId === "PIC") {
      // ID3v2.2 "PIC" uses a 3-character image format with no null terminator.
      mime = "image/" + cleanText(bytesToAscii(bytes, cursor, Math.min(cursor + 3, end))).toLowerCase().replace("jpg", "jpeg");
      cursor += 3;
    } else {
      let mimeEnd = cursor;
      while (mimeEnd < end && bytes[mimeEnd] !== 0) mimeEnd++;
      mime = cleanText(bytesToAscii(bytes, cursor, mimeEnd)).toLowerCase();
      cursor = Math.min(mimeEnd + 1, end);
    }

    if (cursor >= end) return null;
    cursor++; // picture type

    const description = decodeText(bytes, encoding, cursor, end, true);
    cursor = description.next;
    if (cursor >= end) return null;

    const imageBytes = bytes.slice(cursor, end);
    if (imageBytes.length < 24) return null;

    if (!mime || mime === "image/jpg") mime = "image/jpeg";
    if (!/^image\//i.test(mime)) mime = guessImageMime(imageBytes);

    return {
      blob: new Blob([imageBytes], { type: mime }),
      mime
    };
  }

  function guessImageMime(bytes) {
    if (!bytes || bytes.length < 4) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
    return "image/jpeg";
  }

  function merge(base, frameId, value) {
    if (!value) return;
    switch (frameId) {
      case "TIT2":
      case "TT2":
        base.title = value;
        break;
      case "TPE1":
      case "TP1":
        base.artist = value;
        break;
      case "TPE2":
      case "TP2":
        base.albumArtist = value;
        break;
      case "TALB":
      case "TAL":
        base.album = value;
        break;
      case "TDRC":
      case "TYER":
      case "TYE":
      case "TDAT":
        if (!base.year || frameId === "TDRC") base.year = value.slice(0, 10);
        break;
      case "TCON":
      case "TCO":
        base.genre = value.replace(/^\(\d+\)\s*/, "");
        break;
      case "TRCK":
      case "TRK":
        base.track = value;
        break;
      case "TPOS":
      case "TPA":
        base.disc = value;
        break;
      default:
        break;
    }
  }

  function parseId3v2(bytes) {
    const result = { ...EMPTY };
    if (bytes.length < 10) return result;
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return result;

    const version = bytes[3];
    const flags = bytes[5];
    let tagSize = syncSafe(bytes, 6);
    const tagEnd = Math.min(bytes.length, 10 + tagSize);
    let offset = 10;

    if (flags & 0x40) {
      if (version === 4) {
        const extSize = syncSafe(bytes, offset);
        offset += Math.max(extSize, 6);
      } else {
        const extSize = uint32(bytes, offset);
        offset += 4 + extSize;
      }
    }

    if (flags & 0x10) tagSize += 10; // footer

    const idLength = version === 2 ? 3 : 4;
    const headerLength = version === 2 ? 6 : 10;
    let guard = 0;

    while (offset + headerLength <= tagEnd && guard++ < 4096) {
      const id = bytesToAscii(bytes, offset, offset + idLength);
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;

      let size;
      if (version === 2) {
        size = uint24(bytes, offset + 3);
      } else if (version === 4) {
        size = syncSafe(bytes, offset + 4);
      } else {
        size = uint32(bytes, offset + 4);
      }

      const frameFlags = version === 2 ? 0 : ((bytes[offset + 8] << 8) | bytes[offset + 9]);
      const dataStart = offset + headerLength;
      if (size < 0 || dataStart + size > tagEnd) break;

      // Compression (0x0080) and encryption (0x0040) are uncommon and
      // deliberately skipped rather than guessed at.
      if (!(frameFlags & 0x00c0)) {
        if (id === "APIC" || id === "PIC") {
          const pic = pictureFrame(bytes, dataStart, size, id);
          if (pic) {
            result.artwork = pic.blob;
            result.artworkMime = pic.mime;
          }
        } else if (id[0] === "T") {
          merge(result, id, textFrame(bytes, dataStart, size));
        }
      }

      offset = dataStart + size;
    }

    result.source = "id3v2." + version;
    return result;
  }

  function parseId3v1(bytes) {
    const result = { ...EMPTY };
    if (!bytes || bytes.length < 128) return result;
    const start = bytes.length - 128;
    if (bytes[start] !== 0x54 || bytes[start + 1] !== 0x41 || bytes[start + 2] !== 0x47) return result;

    const field = (a, b) => cleanText(decoderLatin1.decode(bytes.subarray(start + a, start + b)));
    result.title = field(3, 33);
    result.artist = field(33, 63);
    result.album = field(63, 93);
    result.year = field(93, 97);
    const comment = field(97, 127);
    result.genre = comment && !result.title ? comment : "";
    if (bytes[start + 125] === 0 && bytes[start + 126] !== 0) {
      result.track = String(bytes[start + 126]);
    }
    result.source = "id3v1";
    return result;
  }

  function parseFlac(bytes) {
    const result = { ...EMPTY };
    if (bytes.length < 8 || bytes[0] !== 0x66 || bytes[1] !== 0x4c || bytes[2] !== 0x61 || bytes[3] !== 0x43) return result;

    let offset = 4;
    let guard = 0;
    while (offset + 4 <= bytes.length && guard++ < 256) {
      const header = bytes[offset];
      const isLast = (header & 0x80) !== 0;
      const type = header & 0x7f;
      const length = uint24(bytes, offset + 1);
      const start = offset + 4;
      const end = Math.min(bytes.length, start + length);
      if (end <= start) break;

      if (type === 4) {
        let cursor = start;
        if (cursor + 4 > end) break;
        const vendorLength = bytes[cursor] | (bytes[cursor + 1] << 8) | (bytes[cursor + 2] << 16) | (bytes[cursor + 3] << 24);
        cursor += 4 + Math.max(0, vendorLength);
        if (cursor + 4 > end) break;
        const count = bytes[cursor] | (bytes[cursor + 1] << 8) | (bytes[cursor + 2] << 16) | (bytes[cursor + 3] << 24);
        cursor += 4;

        for (let i = 0; i < Math.min(count, 512) && cursor + 4 <= end; i++) {
          const len = bytes[cursor] | (bytes[cursor + 1] << 8) | (bytes[cursor + 2] << 16) | (bytes[cursor + 3] << 24);
          cursor += 4;
          if (len < 0 || cursor + len > end) break;
          const line = decoderUtf8.decode(bytes.subarray(cursor, cursor + len));
          cursor += len;
          const split = line.indexOf("=");
          if (split < 1) continue;
          const key = line.slice(0, split).toUpperCase();
          const value = cleanText(line.slice(split + 1));
          if (key === "TITLE") result.title = value;
          else if (key === "ARTIST") result.artist = value;
          else if (key === "ALBUM") result.album = value;
          else if (key === "ALBUMARTIST") result.albumArtist = value;
          else if (key === "DATE") result.year = value.slice(0, 10);
          else if (key === "GENRE") result.genre = value;
          else if (key === "TRACKNUMBER") result.track = value;
          else if (key === "DISCNUMBER") result.disc = value;
        }
      } else if (type === 6) {
        let cursor = start;
        if (cursor + 8 > end) break;
        const mimeLength = uint32(bytes, cursor);
        cursor += 4;
        if (mimeLength < 0 || cursor + mimeLength > end) break;
        const mime = cleanText(bytesToAscii(bytes, cursor, cursor + mimeLength)).toLowerCase();
        cursor += mimeLength;
        if (cursor + 4 > end) break;
        const descLength = uint32(bytes, cursor);
        cursor += 4 + Math.max(0, descLength);
        if (cursor + 20 > end) break;
        cursor += 16; // dimensions and depth
        if (cursor + 4 > end) break;
        const dataLength = uint32(bytes, cursor);
        cursor += 4;
        if (dataLength > 0 && cursor + dataLength <= end) {
          const imageBytes = bytes.slice(cursor, cursor + dataLength);
          const actualMime = mime && /^image\//.test(mime) ? mime : guessImageMime(imageBytes);
          result.artwork = new Blob([imageBytes], { type: actualMime });
          result.artworkMime = actualMime;
        }
      }

      offset = end;
      if (isLast) break;
    }

    result.source = "flac";
    return result;
  }

  /* ---------- MP4 / M4A ---------- */

  function atomType(bytes, offset) {
    return bytesToAscii(bytes, offset, offset + 4);
  }

  function findAtom(bytes, start, end, name, maxDepth) {
    let offset = start;
    let guard = 0;
    while (offset + 8 <= end && guard++ < 10000) {
      const size = uint32(bytes, offset);
      const type = atomType(bytes, offset + 4);
      let header = 8;
      let actualSize = size;
      if (size === 1) {
        if (offset + 16 > end) break;
        const high = uint32(bytes, offset + 8);
        const low = uint32(bytes, offset + 12);
        actualSize = high * 4294967296 + low;
        header = 16;
      } else if (size === 0) {
        actualSize = end - offset;
      }
      if (actualSize < header || offset + actualSize > end) break;

      if (type === name) return { start: offset + header, end: offset + actualSize, size: actualSize };
      offset += actualSize;
    }
    return null;
  }

  function findPath(bytes, start, end, path) {
    let current = { start, end };
    for (const name of path) {
      const found = findAtom(bytes, current.start, current.end, name);
      if (!found) return null;
      current = found;
    }
    return current;
  }

  function parseMp4(bytes) {
    const result = { ...EMPTY };
    if (bytes.length < 12) return result;
    const moov = findAtom(bytes, 0, bytes.length, "moov");
    if (!moov) return result;

    let ilst = null;
    const udta = findAtom(bytes, moov.start, moov.end, "udta");
    if (udta) {
      const meta = findAtom(bytes, udta.start, udta.end, "meta");
      if (meta) {
        // "meta" is a full box with a 4-byte version/flags prefix.
        ilst = findAtom(bytes, meta.start + 4, meta.end, "ilst");
      }
    }

    if (!ilst) {
      const meta = findAtom(bytes, moov.start, moov.end, "meta");
      if (meta) ilst = findAtom(bytes, meta.start + 4, meta.end, "ilst");
    }

    if (!ilst) return result;

    let offset = ilst.start;
    let guard = 0;
    while (offset + 8 <= ilst.end && guard++ < 512) {
      const size = uint32(bytes, offset);
      if (size < 8 || offset + size > ilst.end) break;
      const name = atomType(bytes, offset + 4);
      const itemStart = offset + 8;
      const itemEnd = offset + size;

      const dataAtom = findAtom(bytes, itemStart, itemEnd, "data");
      if (dataAtom && dataAtom.start + 8 <= dataAtom.end) {
        const dataType = (uint32(bytes, dataAtom.start) & 0x00ffffff);
        const payloadStart = dataAtom.start + 8;
        const payloadEnd = dataAtom.end;

        if ((name === "\u00a9nam" || name === "\u00a9ART" || name === "\u00a9alb" ||
             name === "aART" || name === "\u00a9day" || name === "\u00a9gen" ||
             name === "\u00a9wrt" || name === "\u00a9too") && dataType !== 13 && dataType !== 14) {
          const value = cleanText(decoderUtf8.decode(bytes.subarray(payloadStart, payloadEnd)));
          if (name === "\u00a9nam") result.title = value;
          else if (name === "\u00a9ART") result.artist = value;
          else if (name === "\u00a9alb") result.album = value;
          else if (name === "aART") result.albumArtist = value;
          else if (name === "\u00a9day") result.year = value.slice(0, 10);
          else if (name === "\u00a9gen") result.genre = value;
        } else if (name === "trkn" && payloadStart + 4 <= payloadEnd) {
          result.track = String((bytes[payloadStart + 2] << 8) | bytes[payloadStart + 3]);
        } else if (name === "disk" && payloadStart + 4 <= payloadEnd) {
          result.disc = String((bytes[payloadStart + 2] << 8) | bytes[payloadStart + 3]);
        } else if (name === "covr" && payloadEnd > payloadStart) {
          const imageBytes = bytes.slice(payloadStart, payloadEnd);
          const mime = dataType === 14 ? "image/png" : dataType === 13 ? "image/jpeg" : guessImageMime(imageBytes);
          result.artwork = new Blob([imageBytes], { type: mime });
          result.artworkMime = mime;
        }
      }

      offset += size;
    }

    result.source = "mp4";
    return result;
  }

  function parse(file, headBytes, tailBytes) {
    const result = { ...EMPTY };
    try {
      const bytes = headBytes instanceof Uint8Array ? headBytes : new Uint8Array(headBytes);
      const ext = (file && file.name ? file.name : "").split(".").pop().toLowerCase();

      let parsed = parseId3v2(bytes);
      if (!parsed.title && !parsed.artist && !parsed.album) {
        if (ext === "m4a" || ext === "mp4" || ext === "aac") {
          const mp4 = parseMp4(bytes);
          if (mp4.title || mp4.artist || mp4.album || mp4.artwork) parsed = mp4;
        } else if (ext === "flac") {
          const flac = parseFlac(bytes);
          if (flac.title || flac.artist || flac.album || flac.artwork) parsed = flac;
        }
      }

      if (!parsed.title && !parsed.artist && !parsed.album && tailBytes) {
        const v1 = parseId3v1(tailBytes instanceof Uint8Array ? tailBytes : new Uint8Array(tailBytes));
        if (v1.title || v1.artist || v1.album) parsed = v1;
      }

      return {
        title: cleanText(parsed.title),
        artist: cleanText(parsed.artist),
        album: cleanText(parsed.album),
        albumArtist: cleanText(parsed.albumArtist),
        year: cleanText(parsed.year),
        genre: cleanText(parsed.genre),
        track: cleanText(parsed.track),
        disc: cleanText(parsed.disc),
        artwork: parsed.artwork || null,
        artworkMime: parsed.artworkMime || "",
        source: parsed.source || ""
      };
    } catch (error) {
      return { ...EMPTY };
    }
  }

  window.MPAriaTags = { parse };
})();
