import { Composition } from "remotion";

import { Film, PLAN } from "./Film";
import { FPS, HEIGHT, WIDTH } from "./schedule";

export function Root() {
  return (
    <Composition id="NbssDemo" component={Film} durationInFrames={PLAN.total} fps={FPS} width={WIDTH} height={HEIGHT} />
  );
}
