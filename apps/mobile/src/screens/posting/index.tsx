import { router } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Plus,
  UserMinus,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { roleLabel, type Role } from "@nbss/shared/identity";
import {
  SHIFT_TYPES,
  checkBreaks,
  hoursLabel,
  readBreaks,
  type Break,
} from "@nbss/shared/shifts";

import { Button } from "@/components/button";
import { showDialog } from "@/components/dialog";
import { Panel, PanelRow } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Select, type SelectOption } from "@/components/select";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { endPosting, savePosting } from "@/lib/posting";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

/** ISO weekdays, Monday first, as `site_postings.days` stores them. */
const WEEK = [
  { n: 1, l: "Mon" },
  { n: 2, l: "Tue" },
  { n: 3, l: "Wed" },
  { n: 4, l: "Thu" },
  { n: 5, l: "Fri" },
  { n: 6, l: "Sat" },
  { n: 7, l: "Sun" },
];

const clock = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:${t.slice(3, 5)} ${h < 12 ? "am" : "pm"}`;
};
/** Every quarter hour, as the dropdowns offer it. */
const TIMES: SelectOption<string>[] = Array.from({ length: 96 }, (_, i) => {
  const t = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;
  return { value: t, label: clock(t) };
});
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const at = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
/** A time the dropdown offers: a stored "08:10:00" shows as 8:10 even off the quarter hours. */
const withTime = (t: string) =>
  TIMES.some((o) => o.value === t)
    ? TIMES
    : [...TIMES, { value: t, label: clock(t) }].sort((a, b) =>
        a.value.localeCompare(b.value),
      );

type Loaded = {
  name: string;
  role: Role;
  trade: string | null;
  posting: {
    id: string;
    siteId: string;
    starts: string;
    ends: string;
    days: number[];
    breaks: Break[];
  } | null;
  sites: { id: string; name: string }[];
};

async function load(id: string): Promise<Loaded | null> {
  const [p, post, sites] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, trade")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("site_postings")
      .select("id, site_id, starts, ends, days, breaks")
      .eq("guard_id", id)
      .eq("active", true)
      .is("dates", null)
      .maybeSingle(),
    supabase.from("sites").select("id, name").eq("active", true).order("name"),
  ]);
  if (!p.data) return null;
  const x = post.data;
  return {
    name: p.data.full_name,
    role: p.data.role as Role,
    trade: p.data.trade,
    posting: x
      ? {
          id: x.id,
          siteId: x.site_id,
          starts: x.starts.slice(0, 5),
          ends: x.ends.slice(0, 5),
          days: x.days ?? [],
          breaks: readBreaks(x.breaks),
        }
      : null,
    sites: sites.data ?? [],
  };
}

/**
 * Post a guard, housekeeper or supervisor to a site, or change their post: the site,
 * the hours, the days and any breaks. As on the website's Roster: new hours apply from
 * now, to the duty running today too, and each part of a day with a break is its own
 * duty, checked out of automatically at its end. Nobody is created here.
 */
export function PostingPage({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const loader = useCallback(() => load(id), [id]);
  const { data: d, error } = useLoader(loader);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <Screen
      topInset={false}
      contentStyle={[styles.body, { paddingTop: insets.top + space[2] }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <ArrowLeft size={20} color={color.foreground} strokeWidth={2} />
      </Pressable>

      {!d ? (
        <Text variant="label" tone="muted">
          {d === null
            ? "This person could not be found."
            : error
              ? `Could not load: ${error}`
              : "Loading…"}
        </Text>
      ) : d.role !== "guard" && d.role !== "supervisor" ? (
        <Text variant="label" tone="muted">
          Only guards, housekeepers and supervisors are posted to sites.
        </Text>
      ) : (
        // Keyed by the post, so the form starts from it as loaded.
        <PostingForm key={d.posting?.id ?? "new"} id={id} d={d} back={back} />
      )}
    </Screen>
  );
}

function PostingForm({
  id,
  d,
  back,
}: {
  id: string;
  d: Loaded;
  back: () => void;
}) {
  const [siteId, setSiteId] = useState(d.posting?.siteId ?? "");
  const [starts, setStarts] = useState(d.posting?.starts ?? "08:00");
  const [ends, setEnds] = useState(d.posting?.ends ?? "20:00");
  const [days, setDays] = useState<number[]>(
    d.posting?.days.length ? d.posting.days : [1, 2, 3, 4, 5, 6, 7],
  );
  const [breaks, setBreaks] = useState<Break[]>(d.posting?.breaks ?? []);
  const [busy, setBusy] = useState<"save" | "end" | null>(null);

  const checked = checkBreaks(starts, ends, breaks);
  const moving = !!d.posting && siteId !== d.posting.siteId;
  const ready = !!siteId && days.length > 0 && checked.ok && !busy;
  const firstName = d.name.split(" ")[0] ?? "them";

  function addBreak() {
    const len = (mins(ends) - mins(starts) + 1440) % 1440 || 1440;
    const lastEnd = breaks.length
      ? (mins(breaks.at(-1)!.ends) - mins(starts) + 1440) % 1440
      : 0;
    const from = Math.max(
      30,
      Math.min(Math.max(lastEnd + 60, Math.floor(len / 2 / 60) * 60), len - 90),
    );
    setBreaks([
      ...breaks,
      { starts: at(mins(starts) + from), ends: at(mins(starts) + from + 60) },
    ]);
  }

  async function save() {
    setBusy("save");
    const r = await savePosting({
      guardId: id,
      siteId,
      starts,
      ends,
      days: [...days].sort(),
      breaks: checked.ok ? checked.breaks : breaks,
    });
    setBusy(null);
    if (!r.ok) return showDialog("Not saved", r.error);
    showDialog("Saved", r.note ?? `${d.name} posted.`, [
      { text: "OK", onPress: back },
    ]);
  }

  function takeOff() {
    if (!d.posting) return;
    showDialog(
      `Take ${firstName} off this post?`,
      "Their upcoming duties at this site are withdrawn. Attendance already recorded is kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take off",
          style: "destructive",
          onPress: () => {
            setBusy("end");
            void endPosting(d.posting!.id).then((r) => {
              setBusy(null);
              if (!r.ok) return showDialog("Not changed", r.error);
              showDialog("Done", `${d.name} is no longer posted.`, [
                { text: "OK", onPress: back },
              ]);
            });
          },
        },
      ],
    );
  }

  return (
    <>
      <View style={styles.gap1}>
        <Text variant="sectionTitle" weight="bold">
          {d.posting ? `${firstName}'s post` : `Post ${firstName}`}
        </Text>
        <Text variant="label" tone="muted">
          {d.name} · {roleLabel(d.role, d.trade)}
        </Text>
      </View>

      <Panel tone="violet" title="Where" bare>
        <PanelRow first>
          <Select
            title="Site"
            value={siteId}
            onChange={setSiteId}
            options={d.sites.map((s) => ({ value: s.id, label: s.name }))}
            style={styles.flex}
          />
        </PanelRow>
        {moving ? (
          <PanelRow>
            <Text variant="caption" tone="muted">
              Moving them: their upcoming duties at the old site are withdrawn.
            </Text>
          </PanelRow>
        ) : null}
      </Panel>

      <Panel tone="sky" title="Hours" bare>
        <PanelRow first>
          <View style={styles.chips}>
            {SHIFT_TYPES.map((t) => {
              const on = starts === t.starts && ends === t.ends;
              return (
                <Pressable
                  key={t.code}
                  onPress={() => {
                    setStarts(t.starts);
                    setEnds(t.ends);
                    setBreaks([]);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={on ? styles.chipOnText : undefined}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </PanelRow>
        <PanelRow>
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Text variant="caption" tone="muted">
                From
              </Text>
              <Select
                title="Starts"
                value={starts}
                onChange={setStarts}
                options={withTime(starts)}
              />
            </View>
            <View style={styles.flex}>
              <Text variant="caption" tone="muted">
                To
              </Text>
              <Select
                title="Ends"
                value={ends}
                onChange={setEnds}
                options={withTime(ends)}
              />
            </View>
          </View>
        </PanelRow>
        <PanelRow>
          <View style={styles.chips}>
            {WEEK.map((w) => {
              const on = days.includes(w.n);
              return (
                <Pressable
                  key={w.n}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() =>
                    setDays(on ? days.filter((x) => x !== w.n) : [...days, w.n])
                  }
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={on ? styles.chipOnText : undefined}
                  >
                    {w.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </PanelRow>
      </Panel>

      <Panel tone="amber" title="Breaks" bare>
        {breaks.map((b, i) => (
          <PanelRow key={i} first={i === 0}>
            <Coffee size={16} color={color.mutedForeground} strokeWidth={2} />
            <View style={styles.flex}>
              <Select
                title="Break starts"
                value={b.starts}
                onChange={(v) =>
                  setBreaks(
                    breaks.map((x, k) => (k === i ? { ...x, starts: v } : x)),
                  )
                }
                options={withTime(b.starts)}
              />
            </View>
            <Text variant="caption" tone="muted">
              to
            </Text>
            <View style={styles.flex}>
              <Select
                title="Break ends"
                value={b.ends}
                onChange={(v) =>
                  setBreaks(
                    breaks.map((x, k) => (k === i ? { ...x, ends: v } : x)),
                  )
                }
                options={withTime(b.ends)}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this break"
              hitSlop={8}
              onPress={() => setBreaks(breaks.filter((_, k) => k !== i))}
            >
              <X size={18} color={color.mutedForeground} strokeWidth={2} />
            </Pressable>
          </PanelRow>
        ))}
        <PanelRow first={breaks.length === 0}>
          <View style={styles.gap1}>
            {breaks.length < 6 ? (
              <Button
                label="Add a break"
                icon={Plus}
                variant="outline"
                size="sm"
                onPress={addBreak}
              />
            ) : null}
            <Text variant="caption" tone={checked.ok ? "muted" : "danger"}>
              {!checked.ok
                ? checked.error
                : breaks.length
                  ? `On duty ${hoursLabel(starts, ends, checked.breaks)}. Each part is checked out of automatically at its end.`
                  : "Off for part of the shift? Add a break, as many as needed."}
            </Text>
          </View>
        </PanelRow>
      </Panel>

      {d.posting ? (
        <Text variant="caption" tone="muted">
          New hours apply from now, to today&apos;s duty too: it ends at the new
          time and is checked out automatically then.
        </Text>
      ) : null}

      <Button
        label={d.posting ? "Save post" : "Post"}
        icon={CheckCircle2}
        size="lg"
        fullWidth
        disabled={!ready}
        loading={busy === "save"}
        onPress={() => void save()}
      />
      {d.posting ? (
        <Button
          label="Take off this post"
          icon={UserMinus}
          variant="ghost"
          fullWidth
          loading={busy === "end"}
          disabled={!!busy}
          onPress={takeOff}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], paddingBottom: 48 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  pressed: { opacity: 0.7 },
  gap1: { flex: 1, gap: space[2] },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  pair: { flex: 1, flexDirection: "row", gap: space[3] },
  chips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
  },
  chipOn: { backgroundColor: color.primary, borderColor: color.primary },
  chipOnText: { color: color.primaryForeground },
});
