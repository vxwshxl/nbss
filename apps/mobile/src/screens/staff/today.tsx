import { router } from "expo-router";
import { CalendarClock, CircleCheckBig, Clock3, Phone, UserRoundX } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { istTime, tel } from "@nbss/shared/company";
import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Select } from "@/components/select";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

type Duty = {
  id: string;
  guardId: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  shift_type: string | null;
  guard: string;
  avatar: string | null;
  phone: string | null;
  siteId: string;
  site: string;
  grace: number;
  inAt: string | null;
  outAt: string | null;
  /** A check-in with no rostered duty behind it. */
  offRoster?: boolean;
};
type Day = "-1" | "0" | "1";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Midnight in India (fixed UTC+5:30), `offset` days from today, as an instant. */
function istMidnight(offset: number): number {
  const shift = 330 * 60_000;
  return Math.floor((Date.now() + shift) / 86_400_000) * 86_400_000 - shift + offset * 86_400_000;
}

async function load(day: Day): Promise<Duty[]> {
  const start = istMidnight(Number(day));
  const end = start + 86_400_000;
  const [shifts, punches] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, guard_id, site_id, starts_at, ends_at, status, shift_type, profiles!shifts_guard_id_fkey(full_name, phone, avatar_url), sites(name, grace_minutes)")
      .neq("status", "cancelled")
      .lt("starts_at", new Date(end).toISOString())
      .gt("ends_at", new Date(start).toISOString())
      .order("starts_at"),
    // Every session that touches the day, open ones included: a duty worked in two
    // sessions shows its first in and last out.
    supabase
      .from("attendance")
      .select("id, guard_id, shift_id, site_id, check_in_at, check_out_at, profiles!attendance_guard_id_fkey(full_name, phone, avatar_url), sites(name)")
      .lt("check_in_at", new Date(end).toISOString())
      .or(`check_out_at.is.null,check_out_at.gt.${new Date(start).toISOString()}`)
      .order("check_in_at"),
  ]);

  const byShift = new Map<string, { in: string; out: string | null }>();
  const used = new Set<string>();
  for (const a of punches.data ?? []) {
    if (!a.shift_id || !a.check_in_at) continue;
    const cur = byShift.get(a.shift_id);
    // First in; last out, or still open while any session is.
    const stillOpen = !a.check_out_at || (cur !== undefined && cur.out === null);
    byShift.set(a.shift_id, {
      in: cur && cur.in < a.check_in_at ? cur.in : a.check_in_at,
      out: stillOpen ? null : [cur?.out ?? "", a.check_out_at!].sort().at(-1)!,
    });
    used.add(a.id);
  }

  const rows: Duty[] = (shifts.data ?? []).map((s) => {
    const p = one(s.profiles as unknown as { full_name: string; phone: string | null; avatar_url: string | null } | null);
    const site = one(s.sites as unknown as { name: string; grace_minutes: number } | null);
    const punch = byShift.get(s.id);
    return {
      id: s.id,
      guardId: s.guard_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      status: s.status,
      shift_type: s.shift_type,
      guard: p?.full_name ?? "Unassigned",
      avatar: p?.avatar_url ?? null,
      phone: p?.phone ?? null,
      siteId: s.site_id,
      site: site?.name ?? "A site",
      grace: site?.grace_minutes ?? 10,
      inAt: punch?.in ?? null,
      outAt: punch ? punch.out : null,
    };
  });

  // Check-ins with no rostered duty: still somebody at a gate, so still on the board.
  for (const a of punches.data ?? []) {
    if (used.has(a.id) || !a.check_in_at) continue;
    const p = one(a.profiles as unknown as { full_name: string; phone: string | null; avatar_url: string | null } | null);
    rows.push({
      id: a.id,
      guardId: a.guard_id,
      starts_at: a.check_in_at,
      ends_at: a.check_out_at ?? new Date(end).toISOString(),
      status: a.check_out_at ? "completed" : "in_progress",
      shift_type: null,
      guard: p?.full_name ?? "A guard",
      avatar: p?.avatar_url ?? null,
      phone: p?.phone ?? null,
      siteId: a.site_id,
      site: one(a.sites as unknown as { name: string } | null)?.name ?? "A site",
      grace: 0,
      inAt: a.check_in_at,
      outAt: a.check_out_at,
      offRoster: true,
    });
  }
  return rows;
}

const mins = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/**
 * A day across every site: who has not arrived (and by how long), who is on duty,
 * who is coming, who is done. Yesterday and tomorrow are one tap away, and a site
 * chip narrows it to one place. Current as it happens: a check-in on any phone or a
 * roster change on the website moves people between the lists.
 */
export function StaffToday() {
  const [day, setDay] = useState<Day>("0");
  const [site, setSite] = useState<string | null>(null);
  const loader = useCallback(() => load(day), [day]);
  const { data, refreshing, reload, refresh } = useLoader(loader);
  useLiveTables(["shifts", "attendance"], reload);
  const now = useNow(60_000);

  const everything = useMemo(() => data ?? [], [data]);
  const sites = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of everything) m.set(d.siteId, d.site);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [everything]);
  const all = site ? everything.filter((d) => d.siteId === site) : everything;

  const isOn = (d: Duty) => d.inAt && !d.outAt;
  const due = (d: Duty) => new Date(d.starts_at).getTime() + d.grace * 60_000;
  const late = all.filter((d) => !d.inAt && d.status !== "completed" && d.status !== "missed" && due(d) < now && new Date(d.ends_at).getTime() > now);
  const on = all.filter(isOn);
  const coming = all.filter((d) => !d.inAt && d.status === "scheduled" && due(d) >= now);
  // The rest of the day, in plain words: came and left, or never came at all.
  const rest = all.filter((d) => !isOn(d) && !late.includes(d) && !coming.includes(d));
  const completed = rest.filter((d) => d.inAt);
  const missed = rest.filter((d) => !d.inAt);

  const open = (d: Duty) => d.guardId && router.push({ pathname: "/person/[id]", params: { id: d.guardId } });

  return (
    <Screen topInset={false} bottomInset={false} contentStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}>
      <PageHeader eyebrow="Shift management" title={day === "0" ? "Today" : day === "-1" ? "Yesterday" : "Tomorrow"} />
      <Segmented
        value={day}
        stretch
        onChange={(v) => {
          setDay(v);
          setSite(null);
        }}
        options={[
          { value: "-1", label: "Yesterday" },
          { value: "0", label: "Today" },
          { value: "1", label: "Tomorrow" },
        ]}
      />
      {sites.length > 1 && (
        <Select
          title="Site"
          value={site ?? "all"}
          onChange={(v) => setSite(v === "all" ? null : v)}
          options={[{ value: "all", label: "All sites" }, ...sites.map(([id, name]) => ({ value: id, label: name, hint: `${everything.filter((d) => d.siteId === id).length} on the roster` }))]}
        />
      )}
      <CardGrid columns={2}>
        <StatCard label="Not arrived" value={String(late.length)} hint="Late, not checked in" icon={UserRoundX} tone={late.length ? "rose" : "slate"} />
        <StatCard label="On duty" value={String(on.length)} hint="Checked in now" icon={CircleCheckBig} tone="emerald" />
        <StatCard label="Starting later" value={String(coming.length)} hint="Duty not started yet" icon={CalendarClock} tone="sky" />
        <StatCard
          label="Completed"
          value={String(completed.length)}
          hint={missed.length ? `${missed.length} missed (never came)` : "Came and checked out"}
          icon={Clock3}
          tone={missed.length ? "amber" : "violet"}
        />
      </CardGrid>
      {data && all.length === 0 && (
        <Text variant="label" tone="muted" style={styles.centred}>
          No duty on the roster for this day.
        </Text>
      )}
      <Group title="Not arrived" hint="Their duty has started; they have not checked in" tone="rose" rows={late} onPress={open} note={(d) => `Due ${istTime(d.starts_at)} · ${mins(now - new Date(d.starts_at).getTime())} late`} />
      <Group
        title="On duty now"
        hint="Checked in and working"
        tone="emerald"
        rows={on}
        onPress={open}
        note={(d) => `In ${istTime(d.inAt!)} · ${mins(now - new Date(d.inAt!).getTime())}${d.offRoster ? " · not rostered" : ` · ends ${istTime(d.ends_at)}`}`}
      />
      <Group title="Starting later" hint="Duty begins later" tone="sky" rows={coming} onPress={open} note={(d) => `${istTime(d.starts_at)} – ${istTime(d.ends_at)}`} />
      <Group title="Missed" hint="The duty ended and they never checked in" tone="amber" rows={missed} onPress={open} note={(d) => `Was due ${istTime(d.starts_at)} – ${istTime(d.ends_at)}`} />
      <Group
        title="Completed"
        hint="Came, worked and checked out"
        tone="slate"
        rows={completed}
        onPress={open}
        note={(d) => `${istTime(d.inAt!)} – ${d.outAt ? istTime(d.outAt) : "?"}${d.inAt && d.outAt ? ` · ${mins(new Date(d.outAt).getTime() - new Date(d.inAt).getTime())}` : ""}`}
      />
    </Screen>
  );
}

function Group({ title, hint, tone, rows, note, onPress }: { title: string; hint: string; tone: "rose" | "emerald" | "sky" | "slate" | "amber"; rows: Duty[]; note: (d: Duty) => string; onPress: (d: Duty) => void }) {
  if (rows.length === 0) return null;
  return (
    <Panel tone={tone} title={`${title} · ${rows.length}`} subtitle={hint} bare>
      {rows.map((d, i) => (
        <PanelRow key={d.id} first={i === 0}>
          {/* The row opens the guard; the phone beside it calls. Siblings, not nested. */}
          <Pressable accessibilityRole="button" onPress={() => onPress(d)} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
            <Avatar name={d.guard} uri={d.avatar} size={36} />
            <View style={styles.flex}>
              <Text variant="label" weight="semibold" numberOfLines={1}>
                {d.guard}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[d.site, shiftTypeLabel(d.shift_type)].filter(Boolean).join(" · ")}
              </Text>
              <Text variant="caption" weight="medium" tone={tone === "rose" ? "danger" : "muted"} numberOfLines={1}>
                {note(d)}
              </Text>
            </View>
          </Pressable>
          {d.phone ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${d.guard}`} hitSlop={4} onPress={() => void Linking.openURL(`tel:${tel(d.phone!)}`)} style={styles.call}>
              <Phone size={17} color={color.primaryInk} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </PanelRow>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 120 },
  flex: { flex: 1, minWidth: 0, gap: 1 },
  centred: { textAlign: "center" },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space[3] },
  pressed: { opacity: 0.6 },
  call: { width: 38, height: 38, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
});
