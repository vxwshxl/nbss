import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, IdCard } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLockup } from "@/components/brand-lockup";
import { GateScene } from "@/components/gate-scene";
import { GoogleG } from "@/components/google-button";
import { Nibo } from "@/components/nibo/nibo";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { color, font, gradient, radius, space } from "@/theme/tokens";

/**
 * The one sign-in for everybody, laid out as the website's /login is
 * (apps/web/src/app/login): the lockup, "Login", Google first and the employee code
 * and PIN behind "Sign in with employee code", the gate at night along the foot.
 * The whole page fits one screen: the gate takes whatever height the form leaves,
 * and a short phone gets the smaller lockup and tighter spacing.
 *
 * Nobody picks a role; the profile decides where they land (app/index.tsx).
 */
export function SignIn() {
  const { isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  const [staff, setStaff] = useState(false);
  const [bandH, setBandH] = useState(0);
  // The web's `max-height: 740px` step.
  const compact = useWindowDimensions().height < 740;

  const form = (
    <View style={styles.column}>
      <View style={styles.lockup}>
        <BrandLockup size={compact ? "md" : "xl"} />
      </View>
      <View style={[styles.body, compact && styles.tight]}>
        <View style={[styles.heading, compact && styles.headingTight]}>
          <Text weight="extrabold" style={styles.title}>
            Login
          </Text>
          {staff && (
            <Text variant="label" tone="muted" style={styles.centred}>
              With the employee code and PIN the office gave you.
            </Text>
          )}
        </View>
        {staff ? <StaffForm onBack={() => setStaff(false)} /> : <GoogleStep onStaff={() => setStaff(true)} />}
      </View>
    </View>
  );

  const foot = (
    <View style={[styles.foot, { paddingBottom: insets.bottom + space[4] }]}>
      <FootLink label="Privacy" path="/privacy-policy" />
      <Dot />
      <FootLink label="Terms" path="/terms-and-conditions" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.fill, isTablet && styles.row]}>
        {isTablet && <NightPanel top={insets.top} />}
        <ScrollView
          style={[styles.fill, styles.page]}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (compact ? space[3] : space[6]) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.centre, isTablet ? styles.grow : compact && styles.centreTight]}>{form}</View>
          {/* Below lg the picture becomes a band at the foot, as on the website, taking the height left over. */}
          {!isTablet && (
            <View style={[styles.band, compact && styles.bandShort]} onLayout={(e) => setBandH(Math.round(e.nativeEvent.layout.height))}>
              {/* Absolute, so the picture follows the band's height rather than holding it open. */}
              {bandH > 0 && <GateScene height={bandH} style={styles.cover} />}
            </View>
          )}
          {foot}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function GoogleStep({ onStaff }: { onStaff: () => void }) {
  const { signInWithGoogle, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.stack}>
      {error && <Alert>{error}</Alert>}
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() => {
          setError(null);
          void signInWithGoogle().then((r) => r.error && setError(r.error));
        }}
        style={({ pressed }) => [styles.google, pressed && styles.pressed]}
      >
        {loading ? <ActivityIndicator color={color.foreground} /> : <GoogleG />}
        <Text weight="semibold" style={styles.button15}>
          Sign in with Google
        </Text>
      </Pressable>

      <View style={styles.or}>
        <View style={styles.orLine} />
        <Text variant="caption" tone="muted">
          or
        </Text>
        <View style={styles.orLine} />
      </View>

      {/* The highlighted way in: most people here are staff with a code. */}
      <Pressable accessibilityRole="button" onPress={onStaff} style={({ pressed }) => [styles.submitWrap, styles.raised, pressed && styles.pressed]}>
        <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={[styles.submit, styles.tall]}>
          <IdCard size={16} color={color.primaryForeground} strokeWidth={2} />
          <Text weight="semibold" tone="inherit" style={[styles.button15, { color: color.primaryForeground }]}>
            Sign in with employee code
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

/** Employee code and PIN, for staff whose login has no Google account. */
function StaffForm({ onBack }: { onBack: () => void }) {
  const { signIn, loading } = useAuth();
  const [number, setNumber] = useState("");
  const [secret, setSecret] = useState("");
  const [shown, setShown] = useState(false);
  const [focus, setFocus] = useState<"code" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "NBSS-" fixed, the number typed after it. A code from before (TEST-ADMIN) or an
  // email still works: a letter, "-" or "@" drops the prefix and takes it as written.
  const custom = /[^0-9]/.test(number);
  const identifier = custom ? number.trim() : number ? `NBSS-${number}` : "";

  const submit = async () => {
    if (!identifier || !secret) {
      setError(!identifier ? "Enter your employee code." : "Enter your PIN.");
      return;
    }
    setError(null);
    const result = await signIn(identifier, secret);
    if (result.error) setError(result.error);
  };

  return (
    <View>
      <View style={styles.stack}>
        {error && <Alert>{error}</Alert>}

        <View style={styles.field}>
          <Text variant="label" weight="medium">
            Employee code
          </Text>
          <Box focused={focus === "code"}>
            {!custom && (
              <View style={styles.prefix}>
                <Text weight="semibold" tone="muted" style={styles.codeText}>
                  NBSS-
                </Text>
              </View>
            )}
            <TextInput
              value={number}
              onChangeText={(v) => {
                setNumber(v.replace(/^nbss-/i, ""));
                setError(null);
              }}
              placeholder=""
              placeholderTextColor={color.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="username"
              // Digits first, but a TEST- code or an email can still be typed.
              keyboardType={custom ? "default" : Platform.OS === "ios" ? "numbers-and-punctuation" : "visible-password"}
              autoFocus
              onFocus={() => setFocus("code")}
              onBlur={() => setFocus((f) => (f === "code" ? null : f))}
              style={[styles.input, styles.codeText]}
            />
          </Box>
        </View>

        <View style={styles.field}>
          <Text variant="label" weight="medium">
            PIN
          </Text>
          <Box focused={focus === "pin"}>
            <TextInput
              value={secret}
              onChangeText={(v) => {
                setSecret(v);
                setError(null);
              }}
              placeholder="4-digit PIN"
              placeholderTextColor={color.mutedForeground}
              secureTextEntry={!shown}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              keyboardType={custom ? "default" : "number-pad"}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              onFocus={() => setFocus("pin")}
              onBlur={() => setFocus((f) => (f === "pin" ? null : f))}
              style={[styles.input, secret ? styles.pinText : styles.pinPlaceholder]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={shown ? "Hide PIN" : "Show PIN"} hitSlop={10} onPress={() => setShown((v) => !v)} style={styles.eye}>
              {shown ? <EyeOff size={18} color={color.mutedForeground} strokeWidth={2} /> : <Eye size={18} color={color.mutedForeground} strokeWidth={2} />}
            </Pressable>
          </Box>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.submitWrap, loading && styles.inert, pressed && styles.pressed]}
        >
          <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={styles.submit}>
            {loading && <ActivityIndicator color={color.primaryForeground} size="small" />}
            <Text weight="semibold" tone="inherit" style={[styles.button15, { color: color.primaryForeground }]}>
              Sign in
            </Text>
            {!loading && <ArrowRight size={16} color={color.primaryForeground} strokeWidth={2.2} />}
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.back}>
        <ArrowLeft size={16} color={color.mutedForeground} strokeWidth={2} />
        <Text variant="label" weight="medium" tone="muted">
          Sign in with Google instead
        </Text>
      </Pressable>
    </View>
  );
}

/** An input's frame, with the website's focus ring: the border in ring colour and a soft halo. */
function Box({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.halo, focused && styles.haloOn]}>
      <View style={[styles.box, focused && styles.boxOn]}>{children}</View>
    </View>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.alert} accessibilityRole="alert">
      <AlertCircle size={16} color={color.destructive} style={styles.alertIcon} />
      <Text variant="label" tone="danger" style={styles.fill}>
        {children}
      </Text>
    </View>
  );
}

function FootLink({ label, path }: { label: string; path: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)} style={styles.footItem}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

function Dot() {
  return (
    <Text variant="caption" tone="muted" importantForAccessibility="no">
      ·
    </Text>
  );
}

/** The dark half on a tablet, the website's `lg` aside: the line, Nibo, the gate. */
function NightPanel({ top }: { top: number }) {
  return (
    <View style={styles.night}>
      <View style={[styles.nightCopy, { paddingTop: top + 64 }]}>
        <Text variant="label" weight="semibold" tone="inherit" style={styles.nightEyebrow}>
          On guard tonight
        </Text>
        <Text weight="extrabold" tone="inherit" style={styles.nightTitle}>
          Your safety, <Text weight="extrabold" tone="inherit" style={[styles.nightTitle, styles.nightEyebrow]}>our responsibility.</Text>
        </Text>
        <Text variant="bodyLarge" tone="inherit" style={styles.nightBody}>
          Attendance at the gate, live posts, SOS and your own site, all in one place.
        </Text>
      </View>
      <Nibo size={150} mood="wave" style={styles.nightNibo} />
      <GateScene height={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row" },
  page: { backgroundColor: color.background },
  scroll: { flexGrow: 1 },
  centre: { paddingHorizontal: space[5], paddingVertical: space[4] },
  centreTight: { paddingVertical: space[2] },
  grow: { flexGrow: 1, justifyContent: "center" },
  tight: { marginTop: space[5] },
  headingTight: { marginBottom: space[4] },
  // `max-w-[400px]`, centred.
  column: { width: "100%", maxWidth: 400, alignSelf: "center" },
  lockup: { alignItems: "center" },
  body: { marginTop: space[8] },
  heading: { alignItems: "center", gap: 6, marginBottom: 28 },
  // `font-display text-[32px] leading-tight font-extrabold tracking-[-0.025em]`.
  title: { fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: color.foreground },
  centred: { textAlign: "center" },
  stack: { gap: space[4] },
  button15: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.85 },
  inert: { opacity: 0.8 },

  // `h-12 rounded-xl variant=outline shadow-sm`.
  google: {
    height: 48,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  or: { marginTop: space[2], flexDirection: "row", alignItems: "center", gap: space[3] },
  orLine: { flex: 1, height: 1, backgroundColor: color.border },

  field: { gap: space[2] },
  halo: { borderRadius: radius.xl + 3, padding: 3, margin: -3 },
  haloOn: { backgroundColor: "rgba(16,185,129,0.5)" },
  box: {
    height: 44,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
  },
  boxOn: { borderColor: color.ring },
  prefix: { justifyContent: "center", backgroundColor: color.muted, paddingHorizontal: 14 },
  codeText: { fontFamily: font.monoMedium, fontSize: 15, letterSpacing: 1 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 15,
    color: color.foreground,
    fontFamily: font.regular,
    // The browser preview's own focus outline; the frame draws the ring.
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null),
  },
  pinText: { letterSpacing: 4.5 },
  pinPlaceholder: { letterSpacing: 0 },
  eye: { justifyContent: "center", paddingHorizontal: space[3] },
  submitWrap: { marginTop: space[1], borderRadius: radius.xl, overflow: "hidden" },
  tall: { height: 48 },
  raised: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  submit: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
  back: { marginTop: space[5], flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },

  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(204,40,38,0.25)",
    backgroundColor: "rgba(204,40,38,0.05)",
    paddingHorizontal: space[3],
    paddingVertical: 10,
  },
  alertIcon: { marginTop: 2 },

  // `-mx-5 rounded-t-[28px] bg-[#06110d]`, the band at the foot.
  band: { flexGrow: 1, minHeight: 120, marginTop: space[4], borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "#06110d" },
  bandShort: { minHeight: 80 },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], paddingTop: space[4] },
  footItem: { flexDirection: "row", alignItems: "center", gap: 4 },

  night: { flex: 1.1, backgroundColor: "#06110d", justifyContent: "space-between", overflow: "hidden" },
  nightCopy: { paddingHorizontal: 48, gap: space[4] },
  nightEyebrow: { color: "#6ee7b7" },
  nightTitle: { color: "#ffffff", fontSize: 48, lineHeight: 48, letterSpacing: -1.6 },
  nightBody: { color: "rgba(255,255,255,0.65)", maxWidth: 380 },
  nightNibo: { position: "absolute", top: 120, right: "9%" },
});
