import { useFocusEffect } from "expo-router";
import { CalendarClock, CalendarX2, Check, MapPin, Navigation, UserRoundX } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { Screen } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { directionsUrl, myDuties, requestReplacement, withdrawReplacement, type MyDuty } from "@/lib/duty";
import { color, radius, space } from "@/theme/tokens";

const IST = "Asia/Kolkata";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

/** The request's clock, read when the list is built. */
function today(): string {
  return dayKey(new Date().toISOString());
}

/**
 * My duties: the guard's own roster, in the order they live it — today, what is
 * coming, and what is done. Plain words on every card (where, when, which shift,
 * and whether it is theirs or they are covering), and one action that matters:
 * "I can't come", which asks the desk for a replacement.
 */
export function Duties() {
  const { data, refreshing, reload } = useLoader(myDuties);
  const [asking, setAsking] = useState<MyDuty | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const duties = data ?? [];
  const t = today();
  const now = useNow(60_000);
  const doneOrPast = (d: MyDuty) => d.status === "completed" || d.status === "missed" || (new Date(d.ends_at).getTime() < now && d.status !== "in_progress");
  const todays = duties.filter((d) => dayKey(d.starts_at) === t && !doneOrPast(d));
  const upcoming = duties.filter((d) => dayKey(d.starts_at) > t && !doneOrPast(d));
  const done = duties.filter(doneOrPast).reverse();

  const send = async () => {
    if (!asking) return;
    setBusy(true);
    const r = await requestReplacement(asking.id, reason);
    setBusy(false);
    setAsking(null);
    setReason("");
    setNote(r.ok ? { tone: "ok", text: "Sent. The office will find someone and tell you." } : { tone: "bad", text: r.error ?? "That did not go through." });
    await reload();
  };

  const withdraw = async (d: MyDuty) => {
    if (!d.request) return;
    const r = await withdrawReplacement(d.request.id);
    setNote(r.ok ? { tone: "ok", text: "Request withdrawn. The duty is yours again." } : { tone: "bad", text: r.error ?? "That did not go through." });
    await reload();
  };

  return (
    <Screen
      topInset={false}
      contentStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.primary} />}
    >
      {note && (
        <Panel tone={note.tone === "ok" ? "emerald" : "rose"}>
          <Text variant="body">{note.text}</Text>
        </Panel>
      )}

      {data && duties.length === 0 && (
        <EmptyState icon={CalendarClock} title="No duties yet" body="When the office puts you on the roster, your duties appear here." />
      )}

      {todays.length > 0 && <Section title="Today" duties={todays} now={now} onAsk={setAsking} onWithdraw={withdraw} />}
      {upcoming.length > 0 && <Section title="Coming up" duties={upcoming} now={now} onAsk={setAsking} onWithdraw={withdraw} />}
      {done.length > 0 && <Section title="Done" duties={done} now={now} onAsk={setAsking} onWithdraw={withdraw} />}

      <Modal visible={!!asking} transparent animationType="fade" onRequestClose={() => setAsking(null)}>
        <Pressable style={styles.scrim} onPress={() => setAsking(null)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text variant="title" weight="semibold">
              I can&apos;t come
            </Text>
            {asking && (
              <Text variant="body" tone="muted">
                {asking.site.name} · {dayLabel(asking.starts_at)}, {clock(asking.starts_at)} – {clock(asking.ends_at)}. The office will send someone in your place.
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
                <Button label="Back" variant="outline" fullWidth onPress={() => setAsking(null)} />
              </View>
              <View style={styles.flex}>
                <Button label="Ask for cover" fullWidth loading={busy} onPress={() => void send()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
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
  const handedOver = !!d.replaced_by;
  const upcoming = !handedOver && (d.status === "scheduled" || d.status === "in_progress") && new Date(d.ends_at).getTime() > now;
  const open = d.request?.status === "open";

  let pill: { tone: "live" | "stale" | "offline" | "neutral" | "primary" | "danger"; label: string };
  if (handedOver) pill = { tone: "neutral", label: `Replaced by ${d.replaced_by}` };
  else if (d.status === "completed" || d.attendance?.check_out_at) pill = { tone: "live", label: `Done · ${hm(d.attendance?.worked_minutes ?? 0)}` };
  else if (d.status === "in_progress") pill = { tone: "primary", label: "On duty now" };
  else if (d.status === "missed") pill = { tone: "danger", label: "Missed" };
  else if (open) pill = { tone: "stale", label: "Cover asked" };
  else if (d.request?.status === "declined") pill = { tone: "stale", label: "Cover declined" };
  else pill = { tone: "neutral", label: "Upcoming" };

  return (
    <View style={[styles.card, handedOver && styles.cardMuted]}>
      <View style={styles.cardHead}>
        <View style={styles.dateBox}>
          <Text variant="caption" weight="semibold" tone="primary">
            {new Date(d.starts_at).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" })}
          </Text>
          <Text variant="title" weight="bold">
            {new Date(d.starts_at).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric" })}
          </Text>
        </View>
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
            <StatusPill tone={pill.tone} label={pill.label} />
          </View>
        </View>
      </View>

      {d.attendance?.check_in_at && (
        <View style={styles.inline}>
          <Check size={14} color={color.primary} strokeWidth={2.4} />
          <Text variant="caption" tone="muted">
            In {clock(d.attendance.check_in_at)}
            {d.attendance.check_out_at ? ` · Out ${clock(d.attendance.check_out_at)}` : ""}
          </Text>
        </View>
      )}

      {upcoming && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl(d.site))} />
          </View>
          <View style={styles.flex}>
            {open ? (
              <Button label="Withdraw request" icon={CalendarX2} variant="outline" fullWidth onPress={onWithdraw} />
            ) : (
              <Button label="I can't come" icon={UserRoundX} variant="outline" fullWidth onPress={onAsk} />
            )}
          </View>
        </View>
      )}
      {!upcoming && d.site.address ? (
        <View style={styles.inline}>
          <MapPin size={14} color={color.mutedForeground} strokeWidth={2} />
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {d.site.address}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[5], paddingBottom: space[8] },
  section: { gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: space[2] },
  inline: { flexDirection: "row", alignItems: "center", gap: space[2] },
  pill: { marginTop: space[2] },
  card: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[4], gap: space[3], borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft },
  cardMuted: { opacity: 0.7 },
  cardHead: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  dateBox: { width: 52, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.accent },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: space[5] },
  dialog: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[5], gap: space[3] },
  input: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, paddingHorizontal: space[3], color: color.foreground, fontSize: 16 },
});
