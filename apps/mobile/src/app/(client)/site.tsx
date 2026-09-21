import { CalendarCheck, Clock3, Phone, Radio, ShieldCheck, Timer } from "lucide-react-native";
import { useCallback } from "react";
import { Linking, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import type { View as DbView } from "@nbss/shared/db";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { color, space } from "@/theme/tokens";

type Presence = DbView<"client_attendance">;

/**
 * What a client sees: that their site is staffed, and the man-hours behind the invoice.
 * The same four figures and the same "on duty now" table as the console's client page, so
 * a customer who has seen one recognises the other.
 *
 * Read from `client_attendance`, not from `attendance`. The underlying rows carry each
 * guard's coordinates, accuracy readings and the object key of their check-in photograph,
 * and row level security filters rows rather than columns — so the view (0004) exposes the
 * ten columns a client may have and the table itself stays closed to them. A client is
 * entitled to know their premises are covered; following an individual employee around a
 * compound minute by minute is not theirs to do.
 */
export default function ClientSiteRoute() {
  const { profile } = useAuth();
  const { statColumns } = useLayout();

  const load = useCallback(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [live, month] = await Promise.all([
      supabase
        .from("client_attendance")
        .select("*")
        .is("check_out_at", null)
        .order("check_in_at", { ascending: false }),
      supabase
        .from("client_attendance")
        .select("worked_minutes, overtime_minutes")
        .gte("check_in_at", monthStart.toISOString()),
    ]);

    const rows = month.data ?? [];
    return {
      onDuty: (live.data ?? []) as Presence[],
      monthMinutes: rows.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0),
      overtime: rows.reduce((sum, r) => sum + (r.overtime_minutes ?? 0), 0),
      shifts: rows.length,
    };
  }, []);

  const { data, refreshing, reload } = useLoader(load);
  const onDuty = data?.onDuty ?? [];
  const monthMinutes = data?.monthMinutes ?? 0;
  const overtime = data?.overtime ?? 0;
  const shifts = data?.shifts ?? 0;

  const hours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
  };

  return (
    <Screen
      topInset={false}
      bottomInset={false}
      contentStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color.primary}
          onRefresh={() => void reload()}
        />
      }
    >
      <PageHeader eyebrow="My site" title="Deployment" />

      <CardGrid columns={statColumns}>
        <StatCard
          label="On duty now"
          value={String(onDuty.length)}
          hint={onDuty.length ? "Verified at the boundary" : "Nobody is checked in"}
          icon={Radio}
          tone={onDuty.length ? "emerald" : "slate"}
        />
        <StatCard
          label="Man-hours"
          value={hours(monthMinutes)}
          hint="This month"
          icon={Clock3}
          tone="indigo"
        />
        <StatCard
          label="Of which overtime"
          value={hours(overtime)}
          hint="This month"
          icon={Timer}
          tone="violet"
        />
        <StatCard
          label="Shifts"
          value={String(shifts)}
          hint="This month"
          icon={CalendarCheck}
          tone="sky"
        />
      </CardGrid>

      <Panel tone="emerald" title="On duty now" icon={ShieldCheck} bare>
        {onDuty.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="Nobody is checked in."
            body="Guards appear here from the moment they arrive on site and mark themselves present at the boundary."
          />
        ) : (
          onDuty.map((row, i) => (
            <PanelRow key={row.id} first={i === 0}>
              <View style={styles.rowText}>
                <Text variant="body" weight="semibold">
                  {row.guard_name ?? "—"}
                </Text>
                <Text variant="caption" tone="muted">
                  {row.site_name ?? "—"}
                </Text>
              </View>
              <Text variant="caption" tone="muted" mono>
                {row.check_in_at ? `${istTime(row.check_in_at)} IST` : "—"}
              </Text>
            </PanelRow>
          ))
        )}
      </Panel>

      <Panel tone="slate" title="Anything not right?" icon={Phone}>
        <Text variant="body" tone="muted">
          Man-hours are computed from the times guards checked in and out at your site, each
          one verified against its boundary. The deployment desk is staffed{" "}
          {COMPANY.deskHours}. Signed in as {profile?.full_name ?? "—"}.
        </Text>
        <Button
          label={COMPANY.phone}
          icon={Phone}
          onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
  rowText: { flex: 1, gap: 2 },
});
