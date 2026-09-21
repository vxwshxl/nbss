import { Map as MapIcon } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Screen } from "@/components/screen";

/**
 * The site map: the fence drawn, and every colleague currently standing inside it.
 *
 * Not built yet. The pieces behind it are: the screen subscribes to `site:<id>` for the
 * fifteen-second position batch that `broadcast_positions()` publishes (0005), and renders
 * through MapLibre, which is already configured in app.config.ts. What is missing is the
 * map style — Protomaps PMTiles on the R2 bucket, which has to be generated once; until
 * then the console's own /api/tiles proxy works as a raster source.
 *
 * None of that belongs on the screen. What a guard sees is an empty state that tells them
 * what this tab will do, in their language, with no mention of tiles or bundles.
 */
export default function MapRoute() {
  return (
    <Screen contentStyle={{ gap: 24 }} topInset={false} bottomInset={false}>
      <PageHeader eyebrow="Your site" title="Site map" />

      <Panel tone="sky" bare>
        <EmptyState
          icon={MapIcon}
          title="The map is coming soon."
          body="This is where you will see your site's boundary and the other guards on it, updating as they move."
        />
      </Panel>
    </Screen>
  );
}
