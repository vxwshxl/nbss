import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { isStaff, type Role } from "@nbss/shared/identity";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

import { Text } from "../text";
import { Nibo, type NiboMood } from "./nibo";

/**
 * Nibo on a phone: he floats in the bottom corner of every signed-in screen.
 * A tap opens the assistant; a long press makes him quiet (or chatty again).
 *
 * Now and then he says one thing, most urgent first:
 *  1. nudge  live data for this person (an open SOS, a shift that has started,
 *            a quotation that is ready), said again only when the count changes.
 *  2. tip    one hint per screen, the first time it is opened.
 *
 * What he has said lives in AsyncStorage, per person, so he does not repeat
 * himself between launches. Nothing leaves the phone.
 */

type Line = { id: string; text: string; mood: NiboMood; action?: { label: string; href?: string; ask?: string } };

const TIPS: [path: string, line: Omit<Line, "id">][] = [
  ["/duty", { text: "Tap check in when you reach the gate. I'll tell you if you're outside the fence.", mood: "wave" }],
  ["/map", { text: "This is your post. The green line is the fence you check in inside.", mood: "think" }],
  ["/site", { text: "Hi! Ask me who is on your gate right now.", mood: "wave", action: { label: "Who's on duty?", ask: "Is anyone on my gate right now?" } }],
  ["/book", { text: "Tell us the site, the hours and how many guards. A rough number is fine.", mood: "happy" }],
  ["/live", { text: "Every guard on duty, live. Ask me which sites are short.", mood: "wave", action: { label: "Ask Nibo", ask: "Which sites have nobody on duty right now?" } }],
  ["/profile", { text: "Need your hours for this month? Just ask.", mood: "happy", action: { label: "My hours", ask: "How many hours have I worked this month?" } }],
];

type Memory = { quiet: boolean; said: Record<string, number> };

async function nudges(role: Role, userId: string): Promise<Line[]> {
  const now = new Date().toISOString();
  const out: Line[] = [];
  if (isStaff(role)) {
    const { count } = await supabase.from("sos_alerts").select("id", { count: "exact", head: true }).in("status", ["active", "acknowledged"]);
    if (count) out.push({ id: `sos:${count}`, text: `${count} SOS alert${count === 1 ? "" : "s"} still open.`, mood: "oops", action: { label: "Ask Nibo", ask: "Which SOS alerts are open and who is responding?" } });
  } else if (role === "guard") {
    const { count } = await supabase.from("shifts").select("id", { count: "exact", head: true }).eq("guard_id", userId).eq("status", "scheduled").lte("starts_at", now).gt("ends_at", now);
    if (count) out.push({ id: `shift:${now.slice(0, 13)}`, text: "Your shift has started. Check in when you reach the gate.", mood: "wave", action: { label: "Duty", href: "/(guard)/duty" } });
  } else if (role === "client") {
    const { count } = await supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "quoted");
    if (count) out.push({ id: `quote:${count}`, text: "Your quotation is ready to look at.", mood: "cheer", action: { label: "See it", href: "/(client)/book" } });
  }
  return out;
}

export function NiboCompanion({ bottom = 16 }: { /** Distance from the screen's bottom edge (clear the tab bar). */ bottom?: number }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [line, setLine] = useState<Line | null>(null);
  const [mood, setMood] = useState<NiboMood>("happy");
  const memory = useRef<Memory>({ quiet: false, said: {} });
  const key = profile ? `nibo-v1:${profile.id}` : null;

  const save = useCallback(() => {
    if (key) void AsyncStorage.setItem(key, JSON.stringify(memory.current)).catch(() => undefined);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw) memory.current = { ...memory.current, ...(JSON.parse(raw) as Partial<Memory>) };
      })
      .catch(() => undefined);
  }, [key]);

  // A new screen drops what he was saying (during render, not in an effect).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setLine(null);
  }

  // A few seconds after a screen opens: a live nudge if there is one, else the screen's tip.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const m = memory.current;
      if (m.quiet || cancelled) return;
      let next: Line | null = null;
      try {
        next = (await nudges(profile.role, profile.id)).find((n) => !m.said[n.id]) ?? null;
      } catch {
        next = null;
      }
      if (!next) {
        const tip = TIPS.find(([p]) => pathname.endsWith(p));
        if (tip && !m.said[`tip:${tip[0]}`]) next = { id: `tip:${tip[0]}`, ...tip[1] };
      }
      if (!next || cancelled) return;
      m.said[next.id] = Date.now();
      save();
      setLine(next);
      setMood(next.mood);
    }, 3500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pathname, profile, save]);

  // A line goes by itself after a while.
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => {
      setLine(null);
      setMood("happy");
    }, Math.min(14_000, 6_000 + line.text.length * 55));
    return () => clearTimeout(t);
  }, [line]);

  const openAssistant = (ask?: string) => {
    void Haptics.selectionAsync();
    setLine(null);
    setMood("cheer");
    setTimeout(() => setMood("happy"), 900);
    router.push(ask ? { pathname: "/assistant", params: { ask } } : "/assistant");
  };

  const toggleQuiet = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    memory.current.quiet = !memory.current.quiet;
    save();
    setLine(
      memory.current.quiet
        ? { id: "quiet", text: "Okay, I'll keep quiet. Hold me again to hear tips.", mood: "sleepy" }
        : { id: "chatty", text: "I'm back! I'll point out anything useful.", mood: "wave" },
    );
    setMood(memory.current.quiet ? "sleepy" : "wave");
  };

  if (!profile) return null;

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }]}>
      {line && (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown.duration(160)} style={styles.bubble}>
          <Text variant="label" weight="semibold" style={styles.bubbleText}>
            {line.text}
          </Text>
          {line.action && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const a = line.action!;
                setLine(null);
                if (a.href) router.push(a.href as never);
                else openAssistant(a.ask);
              }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text variant="caption" weight="bold" style={styles.actionText}>
                {line.action.label}
              </Text>
            </Pressable>
          )}
          <Pressable accessibilityLabel="Dismiss" hitSlop={10} onPress={() => setLine(null)} style={styles.close}>
            <X size={14} color={color.mutedForeground} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Nibo, your assistant"
        accessibilityHint="Hold to make Nibo quiet"
        onPress={() => openAssistant()}
        onLongPress={toggleQuiet}
        style={({ pressed }) => [styles.nibo, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Nibo size={60} mood={mood} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", right: 12, alignItems: "flex-end", gap: space[2], maxWidth: 300 },
  nibo: { width: 60, height: 80 },
  bubble: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: color.border,
    padding: space[3],
    paddingRight: space[8],
    gap: space[2],
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bubbleText: { color: color.foreground },
  action: { alignSelf: "flex-start", backgroundColor: color.primary, borderRadius: radius.lg, paddingHorizontal: space[3], paddingVertical: 6 },
  actionText: { color: color.primaryForeground },
  close: { position: "absolute", top: 8, right: 8 },
  pressed: { opacity: 0.75 },
});
