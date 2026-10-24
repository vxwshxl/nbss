import { fetch } from "expo/fetch";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ArrowUp,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronRight,
  Clock3,
  Inbox,
  MapPinned,
  MessageCircleQuestion,
  Radio,
  Siren,
  Square,
  SquarePen,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import type { ScrollViewInstance } from "react-native";
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Nibo } from "@/components/nibo/nibo";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { color, font, radius, space } from "@/theme/tokens";

/**
 * Nibo's chat: the same assistant the console has, asked from the phone, and drawn
 * the way the console's side panel draws it (apps/web/src/components/ai/assistant.tsx):
 * the header with Nibo in a mint tile, "Connected" and a new-chat button; the opening
 * screen with four coloured prompt cards; and each reply as three things in order —
 * the working-out (collapsed once the answer starts), one ticked line per lookup,
 * then the answer.
 *
 * It calls the website's /api/ai/chat with this person's Supabase session as a
 * bearer token. The server re-derives who they are and what they may see from
 * that token, exactly as it does from a browser cookie, so the phone gets the
 * same answers and the same limits.
 */
type Msg = { id: number; role: "you" | "assistant"; text: string; steps: string[]; reasoning: string; streaming: boolean; error: string };

type Event =
  | { type: "step"; label: string }
  | { type: "reasoning"; delta: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** The console's personas (apps/web/src/lib/ai/personas.ts), first four of each. */
const SUGGESTIONS: Record<string, string[]> = {
  guard: ["How many hours did I work this week?", "Am I checked in right now?", "How much overtime do I have this month?", "When was my last shift?"],
  client: ["Is anyone on my gate right now?", "How many man-hours this month?", "How much of that was overtime?", "How many shifts have been worked this month?"],
  staff: ["Who is on duty right now?", "Which sites have nobody in them?", "Is anything waiting for review?", "How many guards arrived late today?"],
};

/** Jade, gold, sky and clay, as on the web: card, border, ink, tile and the tile's ledge. */
const LOOKS = [
  { card: "#ecf8f1", border: "#bfe5cf", ink: "#14532d", tile: "#23874d", ledge: "#135c33" },
  { card: "#fdf5e1", border: "#f2d9a0", ink: "#6b4a0f", tile: "#d9a23b", ledge: "#a3741f" },
  { card: "#eef6fd", border: "#cbe2f5", ink: "#173f63", tile: "#2f7fc1", ledge: "#1d5a8c" },
  { card: "#fcf0ea", border: "#efcdbd", ink: "#6b2e14", tile: "#c8643a", ledge: "#8f4322" },
];

/** A fitting icon for a starter question, from its words — the web's rule. */
function promptIcon(q: string): LucideIcon {
  const t = q.toLowerCase();
  if (/sos|alert|emergency/.test(t)) return Siren;
  if (/on duty|gate|right now|checked in/.test(t)) return Radio;
  if (/overtime|hours|man-hours/.test(t)) return Clock3;
  if (/roster|shift|cover/.test(t)) return CalendarRange;
  if (/review|attendance|punch/.test(t)) return CalendarCheck;
  if (/enquir|booking|form|request/.test(t)) return Inbox;
  if (/site|nobody|fence/.test(t)) return MapPinned;
  return MessageCircleQuestion;
}

export default function AssistantScreen() {
  const { session, profile } = useAuth();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // React Native 0.88: ScrollView is a function component; its ref is the instance type.
  const scroll = useRef<ScrollViewInstance>(null);
  const nextId = useRef(1);
  const asked = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const empty = messages.length === 0;
  const configured = Boolean(WEB_URL);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setDraft("");
      const history = messages.filter((m) => m.text.trim()).map((m) => ({ role: m.role === "you" ? "user" : "assistant", content: m.text }));
      const mine: Msg = { id: nextId.current++, role: "you", text: question, steps: [], reasoning: "", streaming: false, error: "" };
      const live: Msg = { id: nextId.current++, role: "assistant", text: "", steps: [], reasoning: "", streaming: true, error: "" };
      setMessages((ms) => [...ms, mine, live]);
      setBusy(true);

      const flush = () => setMessages((ms) => ms.map((m) => (m.id === live.id ? { ...live } : m)));
      const controller = new AbortController();
      abort.current = controller;

      try {
        if (!WEB_URL) throw new Error("The website address is not set (EXPO_PUBLIC_WEB_URL), so I can't reach the assistant.");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in again.");

        const res = await fetch(`${WEB_URL}/api/ai/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [...history, { role: "user", content: question }], page: { path: "/app", title: "NBSS app" } }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}) as { error?: string });
          throw new Error((body as { error?: string }).error ?? "The assistant is unavailable right now.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const raw = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!raw) continue;
            let ev: Event;
            try {
              ev = JSON.parse(raw) as Event;
            } catch {
              continue;
            }
            if (ev.type === "text") live.text += ev.delta;
            else if (ev.type === "reasoning") live.reasoning += ev.delta;
            else if (ev.type === "step") live.steps = [...live.steps, ev.label];
            else if (ev.type === "error") live.error = ev.message;
            flush();
          }
        }
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError")) live.error = e instanceof Error ? e.message : "Something went wrong.";
      } finally {
        live.streaming = false;
        flush();
        abort.current = null;
        setBusy(false);
      }
    },
    [busy, messages],
  );

  const newChat = () => {
    abort.current?.abort();
    setMessages([]);
    setDraft("");
  };

  // Opened from one of Nibo's buttons: ask that straight away, once.
  useEffect(() => {
    if (ask && !asked.current && session) {
      asked.current = true;
      void send(ask);
    }
  }, [ask, session, send]);

  if (session === null) return <Redirect href="/(auth)/sign-in" />;

  const audience = profile?.role === "guard" ? "guard" : profile?.role === "client" ? "client" : "staff";
  const canSend = configured && !busy && draft.trim().length > 0;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* The panel's header: Nibo in a mint tile, name and status, new chat, close. */}
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        <View style={styles.headTile}>
          <Nibo size={46} still={!busy} mood={busy ? "think" : "happy"} style={styles.headNibo} />
        </View>
        <View style={styles.flex}>
          <Text weight="bold" style={styles.headTitle}>
            Nibo
          </Text>
          <Text variant="micro" tone="muted">
            {configured ? (busy ? "Looking it up…" : "Connected") : "Not connected"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="New chat" disabled={empty && !busy} hitSlop={6} onPress={newChat} style={({ pressed }) => [styles.squareBtn, empty && !busy && styles.off, pressed && styles.pressed]}>
          <SquarePen size={16} color={color.mutedForeground} strokeWidth={1.9} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Close the assistant" hitSlop={6} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
          <X size={18} color={color.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.thread}
        contentContainerStyle={empty ? styles.emptyWrap : styles.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {empty ? (
          <View style={styles.empty}>
            <Nibo size={104} mood="wave" />
            <Text weight="bold" style={styles.hello}>
              Hi {profile?.full_name.split(" ")[0] ?? "there"}, I&apos;m Nibo!
            </Text>
            <Text variant="body" weight="bold" tone="muted">
              How can I help?
            </Text>
            <View style={styles.grid}>
              {SUGGESTIONS[audience]!.map((s, i) => {
                const look = LOOKS[i % LOOKS.length]!;
                const Icon = promptIcon(s);
                return (
                  <View key={s} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!configured}
                      onPress={() => void send(s)}
                      style={({ pressed }) => [
                        styles.prompt,
                        { backgroundColor: look.card, borderColor: look.border, borderBottomColor: look.border },
                        pressed && styles.promptDown,
                      ]}
                    >
                      <View style={[styles.promptTile, { backgroundColor: look.tile, borderBottomColor: look.ledge }]}>
                        <Icon size={20} color="#fff" strokeWidth={2.4} />
                      </View>
                      <Text variant="label" weight="bold" numberOfLines={3} style={{ color: look.ink }}>
                        {s}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          messages.map((m) => <Message key={m.id} m={m} />)
        )}
      </ScrollView>

      {/* The composer: the box on its own line, the hint and the round send under it. */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + space[3] }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={configured ? "Ask Nibo about duty, sites, hours…" : "Not connected."}
          placeholderTextColor={color.mutedForeground}
          style={styles.input}
          multiline
          editable={configured}
          accessibilityLabel="Message the assistant"
        />
        <View style={styles.composerRow}>
          <Text variant="micro" tone="muted" style={styles.flex}>
            Answers come from your records. Check anything before you act on it.
          </Text>
          {busy ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Stop" onPress={() => abort.current?.abort()} style={({ pressed }) => [styles.send, pressed && styles.sendDown]}>
              <Square size={12} color="#fff" fill="#fff" strokeWidth={2.4} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!canSend} onPress={() => void send(draft)} style={({ pressed }) => [styles.send, !canSend && styles.sendOff, pressed && styles.sendDown]}>
              <ArrowUp size={18} color="#fff" strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Message({ m }: { m: Msg }) {
  const [open, setOpen] = useState(false);
  const mine = m.role === "you";
  const thinking = m.streaming && !m.text.trim();

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={[styles.msg, mine && styles.msgMine]}>
      <View style={styles.who}>
        {!mine && <Nibo size={20} still />}
        <Text variant="caption" weight="semibold" tone="inherit" style={{ color: mine ? "#5d5d5db3" : color.primaryInk }}>
          {mine ? "You" : "Nibo"}
        </Text>
      </View>

      {mine ? (
        <View style={styles.bubble}>
          <Text variant="label">{m.text}</Text>
        </View>
      ) : (
        <>
          {m.reasoning ? (
            <Pressable onPress={() => setOpen((o) => !o)} style={[styles.reasoning, (open || thinking) && styles.reasoningOpen]} accessibilityRole="button">
              <View style={styles.reasonHead}>
                <ChevronRight size={12} color={color.mutedForeground} strokeWidth={2.4} style={open || thinking ? styles.turned : undefined} />
                <Text variant="caption" weight="semibold" tone="muted">
                  {thinking ? "Thinking…" : "Thought it through"}
                </Text>
              </View>
              {(open || thinking) && (
                <Text variant="caption" tone="muted" style={styles.reasonText} numberOfLines={thinking ? 8 : undefined}>
                  {m.reasoning}
                </Text>
              )}
            </Pressable>
          ) : null}

          {m.steps.length > 0 && (
            <View style={styles.steps}>
              {m.steps.map((s, i) => (
                <Animated.View key={i} entering={FadeIn.duration(160)} style={styles.step}>
                  <Check size={12} color={color.live} strokeWidth={2.6} />
                  <Text variant="micro" tone="muted" style={styles.stepText}>
                    {s}
                  </Text>
                </Animated.View>
              ))}
            </View>
          )}

          {m.text.trim() ? <Markdown>{m.text.trim().replace(/ [—–] /g, ": ")}</Markdown> : null}

          {thinking && !m.reasoning && <Dots />}

          {m.error ? (
            <View style={styles.error}>
              <TriangleAlert size={14} color={color.destructive} strokeWidth={2} />
              <Text variant="caption" tone="danger" style={styles.flex}>
                {m.error}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

/** The three pulsing dots while nothing has come back yet. */
function Dots() {
  return (
    <View style={styles.dots} accessibilityLabel="Working">
      {[0, 150, 300].map((d) => (
        <Dot key={d} delay={d} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.3, { duration: 500 })), -1)));
  }, [o, delay]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[styles.dot, style]} />;
}

const MINT = "#e9f8f1";

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.card },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  off: { opacity: 0.4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    backgroundColor: color.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  headTile: { width: 40, height: 40, borderRadius: 16, backgroundColor: MINT, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" },
  headNibo: { marginBottom: -8 },
  headTitle: { fontFamily: font.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3 },
  squareBtn: { width: 32, height: 32, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  closeBtn: { width: 32, height: 32, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  thread: { flex: 1, backgroundColor: color.card },
  list: { padding: space[4], gap: space[6] },
  emptyWrap: { flexGrow: 1, padding: space[4] },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space[4] },
  hello: { marginTop: space[2], fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: space[5], marginHorizontal: -6, alignSelf: "stretch", maxWidth: 420 },
  cell: { width: "50%", padding: 6 },
  prompt: {
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 6,
    padding: 14,
    justifyContent: "space-between",
  },
  promptDown: { borderBottomWidth: 2, transform: [{ translateY: 4 }] },
  promptTile: { width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", borderBottomWidth: 3 },
  msg: { alignSelf: "flex-start", maxWidth: "100%", gap: 6 },
  msgMine: { alignSelf: "flex-end", alignItems: "flex-end", maxWidth: "88%" },
  who: { flexDirection: "row", alignItems: "center", gap: 6 },
  bubble: {
    borderRadius: 16,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "#00916426",
    backgroundColor: MINT,
    paddingHorizontal: space[4],
    paddingVertical: 10,
  },
  reasoning: { alignSelf: "flex-start", borderRadius: radius.xl, borderWidth: 1, borderColor: color.border, backgroundColor: "#f3f3f380", paddingHorizontal: space[3], paddingVertical: 6 },
  reasoningOpen: { alignSelf: "stretch" },
  reasonHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  turned: { transform: [{ rotate: "90deg" }] },
  reasonText: { marginTop: space[2] },
  steps: { gap: 4, paddingVertical: 2 },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepText: { letterSpacing: 0 },
  dots: { flexDirection: "row", gap: 4, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.mutedForeground },
  error: { flexDirection: "row", alignItems: "flex-start", gap: space[2], borderRadius: radius.xl, backgroundColor: "#cc28261a", paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  composer: { gap: 10, paddingHorizontal: space[3], paddingTop: space[3], backgroundColor: color.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  input: {
    minHeight: 44,
    maxHeight: 160,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 21,
    color: color.foreground,
  },
  composerRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.primary, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "#005f41" },
  sendDown: { borderBottomWidth: 0, transform: [{ translateY: 3 }] },
  sendOff: { opacity: 0.35 },
});
