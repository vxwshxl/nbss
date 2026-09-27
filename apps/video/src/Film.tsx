import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useVideoConfig } from "remotion";

import timeline from "../public/capture/timeline.json";
import { Chapter } from "./Chapter";
import { Background, Contents, Intro, Outro } from "./Panels";
import { CONTENTS, INTRO, OUTRO, plan, type Timeline } from "./schedule";
import { fontCss } from "./theme";

export const PLAN = plan(timeline as unknown as Timeline);

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

      <Sequence durationInFrames={INTRO + 10}>
        <Intro dur={INTRO + 10} />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={CONTENTS}>
        <Contents dur={CONTENTS} scenes={PLAN.scenes} />
      </Sequence>
      {PLAN.scenes.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
          <Chapter scene={s} total={total} />
        </Sequence>
      ))}
      <Sequence from={PLAN.outroFrom} durationInFrames={OUTRO}>
        <Outro dur={OUTRO} />
      </Sequence>

      <Audio
        src={staticFile("audio/music.mp3")}
        volume={(f) =>
          0.55 *
          interpolate(f, [0, 45, durationInFrames - 120, durationInFrames - 2], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      {PLAN.cues.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(`audio/${c.sfx}.wav`)} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
