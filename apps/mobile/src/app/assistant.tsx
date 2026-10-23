import { fetch } from "expo/fetch";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ArrowUp, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import type { ScrollViewInstance } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Nibo, type NiboMood } from "@/components/nibo/nibo";
import { Markdown } from "@/components/markdown";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { color, font, radius, space } from "@/theme/tokens";

/**
 * Nibo's chat: the same assistant the console has, asked from the phone.
 *
 * It calls the website's /api/ai/chat with this person's Supabase session as a
 * bearer token. The server re-derives who they are and what they may see from
 * that token, exactly as it does from a browser cookie, so the phone gets the
 * same answers and the same limits. Replies stream back as one JSON object per
 * line: lookup steps, then the text as it is written.
 */
type Msg = { id: number; role: "you" | "nibo"; text: string; step?: string; error?: string; streaming?: boolean };

const SUGGESTIONS: Record<string, string[]> = {
  guard: ["How many hours have I worked this month?", "How much overtime this week?"],
  client: ["Is anyone on my gate right now?", "How many man-hours this month?"],
  staff: ["What needs my attention today?", "Which sites have nobody on duty?"],
};

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

  const mood: NiboMood = busy ? "think" : messages.some((m) => m.error) ? "oops" : messages.length ? "happy" : "wave";

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setDraft("");
      const history = messages.filter((m) => m.text.trim()).map((m) => ({ role: m.role === "you" ? "user" : "assistant", content: m.text }));
      const mine: Msg = { id: nextId.current++, role: "you", text: question };
      const reply: Msg = { id: nextId.current++, role: "nibo", text: "", streaming: true };
      setMessages((ms) => [...ms, mine, reply]);
      setBusy(true);

      const patch = (p: Partial<Msg>) => setMessages((ms) => ms.map((m) => (m.id === reply.id ? { ...m, ...p, text: p.text !== undefined ? p.text : m.text } : m)));

      try {
        if (!WEB_URL) throw new Error("The website address is not set (EXPO_PUBLIC_WEB_URL), so I can't reach the assistant.");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in again.");

        const res = await fetch(`${WEB_URL}/api/ai/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [...history, { role: "user", content: question }], page: { path: "/app", title: "NBSS app" } }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}) as { error?: string });
          throw new Error((body as { error?: string }).error ?? "The assistant is unavailable right now.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const raw = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!raw) continue;
            const ev = JSON.parse(raw) as { type: string; delta?: string; label?: string; message?: string };
            if (ev.type === "text" && ev.delta) {
              answer += ev.delta;
              patch({ text: answer, step: undefined });
            } else if (ev.type === "step" && ev.label) {
              patch({ step: ev.label });
            } else if (ev.type === "error") {
              throw new Error(ev.message ?? "Something went wrong.");
            }
          }
        }
        patch({ streaming: false, step: undefined });
      } catch (e) {
        patch({ streaming: false, step: undefined, error: e instanceof Error ? e.message : "Something went wrong." });
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  // Opened from one of Nibo's buttons: ask that straight away, once.
  useEffect(() => {
    if (ask && !asked.current && session) {
      asked.current = true;
      void send(ask);
    }
  }, [ask, session, send]);

  if (session === null) return <Redirect href="/(auth)/sign-in" />;

  const audience = profile?.role === "guard" ? "guard" : profile?.role === "client" ? "client" : "staff";

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        <Nibo size={40} mood={mood} />
        <View style={styles.fill}>
          <Text variant="title" weight="bold">
            Nibo
          </Text>
          <Text variant="caption" tone="muted">
            {busy ? "Looking it up…" : "Your NBSS assistant"}
          </Text>
        </View>
        <Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.iconBtn}>
          <X size={20} color={color.foreground} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Nibo size={96} mood="wave" />
            <Text variant="sectionTitle" weight="bold" style={styles.centred}>
              Hi {profile?.full_name.split(" ")[0] ?? "there"}, I&apos;m Nibo.
            </Text>
            <Text variant="label" tone="muted" style={styles.centred}>
              I read NBSS&apos;s own records and answer from them. Try one of these:
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS[audience]!.map((s) => (
                <Pressable key={s} onPress={() => void send(s)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <Text variant="label" weight="medium">
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.duration(220)} style={[styles.msg, m.role === "you" ? styles.mine : styles.theirs]}>
            {m.error ? (
              <Text variant="label" tone="danger">
                {m.error}
              </Text>
            ) : m.text ? (
              m.role === "you" ? (
                <Text variant="body" style={styles.mineText}>
                  {m.text}
                </Text>
              ) : (
                <Markdown>{m.text}</Markdown>
              )
            ) : (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={color.primary} />
                <Text variant="caption" tone="muted">
                  {m.step ?? "Thinking…"}
                </Text>
              </View>
            )}
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + space[3] }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about duty, hours or your site…"
          placeholderTextColor={color.mutedForeground}
          style={styles.input}
          multiline
          editable={!busy}
          onSubmitEditing={() => void send(draft)}
        />
        <Pressable
          accessibilityLabel="Send"
          disabled={busy || !draft.trim()}
          onPress={() => void send(draft)}
          style={[styles.send, (busy || !draft.trim()) && styles.sendOff]}
        >
          <ArrowUp size={20} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.appBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    backgroundColor: color.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineSoft,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.muted },
  list: { padding: space[4], gap: space[3], flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[3], paddingVertical: space[10] },
  centred: { textAlign: "center" },
  suggestions: { gap: space[2], alignSelf: "stretch", marginTop: space[2] },
  suggestion: { borderRadius: radius.xl, borderWidth: 1, borderColor: color.border, backgroundColor: color.card, padding: space[3] },
  msg: { maxWidth: "88%", borderRadius: radius.xl, paddingHorizontal: space[4], paddingVertical: space[3] },
  mine: { alignSelf: "flex-end", backgroundColor: color.primary },
  mineText: { color: color.primaryForeground },
  theirs: { alignSelf: "flex-start", backgroundColor: color.card, borderWidth: 1, borderColor: color.lineSoft },
  thinking: { flexDirection: "row", alignItems: "center", gap: space[2] },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: color.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.lineSoft,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    paddingHorizontal: space[4],
    paddingVertical: 11,
    fontFamily: font.regular,
    fontSize: 16,
    color: color.foreground,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
