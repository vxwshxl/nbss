import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";

import { isValidPhone } from "@nbss/shared/identity";
import { SHIFT_TYPES, type ShiftType } from "@nbss/shared/shifts";

import { Button } from "@/components/button";
import { Panel } from "@/components/panel";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

/**
 * Booking guards, from the app.
 *
 * Calls `submit_service_request` (0007), which takes the client from the JWT rather than
 * from the form — so a request cannot be filed in somebody else's name, and the reference
 * it returns is the one the deployment desk will quote back on the phone.
 *
 * The form is deliberately short. Everything that is genuinely needed to ring somebody
 * back and quote them is here; everything else — exact posts, uniform, armed or not —
 * is a conversation, and asking for it in a form would lose the enquiry.
 */

const SERVICES = [
  { slug: "corporate-security", label: "Corporate & office" },
  { slug: "industrial-security", label: "Industrial & factory" },
  { slug: "hospital-security", label: "Hospital & healthcare" },
  { slug: "education-security", label: "School & college" },
  { slug: "government-security", label: "Government & PSU" },
  { slug: "event-security", label: "Event & crowd" },
  { slug: "residential-security", label: "Residential & gated" },
  { slug: "housekeeping", label: "Housekeeping & facility" },
];

export default function BookRoute() {
  const { profile } = useAuth();

  const [service, setService] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [days, setDays] = useState("");
  const [contact, setContact] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [guards, setGuards] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    if (!service) return setError("Which kind of security do you need?");
    if (!contact.trim()) return setError("Who should we ask for when we call?");
    if (!isValidPhone(phone)) return setError("Enter a mobile number we can reach you on.");

    const count = guards.trim() ? Number(guards) : null;
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 2000)) {
      return setError("How many guards? Enter a whole number.");
    }
    if (shifts.length === 0) return setError("Pick the shifts you need: Morning, Evening, Night or 24 Hours.");
    const dayCount = days.trim() ? Number(days) : null;
    if (dayCount !== null && (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 3650)) {
      return setError("For how many days? Enter a whole number.");
    }

    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("submit_service_request", {
      p_service_type: service,
      p_contact_name: contact.trim(),
      p_phone: phone.trim(),
      p_district: district.trim() || undefined,
      p_address: address.trim() || undefined,
      p_guards_required: count ?? undefined,
      p_shift_types: shifts,
      p_days_required: dayCount ?? undefined,
      p_notes: notes.trim() || undefined,
      p_source: "app",
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setReference((data as { reference?: string } | null)?.reference ?? null);
  };

  if (reference) {
    return (
      <Screen contentStyle={styles.body} topInset={false} bottomInset={false}>
        <Panel tone="emerald" title="We have it">
          <Text weight="bold" variant="pageTitle" mono>
            {reference}
          </Text>
          <Text variant="body">
            Quote that reference when you call. The deployment desk is staffed around the
            clock and will come back to you with a quote.
          </Text>
        </Panel>
        <Button
          label="Make another request"
          variant="secondary"
          onPress={() => {
            setReference(null);
            setService(null);
            setGuards("");
            setShifts([]);
            setDays("");
            setNotes("");
          }}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={styles.body} topInset={false} bottomInset={false}>
        <Panel title="What do you need?" subtitle="Pick the closest. We will sort out the detail on the phone.">
          <View style={styles.chips}>
            {SERVICES.map((option) => (
              <Chip
                key={option.slug}
                label={option.label}
                selected={service === option.slug}
                onPress={() => setService(option.slug)}
              />
            ))}
          </View>
        </Panel>

        <Panel title="Where and how many">
          <Field label="District" placeholder="Kokrajhar" value={district} onChangeText={setDistrict} autoCapitalize="words" />
          <Field
            label="Address or landmark"
            placeholder="Near BTC Secretariat"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Field
            label="How many guards"
            placeholder="6"
            value={guards}
            onChangeText={setGuards}
            keyboardType="number-pad"
            hint="A rough number is fine."
          />
        </Panel>

        <Panel title="Which shifts, and for how long" subtitle="Pick one or more.">
          <View style={styles.chips}>
            {SHIFT_TYPES.map((t) => (
              <Chip
                key={t.code}
                label={t.code === "full_day" ? "24 Hours" : `${t.label} ${clock(t.starts)}–${clock(t.ends)}`}
                selected={shifts.includes(t.code)}
                onPress={() => setShifts((cur) => (cur.includes(t.code) ? cur.filter((x) => x !== t.code) : [...cur, t.code]))}
              />
            ))}
          </View>
          <Field
            label="Number of days"
            placeholder="e.g. 3 for an event, 365 for a year"
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
          />
        </Panel>

        <Panel title="How we reach you">
          <Field label="Contact name" value={contact} onChangeText={setContact} autoCapitalize="words" />
          <Field label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field
            label="Anything else"
            placeholder="Two at the main gate, one at emergency, rest roving."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            error={error ?? undefined}
          />
        </Panel>

        <Button label="Send request" size="lg" loading={busy} onPress={() => void submit()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** "06:00" → "6 am". */
function clock(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;
}

/** A selectable pill. Bigger than it looks necessary, because it is tapped with a thumb. */
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.chipPressed]}
    >
      <Text weight="semibold" variant="caption" tone={selected ? "inverse" : "default"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { gap: space[6] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.full,
    backgroundColor: color.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    minHeight: 40,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: color.primary, borderColor: color.primary },
  chipPressed: { opacity: 0.8 },
});
