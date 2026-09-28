/**
 * Turns the captured timeline into frames: when each chapter starts, when each
 * step's pointer moves, presses and lands, where every sound goes, and when
 * each voice-over line is spoken.
 *
 * Plain, erasable TypeScript with no imports, so the Node scripts can load it
 * too and cut the music to exactly the film's length.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type DeviceName = "laptop" | "phone" | "phone2";
export type Layout = "laptop" | "laptop+phone" | "trio";
export type Sfx = "success" | "notify" | "error" | "alarm";

export type Action = {
  type: "click" | "type" | "hold" | "wheel" | "key";
  x: number;
  y: number;
  chars?: number;
  ms?: number;
};

export type Step = {
  device: DeviceName;
  pov: string;
  url: string;
  image: string;
  before?: string;
  frames?: string[];
  action?: Action;
  point?: number;
  hold?: number;
  sfx?: Sfx;
  badge?: string;
  zoom?: { x: number; y: number; scale: number };
  scroll?: { image: string; pageHeight: number; to: number };
};

export type Scene = {
  id: string;
  title: string;
  heading: string;
  layout: Layout;
  points: string[];
  steps: Step[];
};

export type Timeline = { scenes: Scene[] };

/** Seconds of each voice line, keyed "intro", "contents", "outro" and "<chapter>.<point>". */
export type VoiceDurations = Record<string, { seconds: number }>;

/** Frames the pointer takes to travel to its target. */
export const MOVE = 14;
/** Frames between the press and the screen answering. */
export const PRESS = 4;
/** Frames each typing snapshot stays up. */
export const TYPE_FRAME = 2;
/** Frames each snapshot of a held button stays up (they were taken 200 ms apart). */
export const HOLD_FRAME = 6;

const INTRO_MIN = 110;
const CONTENTS_MIN = 150;
const OUTRO_MIN = 150;
/** A chapter's opening, before its first step: heading and devices arrive. */
export const CHAPTER_LEAD = 24;
export const CHAPTER_TAIL = 12;
/** A voice line starts this many frames into its point, and leaves this much air after. */
const VOICE_IN = 4;
const VOICE_AIR = 6;
/**
 * The holds written by the capture are scaled by this: they were chosen for
 * reading at leisure, and the film reads better brisk. A point still lasts at
 * least as long as its line.
 */
const HOLD_SCALE = 0.55;

export type PlannedStep = Step & {
  index: number;
  /** Frame (within the chapter) the step begins. */
  from: number;
  dur: number;
  /** Frame the press lands, relative to `from`. */
  pressAt: number;
  /** Frame the final screen appears, relative to `from`. */
  landAt: number;
  /** Frames of the page pan, for a scroll step. */
  pan: number;
};

export type PlannedScene = Omit<Scene, "steps"> & { from: number; dur: number; number: number; steps: PlannedStep[] };

export type Cue = { frame: number; sfx: "click" | "type" | "whoosh" | "hold" | Sfx; volume: number };

export type VoiceCue = { key: string; frame: number; frames: number };

export type Plan = {
  total: number;
  intro: number;
  contents: number;
  outro: number;
  outroFrom: number;
  scenes: PlannedScene[];
  cues: Cue[];
  voice: VoiceCue[];
};

function stepTiming(step: Step) {
  const move = step.action && step.action.type !== "key" ? MOVE : 0;
  const pressAt = move;
  let seq = 0;
  if (step.action?.type === "type") seq = (step.frames?.length ?? 0) * TYPE_FRAME;
  if (step.action?.type === "hold") seq = (step.frames?.length ?? 0) * HOLD_FRAME;
  const landAt = step.action ? pressAt + PRESS + seq : 6;
  const pan = step.scroll ? Math.max(45, Math.min(110, Math.round(step.scroll.to / 28))) : 0;
  const scrollExtra = pan ? pan + 10 + 16 : 0;
  const after = Math.max(12, Math.round((step.hold ?? 1) * FPS * HOLD_SCALE));
  return { pressAt, landAt, pan, dur: landAt + scrollExtra + after };
}

const framesFor = (voice: VoiceDurations, key: string) =>
  voice[key] ? Math.ceil(voice[key].seconds * FPS) : 0;

export function plan(timeline: Timeline, voice: VoiceDurations = {}): Plan {
  const intro = Math.max(INTRO_MIN, VOICE_IN + 24 + framesFor(voice, "intro") + VOICE_AIR);
  const contents = Math.max(CONTENTS_MIN, VOICE_IN + framesFor(voice, "contents") + 60);
  const outro = Math.max(OUTRO_MIN, VOICE_IN + framesFor(voice, "outro") + 60);

  const scenes: PlannedScene[] = [];
  const cues: Cue[] = [];
  const voiceCues: VoiceCue[] = [];
  if (voice.intro) voiceCues.push({ key: "intro", frame: 24, frames: framesFor(voice, "intro") });
  if (voice.contents) voiceCues.push({ key: "contents", frame: intro + 12, frames: framesFor(voice, "contents") });

  let at = intro + contents;

  timeline.scenes.forEach((scene, si) => {
    const timed = scene.steps.map((step) => ({ step, ...stepTiming(step) }));

    // Each point lasts at least as long as its line: the last step of the
    // point's run holds its screen until the voice has finished.
    for (let i = 0; i < timed.length; ) {
      const point = timed[i]!.step.point;
      let j = i;
      while (j + 1 < timed.length && timed[j + 1]!.step.point === point) j++;
      const need = point === undefined ? 0 : framesFor(voice, `${scene.id}.${point}`) + VOICE_IN + VOICE_AIR;
      const have = timed.slice(i, j + 1).reduce((n, x) => n + x.dur, 0);
      if (need > have) timed[j]!.dur += need - have;
      i = j + 1;
    }

    let t = CHAPTER_LEAD;
    const steps: PlannedStep[] = timed.map(({ step, ...timing }, index) => {
      const planned: PlannedStep = { ...step, index, from: t, ...timing };
      t += timing.dur;
      return planned;
    });
    const dur = t + CHAPTER_TAIL;
    scenes.push({ ...scene, steps, from: at, dur, number: si + 1 });

    cues.push({ frame: at, sfx: "whoosh", volume: 0.45 });
    let lastPoint: number | undefined;
    for (const s of steps) {
      const base = at + s.from;
      if (s.point !== undefined && s.point !== lastPoint) {
        const key = `${scene.id}.${s.point}`;
        if (voice[key]) voiceCues.push({ key, frame: base + VOICE_IN, frames: framesFor(voice, key) });
        lastPoint = s.point;
      }
      if (s.action && s.action.type !== "key" && s.action.type !== "wheel") {
        cues.push({ frame: base + s.pressAt, sfx: s.action.type === "hold" ? "hold" : "click", volume: 0.5 });
      }
      if (s.action?.type === "type") {
        const n = s.frames?.length ?? 0;
        for (let i = 1; i < n; i += 1) cues.push({ frame: base + s.pressAt + PRESS + i * TYPE_FRAME, sfx: "type", volume: 0.24 });
      }
      if (s.sfx) cues.push({ frame: base + s.landAt, sfx: s.sfx, volume: s.sfx === "alarm" ? 0.38 : 0.45 });
    }
    at += dur;
  });

  cues.push({ frame: intro, sfx: "whoosh", volume: 0.4 });
  cues.push({ frame: at, sfx: "whoosh", volume: 0.4 });
  if (voice.outro) voiceCues.push({ key: "outro", frame: at + 20, frames: framesFor(voice, "outro") });

  return {
    total: at + outro,
    intro,
    contents,
    outro,
    outroFrom: at,
    scenes,
    cues: cues.sort((a, b) => a.frame - b.frame),
    voice: voiceCues,
  };
}

/** How loud the music sits at a frame: lower while someone is speaking. */
export function musicLevel(frame: number, voice: VoiceCue[], total: number): number {
  const fadeIn = Math.min(1, frame / 45);
  const fadeOut = Math.min(1, (total - frame) / 120);
  let duck = 0;
  for (const v of voice) {
    const into = frame - (v.frame - 10);
    const outOf = v.frame + v.frames + 12 - frame;
    if (into > 0 && outOf > 0) duck = Math.max(duck, Math.min(1, into / 10, outOf / 12));
  }
  return Math.max(0, Math.min(fadeIn, fadeOut)) * (0.5 - 0.32 * duck);
}
