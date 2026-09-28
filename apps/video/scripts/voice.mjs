/**
 * The voice-over, read from src/script.ts by Sarvam's text-to-speech.
 *
 *   node scripts/voice.mjs            → public/voice/*.wav and durations.json
 *   VOICE=varun node scripts/voice.mjs
 *
 * Kabir is the default: the second-deepest of Sarvam's male voices, and quicker
 * than the deepest, which suits an explainer. A clip already on disk for the
 * same text and voice is kept, so re-running only pays for lines that changed.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEnv } from "../../../scripts/db.mjs";
import { CONTENTS_VOICE, INTRO_VOICE, OUTRO_VOICE, SCRIPT } from "../src/script.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "public", "voice");
fs.mkdirSync(OUT, { recursive: true });

const env = readEnv();
const KEY = env.SARVAM_API_KEY;
if (!KEY) throw new Error("SARVAM_API_KEY is not set in .env");

const VOICE = process.env.VOICE ?? "kabir";
const PACE = Number(process.env.PACE ?? 0.94);

const lines = { intro: INTRO_VOICE, contents: CONTENTS_VOICE, outro: OUTRO_VOICE };
for (const [id, chapter] of Object.entries(SCRIPT)) {
  chapter.voice.forEach((text, i) => (lines[`${id}.${i}`] = text));
}

/** Seconds of audio in a PCM WAV. */
function wavSeconds(buf) {
  let o = 12;
  let rate = 24000;
  let block = 2;
  while (o < buf.length - 8) {
    const id = buf.toString("ascii", o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (id === "fmt ") {
      rate = buf.readUInt32LE(o + 12);
      block = buf.readUInt16LE(o + 20);
    }
    if (id === "data") return size / block / rate;
    o += 8 + size;
  }
  throw new Error("not a WAV file");
}

const manifestFile = path.join(OUT, "durations.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
const durations = {};

for (const [key, text] of Object.entries(lines)) {
  const hash = crypto.createHash("sha1").update(`${VOICE}|${PACE}|${text}`).digest("hex").slice(0, 12);
  const file = path.join(OUT, `${key}.wav`);
  if (manifest[key]?.hash === hash && fs.existsSync(file)) {
    durations[key] = manifest[key];
    continue;
  }
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      target_language_code: "en-IN",
      speaker: VOICE,
      model: "bulbul:v3",
      pace: PACE,
      speech_sample_rate: 24000,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.audios?.[0]) throw new Error(`${key}: ${JSON.stringify(body).slice(0, 200)}`);
  const wav = Buffer.from(body.audios[0], "base64");
  fs.writeFileSync(file, wav);
  durations[key] = { hash, seconds: +wavSeconds(wav).toFixed(2) };
  console.log(`  ${key.padEnd(14)} ${durations[key].seconds}s`);
}

fs.writeFileSync(manifestFile, JSON.stringify(durations, null, 1));
const total = Object.values(durations).reduce((s, d) => s + d.seconds, 0);
console.log(`${Object.keys(durations).length} lines, ${total.toFixed(0)} s of voice (${VOICE}) → public/voice`);
