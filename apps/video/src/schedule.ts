/**
 * Turns the captured timeline into frames: when each chapter starts, when each
 * step's pointer moves, presses and lands, and where every sound goes.
 *
 * Plain, erasable TypeScript with no imports, so `scripts/audio.mjs` can load
 * it under Node too and cut the music to exactly the film's length.
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

/** Frames the pointer takes to travel to its target. */
export const MOVE = 20;
/** Frames between the press and the screen answering. */
export const PRESS = 4;
/** Frames each typing snapshot stays up. */
export const TYPE_FRAME = 3;
/** Frames each snapshot of a held button stays up (they were taken 200 ms apart). */
export const HOLD_FRAME = 6;

export const INTRO = 180;
export const CONTENTS = 250;
export const OUTRO = 210;
/** A chapter's opening, before its first step: heading and devices arrive. */
export const CHAPTER_LEAD = 36;
export const CHAPTER_TAIL = 24;

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

export type Plan = { total: number; scenes: PlannedScene[]; outroFrom: number; cues: Cue[] };

function stepTiming(step: Step) {
  const move = step.action && step.action.type !== "key" ? MOVE : 0;
  const pressAt = move;
  let seq = 0;
  if (step.action?.type === "type") seq = (step.frames?.length ?? 0) * TYPE_FRAME;
  if (step.action?.type === "hold") seq = (step.frames?.length ?? 0) * HOLD_FRAME;
  const landAt = step.action ? pressAt + PRESS + seq : 6;
  const pan = step.scroll ? Math.max(70, Math.min(170, Math.round(step.scroll.to / 20))) : 0;
  const scrollExtra = pan ? pan + 14 + 26 : 0;
  const after = Math.max(16, Math.round((step.hold ?? 1) * FPS));
  return { pressAt, landAt, pan, dur: landAt + scrollExtra + after };
}

export function plan(timeline: Timeline): Plan {
  const scenes: PlannedScene[] = [];
  const cues: Cue[] = [];
  let at = INTRO + CONTENTS;

  timeline.scenes.forEach((scene, si) => {
    let t = CHAPTER_LEAD;
    const steps: PlannedStep[] = scene.steps.map((step, index) => {
      const timing = stepTiming(step);
      const planned: PlannedStep = { ...step, index, from: t, ...timing };
      t += timing.dur;
      return planned;
    });
    const dur = t + CHAPTER_TAIL;
    scenes.push({ ...scene, steps, from: at, dur, number: si + 1 });

    cues.push({ frame: at, sfx: "whoosh", volume: 0.5 });
    for (const s of steps) {
      const base = at + s.from;
      if (s.action && s.action.type !== "key" && s.action.type !== "wheel") {
        cues.push({ frame: base + s.pressAt, sfx: s.action.type === "hold" ? "hold" : "click", volume: 0.55 });
      }
      if (s.action?.type === "type") {
        const n = s.frames?.length ?? 0;
        for (let i = 1; i < n; i += 1) cues.push({ frame: base + s.pressAt + PRESS + i * TYPE_FRAME, sfx: "type", volume: 0.28 });
      }
      if (s.sfx) cues.push({ frame: base + s.landAt, sfx: s.sfx, volume: s.sfx === "alarm" ? 0.42 : 0.5 });
    }
    at += dur;
  });

  cues.push({ frame: INTRO, sfx: "whoosh", volume: 0.45 });
  cues.push({ frame: at, sfx: "whoosh", volume: 0.45 });

  return { total: at + OUTRO, scenes, outroFrom: at, cues: cues.sort((a, b) => a.frame - b.frame) };
}
