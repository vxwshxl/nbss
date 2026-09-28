import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useVideoConfig } from "remotion";

import timeline from "../public/capture/timeline.json";
import voice from "../public/voice/durations.json";
import { Chapter } from "./Chapter";
import { Background, Contents, Intro, Outro } from "./Panels";
import { musicLevel, plan, type Timeline, type VoiceDurations } from "./schedule";
import { SCRIPT } from "./script";
import { fontCss } from "./theme";

/** The captured screens, with their words taken from the script. */
const scripted: Timeline = {
  scenes: (timeline as unknown as Timeline).scenes.map((s) => {
    const text = SCRIPT[s.id];
    return text ? { ...s, title: text.title, heading: text.heading, points: text.points } : s;
  }),
};

export const PLAN = plan(scripted, voice as VoiceDurations);

function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = fontCss;
    document.head.appendChild(style);
    Promise.all([
      document.fonts.load('700 20px "Geist"'),
      document.fonts.load('500 20px "Geist"'),
      document.fonts.load('600 20px "Geist Mono"'),
    ])
      .catch(() => {})
      .then(() => continueRender(handle));
  }, [handle]);
}

export function Film() {
  useFonts();
  const { durationInFrames } = useVideoConfig();
  const total = PLAN.scenes.length;
  return (
    <AbsoluteFill>
      <Background />

      <Sequence durationInFrames={PLAN.intro + 10}>
        <Intro dur={PLAN.intro + 10} />
      </Sequence>
      <Sequence from={PLAN.intro} durationInFrames={PLAN.contents}>
        <Contents dur={PLAN.contents} scenes={PLAN.scenes} />
      </Sequence>
      {PLAN.scenes.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
          <Chapter scene={s} total={total} />
        </Sequence>
      ))}
      <Sequence from={PLAN.outroFrom} durationInFrames={PLAN.outro}>
        <Outro dur={PLAN.outro} />
      </Sequence>

      <Audio src={staticFile("audio/music.mp3")} volume={(f) => musicLevel(f, PLAN.voice, durationInFrames)} />
      {PLAN.voice.map((v) => (
        <Sequence key={v.key} from={v.frame} durationInFrames={v.frames + 10} layout="none">
          <Audio src={staticFile(`voice/${v.key}.wav`)} volume={1} />
        </Sequence>
      ))}
      {PLAN.cues.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(`audio/${c.sfx}.wav`)} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
