/* MPAria Audio Lab — original, generated starter tracks.
   Everything here is synthesized locally in the browser, so the starter
   library works offline and carries no third-party audio rights. */
(function () {
  "use strict";

  const SAMPLE_RATE = 22050;

  const STARTERS = [
    {
      title: "Neon Skyline",
      artist: "MPAria Originals",
      album: "After Hours",
      genre: "Electronic",
      year: "2026",
      bpm: 92,
      duration: 32,
      root: 45,
      chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 3], [-5, -1, 2, 5]],
      colors: ["#4d2f63", "#ff7a59", "#15101c"],
      seed: 7,
      brightness: 1.0
    },
    {
      title: "Warm Static",
      artist: "MPAria Originals",
      album: "Soft Focus",
      genre: "Lo-fi",
      year: "2026",
      bpm: 74,
      duration: 29,
      root: 41,
      chords: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-7, -3, 0, 4]],
      colors: ["#6b4b3c", "#d6a06d", "#19120f"],
      seed: 21,
      brightness: 0.76
    },
    {
      title: "Sunday Light",
      artist: "MPAria Originals",
      album: "Quiet Rooms",
      genre: "Ambient",
      year: "2026",
      bpm: 61,
      duration: 34,
      root: 48,
      chords: [[0, 4, 7, 12], [-5, 0, 4, 9], [-3, 2, 7, 11], [-7, 0, 4, 7]],
      colors: ["#355e62", "#9ad7c8", "#0d1b1d"],
      seed: 39,
      brightness: 0.9
    }
  ];

  function midiToHz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function addTone(buffer, startSec, durationSec, frequency, volume, shape, attack = 0.02, release = 0.25) {
    const start = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
    const length = Math.floor(durationSec * SAMPLE_RATE);
    const end = Math.min(buffer.length, start + length);
    const attackSamples = Math.max(1, Math.floor(attack * SAMPLE_RATE));
    const releaseSamples = Math.max(1, Math.floor(release * SAMPLE_RATE));
    const twoPi = Math.PI * 2;

    for (let i = 0; i < end - start; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.min(1, i / attackSamples, (end - start - i) / releaseSamples);
      const sine = Math.sin(twoPi * frequency * t);
      let sample = sine;
      if (shape === "triangle") sample = (2 / Math.PI) * Math.asin(sine);
      else if (shape === "warm") sample = sine * 0.72 + Math.sin(twoPi * frequency * 2 * t) * 0.18 + Math.sin(twoPi * frequency * 3 * t) * 0.06;
      else if (shape === "pluck") sample = sine * Math.exp(-t * 5.5);
      else if (shape === "organ") sample = sine * 0.6 + Math.sin(twoPi * frequency * 0.5 * t) * 0.24 + Math.sin(twoPi * frequency * 2 * t) * 0.13;
      buffer[start + i] += sample * envelope * volume;
    }
  }

  function addKick(buffer, startSec, volume) {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const length = Math.floor(0.24 * SAMPLE_RATE);
    for (let i = 0; i < length && start + i < buffer.length; i++) {
      const t = i / SAMPLE_RATE;
      const frequency = 96 - t * 300;
      const envelope = Math.exp(-t * 15);
      buffer[start + i] += Math.sin(Math.PI * 2 * Math.max(38, frequency) * t) * envelope * volume;
    }
  }

  function addHat(buffer, startSec, volume, rng) {
    const start = Math.floor(startSec * SAMPLE_RATE);
    const length = Math.floor(0.045 * SAMPLE_RATE);
    for (let i = 0; i < length && start + i < buffer.length; i++) {
      const envelope = Math.exp(-(i / SAMPLE_RATE) * 95);
      buffer[start + i] += (rng() * 2 - 1) * envelope * volume;
    }
  }

  function synthesize(spec) {
    const duration = spec.duration;
    const buffer = new Float32Array(Math.floor(duration * SAMPLE_RATE));
    const rng = random(spec.seed);
    const beat = 60 / spec.bpm;
    const bar = beat * 4;
    const chordLength = bar;
    const chordCount = Math.ceil(duration / chordLength);
    const isAmbient = spec.genre === "Ambient";
    const isLoFi = spec.genre === "Lo-fi";

    // Bed of chords.
    for (let barIndex = 0; barIndex < chordCount; barIndex++) {
      const chord = spec.chords[barIndex % spec.chords.length];
      const start = barIndex * chordLength;
      chord.forEach((interval, noteIndex) => {
        const note = spec.root + interval;
        addTone(buffer, start, chordLength + 0.35, midiToHz(note), isAmbient ? 0.09 : 0.055, "warm", 0.42, 0.7);
        if (noteIndex === 0) {
          addTone(buffer, start, chordLength, midiToHz(note - 12), isAmbient ? 0.115 : 0.09, "organ", 0.1, 0.5);
        }
      });

      // Arpeggio / melodic pattern.
      const pattern = isAmbient ? [0, 2, 1, 3, 2, 1] : [0, 2, 1, 3, 2, 3, 1, 2];
      const step = isAmbient ? beat * 1.25 : beat / 2;
      const notes = Math.floor(chordLength / step);
      for (let i = 0; i < notes; i++) {
        const interval = chord[pattern[i % pattern.length]] + (i % 4 === 3 ? 12 : 0);
        const note = spec.root + 12 + interval;
        const volume = (isAmbient ? 0.065 : isLoFi ? 0.055 : 0.05) * spec.brightness;
        addTone(buffer, start + i * step, isAmbient ? 1.8 : 0.52, midiToHz(note), volume, "pluck", 0.008, 0.36);
      }

      // Gentle kick / texture.
      if (!isAmbient) {
        for (let b = 0; b < 4; b++) {
          addKick(buffer, start + b * beat, b === 0 || b === 2 ? 0.15 : 0.085);
          addHat(buffer, start + b * beat + beat * 0.5, isLoFi ? 0.014 : 0.02, rng);
        }
      }
    }

    // Add a sparse top-line melody in the second half.
    const leadStart = Math.floor(duration * 0.46);
    const leadStep = beat * 2;
    for (let i = 0; leadStart + i * leadStep < duration - 2; i++) {
      const chord = spec.chords[Math.floor((leadStart + i * leadStep) / chordLength) % spec.chords.length];
      const note = spec.root + 24 + chord[(i * 3) % chord.length];
      addTone(buffer, leadStart + i * leadStep, 1.7, midiToHz(note), isAmbient ? 0.045 : 0.05, isLoFi ? "triangle" : "warm", 0.18, 0.6);
    }

    // Simple stereo-ish delay and a tiny amount of air.
    const delaySamples = Math.floor((isAmbient ? 0.42 : 0.31) * SAMPLE_RATE);
    for (let i = delaySamples; i < buffer.length; i++) {
      buffer[i] += buffer[i - delaySamples] * 0.18;
    }

    // Fade edges, then normalize.
    const fade = Math.floor(1.4 * SAMPLE_RATE);
    let peak = 0.0001;
    for (let i = 0; i < buffer.length; i++) {
      const edge = Math.min(1, i / fade, (buffer.length - 1 - i) / fade);
      buffer[i] *= edge;
      peak = Math.max(peak, Math.abs(buffer[i]));
    }
    const gain = 0.86 / peak;
    for (let i = 0; i < buffer.length; i++) buffer[i] *= gain;

    return encodeWav(buffer);
  }

  function encodeWav(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    let offset = 0;

    const writeString = (text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset++, text.charCodeAt(i));
    };

    writeString("RIFF");
    view.setUint32(offset, 36 + samples.length * 2, true);
    offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true); // PCM
    offset += 2;
    view.setUint16(offset, 1, true); // mono
    offset += 2;
    view.setUint32(offset, SAMPLE_RATE, true);
    offset += 4;
    view.setUint32(offset, SAMPLE_RATE * 2, true);
    offset += 4;
    view.setUint16(offset, 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString("data");
    view.setUint32(offset, samples.length * 2, true);
    offset += 4;

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function makeCover(spec) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 700;
      canvas.height = 700;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      const gradient = ctx.createLinearGradient(0, 0, 700, 700);
      gradient.addColorStop(0, spec.colors[0]);
      gradient.addColorStop(0.55, spec.colors[1]);
      gradient.addColorStop(1, spec.colors[2]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 700, 700);

      const glow = ctx.createRadialGradient(530, 120, 0, 530, 120, 330);
      glow.addColorStop(0, "rgba(255,255,255,0.35)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 700, 700);

      // Concentric rings, like a stylized record.
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.4;
      for (let r = 90; r < 390; r += 29) {
        ctx.beginPath();
        ctx.arc(360, 330, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(10,10,16,0.26)";
      ctx.beginPath();
      ctx.arc(360, 330, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(360, 330, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.arc(360, 330, 14, 0, Math.PI * 2);
      ctx.fill();

      // Waveform strip.
      const rng = random(spec.seed + 8);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (let i = 0; i < 42; i++) {
        const height = 5 + rng() * 31;
        ctx.fillRect(80 + i * 13, 615 - height / 2, 4, height);
      }

      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "600 17px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
      ctx.letterSpacing = "4px";
      ctx.fillText("MPARIA ORIGINALS", 77, 78);

      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.font = "700 51px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
      ctx.fillText(spec.title, 74, 506);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 22px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
      ctx.fillText(spec.album, 77, 540);

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }

  async function createStarterTracks(onProgress) {
    const results = [];
    for (let i = 0; i < STARTERS.length; i++) {
      const spec = STARTERS[i];
      if (onProgress) onProgress(i + 1, STARTERS.length, spec.title);
      // Let the UI paint before the synthesis loop starts.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const wav = synthesize(spec);
      const cover = await makeCover(spec);
      const file = new File(
        [wav],
        `${spec.artist} - ${spec.title}.wav`,
        { type: "audio/wav", lastModified: Date.now() }
      );
      results.push({
        file,
        tags: {
          title: spec.title,
          artist: spec.artist,
          album: spec.album,
          albumArtist: spec.artist,
          genre: spec.genre,
          year: spec.year,
          track: String(i + 1)
        },
        cover,
        slug: slug(spec.title)
      });
    }
    return results;
  }

  window.MPAriaAudioLab = { createStarterTracks };
})();
