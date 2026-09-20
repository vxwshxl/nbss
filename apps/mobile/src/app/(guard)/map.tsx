import { Panel } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";

/**
 * The site map, with the fence drawn and every colleague currently on it.
 *
 * Not built yet. It subscribes to `site:<id>` for the fifteen-second position batch that
 * `broadcast_positions()` publishes, and renders through MapLibre — both of which are
 * already in place on the server and in app.config.ts. What is missing is the map style:
 * the plan is Protomaps PMTiles on the R2 bucket, which needs generating once, and until
 * then the console's own /api/tiles proxy works as a raster source.
 */
export default function MapRoute() {
  return (
    <Screen bottomInset={false}>
      <Panel title="Site map">
        <Text variant="body">
          Not built yet — this is where you will see your site&apos;s boundary and the other
          guards on it.
        </Text>
        <Text variant="caption" tone="muted">
          The live position feed and the map library are both wired up; what is left is the
          map style itself.
        </Text>
      </Panel>
    </Screen>
  );
}
