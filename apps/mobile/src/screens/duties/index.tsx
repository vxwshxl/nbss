import { router } from "expo-router";
import {
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Navigation,
  Percent,
  UserRoundX,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import {
  directionsUrl,
  dutiesBetween,
  dutyOutcome,
  myDuties,
  OUTCOME_LABEL,
  requestReplacement,
  withdrawReplacement,
  type DutyOutcome,
  type MyDuty,
} from "@/lib/duty";
import { color, radius, space } from "@/theme/tokens";

const IST = "Asia/Kolkata";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
export const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The request's clock, read when the list is built. */
function today(): string {
  return dayKey(new Date().toISOString());
}

export const OUTCOME_TONE: Record<DutyOutcome, "live" | "stale" | "offline" | "neutral" | "primary" | "danger"> = {
  present: "live",
  late: "stale",
  absent: "danger",
  replaced: "neutral",
  upcoming: "neutral",
  not_arrived: "danger",
  pending_review: "stale",
  rejected: "danger",
  on_duty: "primary",
};

export function openDuty(d: Pick<MyDuty, "id">) {
  router.push({ pathname: "/shift/[id]", params: { id: d.id } });
}

/**
 * My duties, in two halves. Upcoming: today and what is coming, each with
 * "I can't come". History: any month or year, with the same counts the
 * console's attendance register shows (present, late, absent, hours,
 * attendance rate), so the guard and the office read the same numbers.
 * Every row opens the duty in full.
 */
export function Duties() {
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  // A pull-to-refresh bumps this; whichever half is showing reloads on it.
  const [pulls, setPulls] = useState(0);
  const [pulling, setPulling] = useState(false);

  return (
    <Screen
      topInset={false}
      contentStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            setPulls((n) => n + 1);
            // The half on screen reloads on `pulls`; the spinner is given a moment, then let go.
            setTimeout(() => setPulling(false), 800);
          }}
          tintColor={color.primary}
        />
      }
    >
      <Segmented
        stretch
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "history", label: "History" },
        ]}
      />
      {tab === "upcoming" ? <Upcoming pulls={pulls} /> : <History pulls={pulls} />}
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────── upcoming ── */

function Upcoming({ pulls }: { pulls: number }) {
  const { data, reload } = useLoader(myDuties);
  const [asking, setAsking] = useState<MyDuty | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const now = useNow(60_000);

  // Fresh on arrival and whenever the office changes a duty, from the website or a phone.
  useLiveTables(["shifts", "attendance", "replacement_requests"], reload);
  useEffect(() => {
    if (pulls) void reload();
  }, [pulls, reload]);

  const duties = data ?? [];
  const t = today();
  const live = (d: MyDuty) => d.status === "in_progress" || (d.status === "scheduled" && new Date(d.ends_at).getTime() > now);
  const todays = duties.filter((d) => live(d) && dayKey(d.starts_at) <= t);
  const upcoming = duties.filter((d) => live(d) && dayKey(d.starts_at) > t);

  const withdraw = async (d: MyDuty) => {
    if (!d.request) return;
    const r = await withdrawReplacement(d.request.id);
    setNote(r.ok ? { tone: "ok", text: "Request withdrawn. The duty is yours again." } : { tone: "bad", text: r.error ?? "That did not go through." });
    await reload();
  };

  return (
    <View style={styles.stack}>
      {note && (
        <Panel tone={note.tone === "ok" ? "emerald" : "rose"}>
          <Text variant="body">{note.text}</Text>
        </Panel>
      )}

      {data && todays.length + upcoming.length === 0 && (
        <EmptyState icon={CalendarClock} title="Nothing coming up" body="When the office puts you on the roster, your duties appear here. Past duties are under History." />
      )}

      {todays.length > 0 && <Section title="Today" duties={todays} now={now} onAsk={setAsking} onWithdraw={withdraw} />}
      {upcoming.length > 0 && <Section title="Coming up" duties={upcoming} now={now} onAsk={setAsking} onWithdraw={withdraw} />}

      <AskCover
        duty={asking}
        onClose={() => setAsking(null)}
        onDone={(r) => {
          setNote(r);
          void reload();
        }}
      />
    </View>
  );
}

function Section({
  title,
  duties,
  now,
  onAsk,
  onWithdraw,
}: {
  title: string;
  duties: MyDuty[];
  now: number;
  onAsk: (d: MyDuty) => void;
  onWithdraw: (d: MyDuty) => void;
}) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" weight="bold" tone="muted" uppercase>
        {title}
      </Text>
      {duties.map((d) => (
        <DutyCard key={d.id} d={d} now={now} onAsk={() => onAsk(d)} onWithdraw={() => onWithdraw(d)} />
      ))}
    </View>
  );
}

function DutyCard({ d, now, onAsk, onWithdraw }: { d: MyDuty; now: number; onAsk: () => void; onWithdraw: () => void }) {
  const type = shiftTypeLabel(d.shift_type);
  const open = d.request?.status === "open";
  const outcome = dutyOutcome(d, now);
  const label = open ? "Cover asked" : d.request?.status === "declined" ? "Cover declined" : outcome === "on_duty" ? "On duty now" : OUTCOME_LABEL[outcome];
  const tone = open || d.request?.status === "declined" ? "stale" : OUTCOME_TONE[outcome];
  const canAsk = d.status === "scheduled" && !d.replaced_by;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => openDuty(d)} style={({ pressed }) => [styles.cardTap, pressed && styles.pressed]} accessibilityRole="button" accessibilityHint="Opens the duty in full">
      <View style={styles.cardHead}>
        <DateBox iso={d.starts_at} />
        <View style={styles.flex}>
          <Text variant="label" weight="semibold" numberOfLines={1}>
            {d.site.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[type, `${clock(d.starts_at)} – ${clock(d.ends_at)}`].filter(Boolean).join(" · ")}
          </Text>
          {d.replacing && (
            <Text variant="caption" weight="semibold" tone="primary" numberOfLines={1}>
              Covering for {d.replacing}
            </Text>
          )}
          <View style={styles.pill}>
            <StatusPill tone={tone} label={label} />
          </View>
        </View>
        <ChevronRight size={18} color={color.mutedForeground} strokeWidth={2} />
      </View>

      {d.attendance?.check_in_at && (
        <View style={styles.inline}>
          <Check size={14} color={color.primary} strokeWidth={2.4} />
          <Text variant="caption" tone="muted">
            In {clock(d.attendance.check_in_at)}
            {d.attendance.check_out_at ? ` · Out ${clock(d.attendance.check_out_at)}${d.attendance.auto_check_out ? " (auto)" : ""}` : ""}
          </Text>
        </View>
      )}
      </Pressable>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Directions" icon={Navigation} variant="outline" size="sm" fullWidth onPress={() => void Linking.openURL(directionsUrl(d.site))} />
        </View>
        {canAsk && (
          <View style={styles.flex}>
            {open ? (
              <Button label="Withdraw" icon={CalendarX2} variant="outline" size="sm" fullWidth onPress={onWithdraw} />
            ) : (
              <Button label="I can't come" icon={UserRoundX} variant="outline" size="sm" fullWidth onPress={onAsk} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export function DateBox({ iso, small }: { iso: string; small?: boolean }) {
  return (
    <View style={[styles.dateBox, small && styles.dateBoxSmall]}>
      <Text variant="micro" weight="semibold" tone="primary" uppercase>
        {new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" })}
      </Text>
      <Text variant={small ? "label" : "title"} weight="bold">
        {new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric" })}
      </Text>
    </View>
  );
}

/** "I can't come": the reason, and the request to the desk. */
export function AskCover({
  duty,
  onClose,
  onDone,
}: {
  duty: MyDuty | null;
  onClose: () => void;
  onDone: (r: { tone: "ok" | "bad"; text: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!duty) return;
    setBusy(true);
    const r = await requestReplacement(duty.id, reason);
    setBusy(false);
    setReason("");
    onClose();
    onDone(r.ok ? { tone: "ok", text: "Sent. The office will find someone and tell you." } : { tone: "bad", text: r.error ?? "That did not go through." });
  };

  return (
    <Modal visible={!!duty} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={() => undefined}>
          <Text variant="title" weight="semibold">
            I can&apos;t come
          </Text>
          {duty && (
            <Text variant="body" tone="muted">
              {duty.site.name} · {dayLabel(duty.starts_at)}, {clock(duty.starts_at)} – {clock(duty.ends_at)}. The office will send someone in your place.
            </Text>
          )}
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Why? (sick, family, travel…)"
            placeholderTextColor={color.mutedForeground}
            maxLength={500}
            style={styles.input}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label="Back" variant="outline" fullWidth onPress={onClose} />
            </View>
            <View style={styles.flex}>
              <Button label="Ask for cover" fullWidth loading={busy} onPress={() => void send()} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────── history ── */

type Period = { mode: "month" | "year"; year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function range(p: Period): [string, string] {
  if (p.mode === "year") return [`${p.year}-01-01`, `${p.year}-12-31`];
  return [`${p.year}-${pad(p.month + 1)}-01`, `${p.year}-${pad(p.month + 1)}-${pad(lastDay(p.year, p.month))}`];
}

/** The register's counts, from the same rules as the console's. */
function tally(rows: MyDuty[], now: number) {
  // Counted by day, as the console counts: two check-ins on one day are one day present.
  const out = rows.map((d) => ({ d, o: dutyOutcome(d, now), day: dayKey(d.attendance?.check_in_at ?? d.starts_at) }));
  const came = (o: DutyOutcome) => o === "present" || o === "late" || o === "on_duty" || o === "pending_review";
  const presentDays = new Set(out.filter(({ o }) => came(o)).map(({ day }) => day));
  const late = new Set(out.filter(({ o }) => o === "late").map(({ day }) => day)).size;
  const absent = new Set(out.filter(({ o, day }) => o === "absent" && !presentDays.has(day)).map(({ day }) => day)).size;
  const minutes = rows.reduce((n, d) => n + (d.attendance?.worked_minutes ?? 0), 0);
  const dueDays = [...new Set(out.filter(({ d, o }) => o !== "upcoming" && o !== "replaced" && d.kind !== "off_roster").map(({ day }) => day))];
  const rate = dueDays.length ? Math.round((dueDays.filter((day) => presentDays.has(day)).length / dueDays.length) * 100) : null;
  return { present: presentDays.size, late, absent, minutes, rate, due: dueDays.length };
}

function History({ pulls }: { pulls: number }) {
  const t = today();
  const [period, setPeriod] = useState<Period>({ mode: "month", year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) - 1 });
  const [rows, setRows] = useState<MyDuty[] | null>(null);
  const now = useNow(60_000);
  const [from, to] = range(period);

  useEffect(() => {
    let live = true;
    void dutiesBetween(from, to).then((r) => {
      if (live) setRows(r);
    });
    return () => {
      live = false;
    };
  }, [from, to, pulls]);

  const step = (dir: -1 | 1) => {
    setRows(null);
    setPeriod((p) => {
      if (p.mode === "year") return { ...p, year: p.year + dir };
      const m = p.month + dir;
      return { ...p, year: p.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const past = useMemo(() => (rows ?? []).filter((d) => dutyOutcome(d, now) !== "upcoming"), [rows, now]);
  const sum = tally(past, now);
  const atLatest = period.mode === "year" ? period.year >= Number(t.slice(0, 4)) : `${period.year}-${pad(period.month + 1)}` >= t.slice(0, 7);

  return (
    <View style={styles.stack}>
      <View style={styles.periodBar}>
        <Segmented
          value={period.mode}
          onChange={(mode) => {
            setRows(null);
            setPeriod((p) => ({ ...p, mode }));
          }}
          options={[
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
        />
        <View style={styles.stepper}>
          <StepButton icon={ChevronLeft} label="Earlier" onPress={() => step(-1)} />
          <Text variant="label" weight="semibold" style={styles.periodLabel} numberOfLines={1}>
            {period.mode === "year" ? String(period.year) : `${MONTHS[period.month]!.slice(0, 3)} ${period.year}`}
          </Text>
          <StepButton icon={ChevronRight} label="Later" disabled={atLatest} onPress={() => step(1)} />
        </View>
      </View>

      <CardGrid columns={2}>
        <StatCard label="Present" value={rows ? String(sum.present) : "-"} hint={`${sum.late} late`} icon={CalendarCheck} tone="emerald" />
        <StatCard label="Absent" value={rows ? String(sum.absent) : "-"} hint="Rostered, no check-in" icon={CalendarX2} tone={sum.absent ? "rose" : "slate"} />
        <StatCard label="Hours" value={rows ? (sum.minutes / 60).toFixed(1) : "-"} hint="Worked" icon={Clock} tone="sky" />
        <StatCard label="Attendance" value={rows && sum.rate !== null ? `${sum.rate}%` : "-"} hint={`${sum.due} duties due`} icon={Percent} tone="violet" />
      </CardGrid>

      {period.mode === "year" ? (
        <YearTable
          rows={past}
          now={now}
          year={period.year}
          loading={!rows}
          onMonth={(month) => {
            setRows(null);
            setPeriod({ mode: "month", year: period.year, month });
          }}
        />
      ) : (
        <MonthTable rows={past} now={now} loading={!rows} title={`${MONTHS[period.month]} ${period.year}`} />
      )}
    </View>
  );
}

function StepButton({ icon: Icon, label, onPress, disabled }: { icon: typeof ChevronLeft; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.step, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon size={18} color={color.foreground} strokeWidth={2} />
    </Pressable>
  );
}

function MonthTable({ rows, now, loading, title }: { rows: MyDuty[]; now: number; loading: boolean; title: string }) {
  const sorted = [...rows].reverse();
  return (
    <Panel tone="emerald" title="Duty register" subtitle={loading ? "Loading…" : `${title} · ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`} icon={CalendarRange} bare>
      {!loading && rows.length === 0 && (
        <PanelRow first>
          <Text variant="label" tone="muted">
            No duties or check-ins in this month.
          </Text>
        </PanelRow>
      )}
      {sorted.map((d, i) => {
        const o = dutyOutcome(d, now);
        const type = shiftTypeLabel(d.shift_type);
        return (
          <Pressable key={d.id} onPress={() => openDuty(d)} accessibilityRole="button">
            {({ pressed }) => (
              <PanelRow first={i === 0} style={[o === "absent" && styles.absentRow, pressed && styles.pressedRow]}>
                <DateBox iso={d.starts_at} small />
                <View style={styles.flex}>
                  <Text variant="label" weight="semibold" numberOfLines={1}>
                    {d.site.name}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {d.kind === "off_roster"
                      ? "Not on the roster"
                      : [type, `${clock(d.starts_at)}–${clock(d.ends_at)}`].filter(Boolean).join(" · ")}
                  </Text>
                  <View style={styles.pill}>
                    <StatusPill tone={OUTCOME_TONE[o]} label={OUTCOME_LABEL[o]} />
                  </View>
                </View>
                <View style={styles.right}>
                  <Text variant="label" weight="semibold" mono>
                    {d.attendance?.worked_minutes != null ? hm(d.attendance.worked_minutes) : "-"}
                  </Text>
                  <Text variant="caption" tone="muted" mono>
                    {d.attendance?.check_in_at ? `${clock(d.attendance.check_in_at)}${d.attendance.check_out_at ? `–${clock(d.attendance.check_out_at)}${d.attendance.auto_check_out ? " auto" : ""}` : ""}` : ""}
                  </Text>
                </View>
              </PanelRow>
            )}
          </Pressable>
        );
      })}
    </Panel>
  );
}

function YearTable({ rows, now, year, loading, onMonth }: { rows: MyDuty[]; now: number; year: number; loading: boolean; onMonth: (m: number) => void }) {
  const t = today();
  const months = MONTHS.map((name, m) => {
    const key = `${year}-${pad(m + 1)}`;
    const these = rows.filter((d) => dayKey(d.starts_at).startsWith(key));
    return { name, m, key, these, sum: tally(these, now) };
  }).filter((x) => x.key <= t.slice(0, 7));

  return (
    <Panel tone="sky" title="Month by month" subtitle={loading ? "Loading…" : `${year}`} icon={CalendarRange} bare>
      <PanelRow first style={styles.headRow}>
        <Text variant="micro" weight="semibold" tone="muted" style={styles.flex} uppercase>
          Month
        </Text>
        <Text variant="micro" weight="semibold" tone="muted" style={styles.num} uppercase>
          Present
        </Text>
        <Text variant="micro" weight="semibold" tone="muted" style={styles.num} uppercase>
          Absent
        </Text>
        <Text variant="micro" weight="semibold" tone="muted" style={styles.num} uppercase>
          Hours
        </Text>
      </PanelRow>
      {[...months].reverse().map((x) => (
        <Pressable key={x.key} onPress={() => onMonth(x.m)} accessibilityRole="button" accessibilityLabel={`${x.name}: ${x.sum.present} present, ${x.sum.absent} absent`}>
          {({ pressed }) => (
            <PanelRow style={pressed && styles.pressedRow}>
              <Text variant="label" weight="semibold" style={styles.flex}>
                {x.name}
              </Text>
              <Text variant="label" mono style={styles.num}>
                {x.these.length ? x.sum.present : "-"}
              </Text>
              <Text variant="label" mono tone={x.sum.absent ? "danger" : "default"} style={styles.num}>
                {x.these.length ? x.sum.absent : "-"}
              </Text>
              <Text variant="label" mono style={styles.num}>
                {x.these.length ? (x.sum.minutes / 60).toFixed(1) : "-"}
              </Text>
            </PanelRow>
          )}
        </Pressable>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[5], paddingBottom: 120 },
  stack: { gap: space[5] },
  section: { gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: space[2] },
  inline: { flexDirection: "row", alignItems: "center", gap: space[2] },
  pill: { marginTop: space[2] },
  card: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[4], gap: space[3], borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft },
  pressed: { opacity: 0.7 },
  cardTap: { gap: space[3] },
  cardHead: { flexDirection: "row", gap: space[3], alignItems: "center" },
  dateBox: { width: 52, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.accent },
  dateBoxSmall: { width: 44, paddingVertical: space[1] },
  periodBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2], flexWrap: "wrap" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space[1], backgroundColor: color.card, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft, padding: 3 },
  periodLabel: { minWidth: 84, textAlign: "center" },
  step: { width: 32, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.muted },
  disabled: { opacity: 0.35 },
  right: { alignItems: "flex-end", gap: 2 },
  absentRow: { backgroundColor: "#fff1f2" },
  pressedRow: { backgroundColor: color.muted },
  headRow: { paddingVertical: space[2], backgroundColor: "#fafafa" },
  num: { width: 58, textAlign: "right" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: space[5] },
  dialog: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[5], gap: space[3] },
  input: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, paddingHorizontal: space[3], color: color.foreground, fontSize: 16 },
});
