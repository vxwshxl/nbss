/**
 * The film's sound, synthesised here rather than licensed: a calm music bed
 * cut to exactly the film's length, and the interface sounds (click, typing,
 * whoosh, chime, ding, alert, alarm).
 *
 *   node scripts/audio.mjs      → public/audio/*.wav and music.mp3
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FPS, plan } from "../src/schedule.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "public", "audio");
fs.mkdirSync(OUT, { recursive: true });

const SR = 44100;
const TAU = Math.PI * 2;

// Deterministic noise, so every render sounds the same.
let seed = 12345;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function writeWav(file, left, right = left) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Scales a buffer so its loudest sample sits at `peak`. */
function normalise(bufs, peak) {
  let max = 0;
  for (const b of bufs) for (const v of b) max = Math.max(max, Math.abs(v));
  const k = max ? peak / max : 1;
  for (const b of bufs) for (let i = 0; i < b.length; i++) b[i] *= k;
}

// ─────────────────────────────────────────────────────────────── effects

function sfx(name, seconds, fn, peak = 0.8) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  // Ten-millisecond fade at both ends so nothing clicks.
  const edge = Math.round(0.01 * SR);
  for (let i = 0; i < edge; i++) {
    out[i] *= i / edge;
    out[n - 1 - i] *= i / edge;
  }
  normalise([out], peak);
  writeWav(path.join(OUT, `${name}.wav`), out);
}

function bell(t, f, decay = 3) {
  return (
    Math.exp(-decay * t) *
    (Math.sin(TAU * f * t) + 0.28 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-decay * 2 * t) + 0.1 * Math.sin(TAU * f * 3.99 * t) * Math.exp(-decay * 3 * t))
  );
}

let prev = 0;
sfx("click", 0.09, (t) => {
  const n = noise();
  const hp = n - prev;
  prev = n;
  return hp * 0.5 * Math.exp(-120 * t) + Math.sin(TAU * 1900 * t) * 0.5 * Math.exp(-90 * t) + Math.sin(TAU * 620 * t) * 0.35 * Math.exp(-60 * t);
}, 0.55);

sfx("type", 0.05, (t) => {
  const n = noise();
  const hp = n - prev;
  prev = n;
  return hp * Math.exp(-160 * t) * 0.6 + Math.sin(TAU * 2600 * t) * 0.2 * Math.exp(-200 * t);
}, 0.35);

{
  // A soft air sweep: noise through a resonant band-pass rising in pitch.
  let lp = 0;
  let bp = 0;
  sfx("whoosh", 1.0, (t) => {
    const f = 250 + 2200 * Math.pow(t / 1.0, 1.5);
    const q = 0.9;
    const w = 2 * Math.sin((Math.PI * f) / SR);
    lp += w * bp;
    const hp = noise() - lp - q * bp;
    bp += w * hp;
    return bp * Math.sin(Math.PI * Math.min(1, t / 1.0)) ** 2;
  }, 0.45);
}

sfx("success", 1.4, (t) => bell(t, mtof(79), 3.2) * 0.7 + (t > 0.1 ? bell(t - 0.1, mtof(86), 3) : 0), 0.6);
sfx("notify", 1.2, (t) => bell(t, mtof(81), 3.5) + 0.5 * bell(t, mtof(88), 4), 0.5);
sfx("error", 0.5, (t) => {
  const f = t < 0.16 ? 330 : 262;
  const local = t < 0.16 ? t : t - 0.16;
  return (Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * 3 * f * t)) * Math.exp(-9 * local);
}, 0.5);
sfx("alarm", 1.6, (t) => {
  const k = Math.floor(t / 0.2);
  const f = k % 2 ? 660 : 880;
  const local = t - k * 0.2;
  const env = Math.min(1, local / 0.02) * Math.exp(-4 * local);
  return (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t)) * env * (1 - t / 1.8);
}, 0.55);
sfx("hold", 3.4, (t) => {
  // A rising tone for the three-second press.
  const f = 280 + 420 * (t / 3.4);
  const trem = 0.75 + 0.25 * Math.sin(TAU * 7 * t);
  return Math.sin(TAU * f * t + 0.8 * Math.sin(TAU * 2 * f * t)) * trem * Math.min(1, t / 0.3);
}, 0.3);

// ─────────────────────────────────────────────────────────────── music

const timeline = JSON.parse(fs.readFileSync(path.join(HERE, "..", "public", "capture", "timeline.json"), "utf8"));
const voiceFile = path.join(HERE, "..", "public", "voice", "durations.json");
const voice = fs.existsSync(voiceFile) ? JSON.parse(fs.readFileSync(voiceFile, "utf8")) : {};
const { total } = plan(timeline, voice);
const seconds = total / FPS + 1;
const N = Math.round(seconds * SR);
console.log(`Film is ${(total / FPS).toFixed(1)} s — writing ${seconds.toFixed(1)} s of music.`);

const L = new Float32Array(N);
const R = new Float32Array(N);

const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const CHORD_BARS = 2;

// D major, warm and unhurried: Dmaj9 · Bm9 · Gmaj9 · Asus.
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 59],
  [45, 52, 59, 62, 66],
];

// Band-limited, softened sawtooth as a wavetable.
const TABLE = 4096;
const saw = new Float32Array(TABLE);
for (let i = 0; i < TABLE; i++) {
  let v = 0;
  for (let h = 1; h <= 10; h++) v += Math.sin((TAU * h * i) / TABLE) / Math.pow(h, 1.7);
  saw[i] = v * 0.6;
}
const read = (phase) => saw[Math.floor((phase % 1) * TABLE)];

const chordLen = BAR * CHORD_BARS;
const nChords = Math.ceil(seconds / chordLen) + 1;

// Pads: each chord swells in and overlaps the next by a second.
for (let c = 0; c < nChords; c++) {
  const chord = CHORDS[c % CHORDS.length];
  const start = c * chordLen;
  const len = chordLen + 1.2;
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, Math.round((start + len) * SR));
  chord.slice(1).forEach((m, v) => {
    const f = mtof(m);
    const pan = (v / 3) * 0.8 - 0.4;
    for (const detune of [-0.0016, 0.0016]) {
      let ph = (v * 0.13 + detune * 50) % 1;
      const inc = (f * (1 + detune)) / SR;
      for (let i = i0; i < i1; i++) {
        const t = (i - i0) / SR;
        const env = Math.min(1, t / 1.4) * Math.min(1, (len - t) / 1.2);
        const s = read(ph) * env * 0.05;
        ph += inc;
        L[i] += s * (1 - pan) * 0.5;
        R[i] += s * (1 + pan) * 0.5;
      }
    }
  });
}

// Bass: the chord root on beats one and three.
const bars = Math.ceil(seconds / BAR);
for (let b = 0; b < bars; b++) {
  const root = CHORDS[Math.floor(b / CHORD_BARS) % CHORDS.length][0] - 12;
  for (const beat of [0, 2, 3.5]) {
    const start = b * BAR + beat * BEAT;
    const len = beat === 3.5 ? BEAT * 0.45 : BEAT * 1.6;
    const f = mtof(root + (beat === 3.5 ? 12 : 0));
    const i0 = Math.round(start * SR);
    const i1 = Math.min(N, Math.round((start + len) * SR));
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      const env = Math.min(1, t / 0.02) * Math.exp(-1.6 * t) * Math.min(1, (len - t) / 0.08);
      const s = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)) * env * (beat === 3.5 ? 0.09 : 0.16);
      L[i] += s;
      R[i] += s;
    }
  }
}

// A plucked arpeggio through a dotted-eighth echo.
const pl = new Float32Array(N);
const pr = new Float32Array(N);
const PATTERN = [0, 2, 1, 3, 2, 4, 3, 1];
for (let b = 0; b < bars; b++) {
  const chord = CHORDS[Math.floor(b / CHORD_BARS) % CHORDS.length];
  const upper = chord.slice(1).map((m) => m + 12);
  for (let k = 0; k < 8; k++) {
    const m = upper[PATTERN[k] % upper.length];
    const f = mtof(m);
    const start = b * BAR + k * (BEAT / 2);
    const i0 = Math.round(start * SR);
    const i1 = Math.min(N, i0 + Math.round(0.9 * SR));
    const pan = k % 2 ? 0.35 : -0.35;
    const vel = k % 4 === 0 ? 1 : 0.7;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-6 * t);
      const s = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-10 * t)) * env * 0.05 * vel;
      pl[i] += s * (1 - pan);
      pr[i] += s * (1 + pan);
    }
  }
}
{
  const d = Math.round(BEAT * 0.75 * SR);
  for (let i = d; i < N; i++) {
    pl[i] += pr[i - d] * 0.32;
    pr[i] += pl[i - d] * 0.32;
  }
}

// Light drums, entering after the intro and leaving before the end.
const drumsIn = 10;
const drumsOut = seconds - 9;
for (let b = 0; b < bars; b++) {
  for (let e = 0; e < 8; e++) {
    const start = b * BAR + e * (BEAT / 2);
    if (start < drumsIn || start > drumsOut) continue;
    const ramp = Math.min(1, (start - drumsIn) / 6, (drumsOut - start) / 5);
    const i0 = Math.round(start * SR);
    if (e === 0 || e === 4) {
      // Soft kick.
      let ph = 0;
      for (let i = i0; i < Math.min(N, i0 + Math.round(0.35 * SR)); i++) {
        const t = (i - i0) / SR;
        const f = 48 + 70 * Math.exp(-30 * t);
        ph += f / SR;
        const s = Math.sin(TAU * ph) * Math.exp(-9 * t) * 0.26 * ramp;
        L[i] += s;
        R[i] += s;
      }
    }
    if (e === 2 || e === 6) {
      // A brushed snare.
      let lp = 0;
      for (let i = i0; i < Math.min(N, i0 + Math.round(0.25 * SR)); i++) {
        const t = (i - i0) / SR;
        const n = noise();
        lp += 0.35 * (n - lp);
        const s = (n - lp) * Math.exp(-16 * t) * 0.07 * ramp;
        L[i] += s * 0.9;
        R[i] += s;
      }
    }
    // Hi-hat on every eighth, quieter on the beat.
    let last = 0;
    for (let i = i0; i < Math.min(N, i0 + Math.round(0.06 * SR)); i++) {
      const t = (i - i0) / SR;
      const n = noise();
      const hp = n - last;
      last = n;
      const s = hp * Math.exp(-70 * t) * (e % 2 ? 0.035 : 0.02) * ramp;
      L[i] += s;
      R[i] += s * 0.8;
    }
  }
}

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 3, (seconds - t) / 6);
  const l = (L[i] + pl[i]) * fade;
  const r = (R[i] + pr[i]) * fade;
  // Gentle saturation keeps peaks round.
  L[i] = Math.tanh(l * 1.4) / 1.4;
  R[i] = Math.tanh(r * 1.4) / 1.4;
}
normalise([L, R], 0.8);

const wav = path.join(OUT, "music.wav");
writeWav(wav, L, R);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", path.join(OUT, "music.mp3")]);
fs.rmSync(wav);
console.log("Wrote public/audio: music.mp3, click, type, whoosh, success, notify, error, alarm, hold.");
