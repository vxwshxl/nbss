import { router } from "expo-router";
import {
  ArrowLeft,
  CalendarCheck,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Smartphone,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY, istTime, tel, clock12 } from "@nbss/shared/company";
import { roleLabel, type Role } from "@nbss/shared/identity";
import { toRing } from "@nbss/shared/geo";
import { freshness } from "@nbss/shared/location";
import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import type { MapSite } from "@/components/live-map/shared";
import { Panel, PanelRow } from "@/components/panel";
import { RouteCard } from "@/components/route-card";
import { Screen } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { directionsUrl } from "@/lib/duty";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

const IST = COMPANY.timeZone ?? "Asia/Kolkata";
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "Never";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return dateLabel(iso);
};
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Session = {
  id: string;
  in: string;
  out: string | null;
  minutes: number | null;
  status: string;
  site: string;
  /** When they were meant to be on duty: the rostered shift, else the site's hours. */
  duty: string | null;
  /** The site's boundary, for the route map. */
  fence: MapSite | null;
};
type Detail = {
  id: string;
  name: string;
  code: string;
  role: Role;
  trade: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  joined: string | null;
  lastSeen: string | null;
  posting: { site: string; starts: string; ends: string; days: number[]; shift: string | null } | null;
  sessions: Session[];
  position: { lat: number; lng: number; inside: boolean | null; distance: number | null; battery: number | null; charging: boolean | null; at: string; mode: string } | null;
  device: {
    model: string;
    os: string | null;
    app: string | null;
    status: string;
    platform: string | null;
    gps: boolean | null;
    permission: string | null;
    batteryOptimized: boolean | null;
    /** From app builds after 0060; null from older ones. */
    notifications: boolean | null;
    precise: boolean | null;
    autostart: string | null;
    seen: string;
  } | null;
};

type SiteRow = { name: string; lat: number; lng: number; geofence_radius_m: number; polygon: unknown };

async function load(id: string): Promise<Detail | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [p, att, post, pos, dev] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code, role, trade, email, phone, avatar_url, active, joined_at, created_at, last_seen_at").eq("id", id).maybeSingle(),
    supabase.from("attendance").select("id, check_in_at, check_out_at, worked_minutes, status, site_id, sites(name, shift_start, shift_end, lat, lng, geofence_radius_m, polygon), shifts!attendance_shift_id_fkey(starts_at, ends_at)").eq("guard_id", id).gte("check_in_at", since).order("check_in_at", { ascending: false }).limit(120),
    supabase.from("site_postings").select("starts, ends, days, shift_type, sites(name)").eq("guard_id", id).eq("active", true).is("dates", null).maybeSingle(),
    supabase.from("guard_positions").select("lat, lng, inside_fence, distance_m, battery, charging, recorded_at, received_at, mode").eq("guard_id", id).maybeSingle(),
    supabase.from("guard_devices").select("brand, model, os_version, app_version, status, platform, gps_enabled, location_permission, battery_optimized, notifications_enabled, precise_location, autostart, permissions_at, last_seen_at").eq("profile_id", id).order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const r = p.data;
  if (!r) return null;
  const site = (v: unknown) => one(v as { name: string } | { name: string }[] | null)?.name ?? "A site";
  return {
    id: r.id,
    name: r.full_name,
    code: r.employee_code,
    role: r.role as Role,
    trade: r.trade,
    email: r.email,
    phone: r.phone,
    avatar: r.avatar_url,
    active: r.active,
    joined: r.joined_at ?? r.created_at,
    lastSeen: r.last_seen_at,
    posting: post.data ? { site: site(post.data.sites), starts: post.data.starts, ends: post.data.ends, days: post.data.days ?? [], shift: post.data.shift_type } : null,
    sessions: (att.data ?? [])
      .filter((a) => a.check_in_at)
      .map((a) => {
        const shift = one(a.shifts as unknown as { starts_at: string; ends_at: string } | { starts_at: string; ends_at: string }[] | null);
        const hours = one(a.sites as unknown as { shift_start: string | null; shift_end: string | null } | { shift_start: string | null; shift_end: string | null }[] | null);
        const duty = shift
          ? `${istTime(shift.starts_at)} – ${istTime(shift.ends_at)}`
          : hours?.shift_start && hours.shift_end
            ? `${clock12(hours.shift_start)} – ${clock12(hours.shift_end)} (site hours)`
            : null;
        const place = one(a.sites as unknown as SiteRow | SiteRow[] | null);
        const fence: MapSite | null = place
          ? { id: a.site_id, name: place.name, lat: place.lat, lng: place.lng, radiusM: place.geofence_radius_m, ring: toRing(place.polygon) }
          : null;
        return { id: a.id, in: a.check_in_at!, out: a.check_out_at, minutes: a.worked_minutes, status: a.status, site: site(a.sites), duty, fence };
      }),
    position: pos.data
      ? {
          lat: pos.data.lat,
          lng: pos.data.lng,
          inside: pos.data.inside_fence,
          distance: pos.data.distance_m,
          battery: pos.data.battery,
          charging: pos.data.charging,
          at: pos.data.received_at ?? pos.data.recorded_at,
          mode: pos.data.mode,
        }
      : null,
    device: dev.data
      ? {
          model: [dev.data.brand, dev.data.model].filter(Boolean).join(" ") || "Unknown phone",
          os: dev.data.os_version,
          app: dev.data.app_version,
          status: dev.data.status,
          platform: dev.data.platform,
          gps: dev.data.gps_enabled,
          permission: dev.data.location_permission,
          batteryOptimized: dev.data.battery_optimized,
          notifications: dev.data.notifications_enabled,
          precise: dev.data.precise_location,
          autostart: dev.data.autostart,
          seen: dev.data.permissions_at ?? dev.data.last_seen_at,
        }
      : null,
  };
}

/**
 * Everything about one person, as the website's person popup shows it and a little
 * more: who they are, where they are posted, whether they are on
 * duty now and where, the last 30 days, every recent check-in, and their phone.
 * Current while open: a check-in, a move or a change from the website reloads it.
 */
export function PersonPage({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
  const loader = useCallback(() => load(id), [id]);
  const { data: d, error, refreshing, reload, refresh } = useLoader(loader);
  // The shift whose route is shown: the one picked from Recent check-ins, else the open one, else the latest.
  const [picked, setPicked] = useState<string | null>(null);
  useLiveTables(["attendance", "profiles", "site_postings", "guard_devices"], reload);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const open = d?.sessions.find((s) => !s.out) ?? null;
  const shown = d?.sessions.find((s) => s.id === picked) ?? open ?? d?.sessions[0] ?? null;
  const worked = d?.sessions.filter((s) => s.status === "present" || s.status === "late") ?? [];
  const days30 = new Set(worked.map((s) => dayOf(s.in))).size;
  // Days, not check-ins: two late punches on one day are one late day.
  const late30 = new Set(d?.sessions.filter((s) => s.status === "late").map((s) => dayOf(s.in)) ?? []).size;
  const hours30 = Math.round(worked.reduce((sum, s) => sum + (s.minutes ?? 0), 0) / 60);
  const marks = new Map<string, string>();
  for (const s of d?.sessions ?? []) {
    const k = dayOf(s.in);
    if (!marks.has(k) || s.status === "present") marks.set(k, s.status);
  }
  const strip = Array.from({ length: 14 }, (_, i) => {
    const iso = new Date(now - (13 - i) * 86_400_000).toISOString();
    return { iso, state: marks.get(dayOf(iso)) ?? "none" };
  });
  const age = d?.position ? freshness(new Date(d.position.at).getTime(), now) : null;

  return (
    <Screen topInset={false} contentStyle={[styles.body, { paddingTop: insets.top + space[2] }]} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft size={20} color={color.foreground} strokeWidth={2} />
      </Pressable>

      {!d ? (
        <View style={styles.missing}>
          <Text variant="label" tone="muted">
            {d === null ? "This person could not be found." : error ? `Could not load this person: ${error}` : "Loading…"}
          </Text>
          {error && d === undefined ? <Button label="Try again" variant="outline" onPress={() => void refresh()} /> : null}
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Avatar name={d.name} uri={d.avatar} size={64} />
            <View style={styles.flex}>
              <Text variant="sectionTitle" weight="bold" numberOfLines={2}>
                {d.name}
              </Text>
              <Text variant="label" tone="muted">
                {d.code} · {roleLabel(d.role, d.trade)}
              </Text>
              <View style={styles.pills}>
                {!d.active ? (
                  <StatusPill tone="offline" label="Deactivated" />
                ) : open ? (
                  <StatusPill tone={d.position?.mode === "emergency" ? "danger" : "live"} label={d.position?.mode === "emergency" ? "SOS" : "On duty"} />
                ) : (
                  <StatusPill tone="neutral" label="Off duty" />
                )}
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            {d.phone ? (
              <View style={styles.flex}>
                <Button label="Call" icon={Phone} fullWidth onPress={() => void Linking.openURL(`tel:${tel(d.phone!)}`)} />
              </View>
            ) : null}
            {d.phone ? (
              <View style={styles.flex}>
                <Button label="Message" icon={MessageCircle} variant="outline" fullWidth onPress={() => void Linking.openURL(`sms:${tel(d.phone!)}`)} />
              </View>
            ) : null}
          </View>

          <View style={styles.tiles}>
            <Tile tone="emerald" label="Employee code" value={d.code} />
            <Tile tone="violet" label="Role" value={roleLabel(d.role, d.trade)} />
          </View>

          <Panel tone="slate" bare>
            <Row icon={Phone} label="Phone" value={d.phone ?? "Not given"} first />
            <Row icon={Mail} label="Email" value={d.email ?? "Not given"} />
            <Row icon={CalendarCheck} label="Joined" value={d.joined ? dateLabel(d.joined) : "-"} />
            <Row icon={Clock3} label="Last seen" value={ago(d.lastSeen, now)} />
          </Panel>

          {d.role === "guard" && (
            <>
              <Panel tone={open ? "emerald" : "slate"} icon={MapPin} title={open ? `On duty at ${open.site}` : "Not on duty"} subtitle={open ? `Since ${istTime(open.in)}` : undefined} bare>
                {open && d.position ? (
                  <>
                    <Row
                      label="Position"
                      value={`${d.position.inside ? "Inside the boundary" : `${Math.round(d.position.distance ?? 0)} m outside`} · ${age === "live" ? "live" : `heard ${ago(d.position.at, now).replace(/^(Just now|\d+ (min|h) ago)$/, (m) => m.toLowerCase())}`}`}
                      first
                    />
                    <Row label="Duty" value={open.duty ?? "No set time"} />
                    <Row label="Battery" value={d.position.battery != null ? `${d.position.battery}%${d.position.charging ? " · charging" : ""}` : "-"} />
                    <PanelRow>
                      <View style={styles.flex}>
                        <Button label="Directions to them" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl(d.position!))} />
                      </View>
                    </PanelRow>
                  </>
                ) : (
                  <Row label="Last check-in" value={d.sessions[0] ? `${shortDay(d.sessions[0].in)} · ${d.sessions[0].site}` : "None in 30 days"} first />
                )}
              </Panel>

              {shown && (
                <RouteCard
                  key={shown.id}
                  attendanceId={shown.id}
                  open={!shown.out}
                  name={d.name.split(" ")[0] ?? d.name}
                  site={shown.fence}
                  title={!shown.out ? "Route so far" : `Route · ${shortDay(shown.in)} · ${shown.site}`}
                />
              )}

              <Panel tone="violet" title="Posting" bare>
                {d.posting ? (
                  <>
                    <Row label="Site" value={d.posting.site} first />
                    <Row label="Hours" value={`${clock12(d.posting.starts)} – ${clock12(d.posting.ends)}${d.posting.shift ? ` · ${shiftTypeLabel(d.posting.shift)}` : ""}`} />
                    <Row label="Days" value={d.posting.days.length === 7 || d.posting.days.length === 0 ? "Every day" : d.posting.days.map((n) => WEEK[n]).join(", ")} />
                  </>
                ) : (
                  <Row label="Site" value="Not posted. Post them from the website." first />
                )}
              </Panel>

              <Panel tone="sky" title="Last 30 days" bare>
                <PanelRow first>
                  <Stat value={days30} label="days" />
                  <Stat value={hours30} label="hours" />
                  <Stat value={late30} label="late" tone={late30 ? color.destructive : undefined} />
                </PanelRow>
                <PanelRow>
                  <View style={styles.strip}>
                    {strip.map((m) => (
                      <View
                        key={m.iso}
                        style={[
                          styles.mark,
                          {
                            backgroundColor:
                              m.state === "present" ? "#10b981" : m.state === "late" ? "#f59e0b" : m.state === "absent" || m.state === "rejected" ? "#ef4444" : m.state === "none" ? color.muted : "#a78bfa",
                          },
                        ]}
                      />
                    ))}
                  </View>
                </PanelRow>
              </Panel>

              <Panel tone="slate" title="Recent check-ins" subtitle="Tap one to see its route" bare>
                {d.sessions.length === 0 ? (
                  <Row label="None" value="No check-in in 30 days" first />
                ) : (
                  d.sessions.slice(0, 12).map((s, i) => (
                    <Pressable key={s.id} accessibilityRole="button" onPress={() => setPicked(s.id)}>
                    <PanelRow first={i === 0} style={shown?.id === s.id ? styles.picked : undefined}>
                      <View style={styles.flex}>
                        <Text variant="label" weight="semibold" numberOfLines={1}>
                          {s.site}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {shortDay(s.in)} · {istTime(s.in)} – {s.out ? istTime(s.out) : "now"}
                          {s.minutes ? ` · ${Math.floor(s.minutes / 60)}h ${s.minutes % 60}m` : ""}
                        </Text>
                      </View>
                      <StatusPill tone={!s.out ? "live" : s.status === "late" ? "stale" : s.status === "present" ? "primary" : "neutral"} label={!s.out ? "On duty" : s.status} />
                    </PanelRow>
                    </Pressable>
                  ))
                )}
              </Panel>
            </>
          )}

          {d.device && (
            <Panel tone="slate" icon={Smartphone} title={d.device.model} subtitle={[d.device.os, d.device.app ? `app ${d.device.app}` : null].filter(Boolean).join(" · ")} bare>
              <Row label="Approval" value={d.device.status === "approved" ? "Approved" : d.device.status === "pending" ? "Waiting for approval" : "Blocked"} first />
              {permissionRows(d.device).map((r) => (
                <Row key={r.label} label={r.label} value={`${r.ok === false ? "✕ " : r.ok ? "✓ " : ""}${r.value}`} />
              ))}
              <Row label="Reported" value={ago(d.device.seen, now)} />
            </Panel>
          )}

        </>
      )}
    </Screen>
  );
}

/**
 * What the phone has allowed the app, as the website's guard card lists it. Read at
 * the app's last launch or return to the front; `ok` null is "not reported".
 */
function permissionRows(d: NonNullable<Detail["device"]>): { label: string; value: string; ok: boolean | null }[] {
  const older = "Update the app to see";
  const rows = [
    {
      label: "Location",
      value: d.permission === "always" ? "Allow all the time" : d.permission === "foreground" ? "Only while using the app" : d.permission === "denied" ? "Not allowed" : "Not reported",
      ok: d.permission ? d.permission === "always" : null,
    },
    { label: "Precise location", value: d.precise == null ? older : d.precise ? "On" : "Approximate only", ok: d.precise },
    { label: "GPS", value: d.gps == null ? "Not reported" : d.gps ? "On" : "Switched off", ok: d.gps },
    { label: "Notifications", value: d.notifications == null ? older : d.notifications ? "Allowed" : "Blocked", ok: d.notifications },
  ];
  if (d.platform !== "ios") {
    rows.push(
      {
        label: "Battery saver",
        value: d.batteryOptimized == null ? "Not reported" : d.batteryOptimized ? "Restricting the app" : "Unrestricted",
        ok: d.batteryOptimized == null ? null : !d.batteryOptimized,
      },
      {
        label: "Autostart",
        value: d.autostart == null ? older : d.autostart === "confirmed" ? "On (confirmed)" : d.autostart === "needed" ? "Not confirmed" : "Not needed",
        ok: d.autostart == null ? null : d.autostart !== "needed",
      },
    );
  }
  return rows;
}

function Tile({ label, value, tone }: { label: string; value: string; tone: "emerald" | "violet" }) {
  const t = tone === "emerald" ? { bg: "#ecfdf5", border: "#a7f3d0", ink: "#047857" } : { bg: "#f5f3ff", border: "#ddd6fe", ink: "#6d28d9" };
  return (
    <View style={[styles.tile, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text variant="micro" weight="bold" tone="inherit" style={{ color: t.ink }}>
        {label.toUpperCase()}
      </Text>
      <Text variant="title" weight="bold" style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Row({ icon: Icon, label, value, first }: { icon?: typeof Phone; label: string; value: string; first?: boolean }) {
  return (
    <PanelRow first={first}>
      {Icon ? <Icon size={16} color={color.mutedForeground} strokeWidth={2} /> : null}
      <Text variant="label" tone="muted" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="label" weight="medium" style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </PanelRow>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" weight="bold" tone="inherit" style={{ color: tone ?? color.foreground }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { gap: space[3], alignItems: "flex-start" },
  picked: { backgroundColor: "#e0f2fe" },
  body: { gap: space[4], paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.card, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  pressed: { opacity: 0.7 },
  hero: { flexDirection: "row", gap: space[4], alignItems: "center" },
  pills: { flexDirection: "row", marginTop: space[1] },
  actions: { flexDirection: "row", gap: space[2] },
  tiles: { flexDirection: "row", gap: space[2] },
  tile: { flex: 1, gap: space[1], padding: space[3], borderRadius: radius.xl, borderWidth: 1 },
  tileValue: { letterSpacing: 1 },
  rowLabel: { width: 96 },
  rowValue: { flex: 1, textAlign: "right" },
  stat: { flex: 1, alignItems: "center" },
  strip: { flex: 1, flexDirection: "row", gap: 4 },
  mark: { flex: 1, height: 18, borderRadius: 4 },
});
