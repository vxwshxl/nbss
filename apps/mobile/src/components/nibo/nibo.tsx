import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

/**
 * Nibo, the assistant's mascot, drawn the same as the website's
 * (apps/web/src/components/nibo/nibo.tsx): a security robot with a guard's cap,
 * a visor whose eyes and mouth are LEDs, a radio headset, a chest core and a
 * hover thruster.
 *
 * Built as layers rather than one SVG: every moving part (shadow, thruster,
 * each arm, the core, the eyes) is its own SVG on the same viewBox inside an
 * Animated.View, so each motion is a plain view transform run by Reanimated on
 * the UI thread. Animating transforms inside a native SVG is not something
 * every platform does reliably; moving views is.
 */
export type NiboMood = "happy" | "cheer" | "think" | "sleepy" | "wave" | "oops";

const VB = "-60 -86 120 160";
const LED = "#34d399";
const NAVY = "#1e2a44";

/** A point in the drawing as a transform-origin percentage of the box. */
const at = (x: number, y: number) => `${(((x + 60) / 120) * 100).toFixed(2)}% ${(((y + 86) / 160) * 100).toFixed(2)}%`;

function Layer({ children, style }: { children: React.ReactNode; style?: ViewStyle | object }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={VB}>
        {children}
      </Svg>
    </Animated.View>
  );
}

export function Nibo({
  size = 72,
  mood = "happy",
  still = false,
  style,
}: {
  /** Width in points; the height is 4/3 of it. */
  size?: number;
  mood?: NiboMood;
  still?: boolean;
  style?: ViewStyle;
}) {
  const reduce = useReducedMotion();
  const calm = still || reduce;

  const float = useSharedValue(0);
  const flame = useSharedValue(1);
  const blink = useSharedValue(1);
  const swing = useSharedValue(0);
  const core = useSharedValue(1);
  const look = useSharedValue(0);
  const armL = useSharedValue(0);
  const armR = useSharedValue(0);
  const wave = useSharedValue(0);

  useEffect(() => {
    if (calm) return;
    float.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    flame.value = withRepeat(withTiming(0.8, { duration: 220 }), -1, true);
    swing.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
    core.value = withRepeat(withTiming(0.72, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(3800, withTiming(0.1, { duration: 90 })), withTiming(1, { duration: 120 })),
      -1,
    );
    look.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(2.2, { duration: 320 })),
        withDelay(1400, withTiming(-2.2, { duration: 420 })),
        withDelay(1200, withTiming(0, { duration: 320 })),
      ),
      -1,
    );
    return () => {
      [float, flame, swing, core, blink, look].forEach((v) => cancelAnimation(v));
    };
  }, [calm, float, flame, swing, core, blink, look]);

  // Mood poses: both arms up to cheer, the right one waving.
  useEffect(() => {
    const spring = { damping: 9, stiffness: 140 };
    armL.value = withSpring(mood === "cheer" ? 105 : 0, spring);
    armR.value = withSpring(mood === "cheer" ? -105 : mood === "wave" ? -110 : 0, spring);
    if (mood === "wave" && !calm) {
      wave.value = withRepeat(withSequence(withTiming(-16, { duration: 200 }), withTiming(18, { duration: 200 })), -1, true);
    } else {
      cancelAnimation(wave);
      wave.value = withTiming(0, { duration: 160 });
    }
  }, [mood, calm, armL, armR, wave]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * (size / 120) * float.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.35 * float.value,
    transform: [{ scale: 1 - 0.2 * float.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    opacity: mood === "sleepy" ? 0.45 : 1,
    transform: [{ scaleY: 0.9 + 0.22 * (flame.value - 0.8) * 5 }, { scaleX: 1.04 - 0.1 * (flame.value - 0.8) * 5 }],
  }));
  const armLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${armL.value + 9 * swing.value}deg` }] }));
  const armRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${armR.value - 9 * swing.value + wave.value}deg` }] }));
  const coreStyle = useAnimatedStyle(() => ({ opacity: core.value, transform: [{ scale: core.value }] }));
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: look.value * (size / 120) }, { scaleY: blink.value }],
  }));

  return (
    <View style={[{ width: size, height: (size * 4) / 3 }, style]} pointerEvents="none">
      <Layer style={[{ transformOrigin: at(0, 68) }, shadowStyle]}>
        <Ellipse cx={0} cy={68} rx={24} ry={4.5} fill="rgba(4,60,44,0.2)" />
      </Layer>

      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        <Layer style={[{ transformOrigin: at(0, 47) }, flameStyle]}>
          <Defs>
            <LinearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#a7f3d0" />
              <Stop offset="0.45" stopColor={LED} stopOpacity={0.85} />
              <Stop offset="1" stopColor="#06b6d4" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d="M-7,47 C-8,55 -4,64 0,68 C4,64 8,55 7,47 Z" fill="url(#flame)" />
        </Layer>

        <Layer style={[{ transformOrigin: at(-26, 18) }, armLStyle]}>
          <Shell id="armL" />
          <Rect x={-35} y={17} width={9} height={20} rx={4.5} fill="url(#armL)" transform="rotate(24 -26 20)" />
          <Circle cx={-36} cy={40} r={6} fill={NAVY} />
        </Layer>
        <Layer style={[{ transformOrigin: at(26, 18) }, armRStyle]}>
          <Shell id="armR" />
          <Rect x={26} y={17} width={9} height={20} rx={4.5} fill="url(#armR)" transform="rotate(-24 26 20)" />
          <Circle cx={36} cy={40} r={6} fill={NAVY} />
        </Layer>

        <Layer>
          <Shell id="body" />
          <Defs>
            <LinearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#12302a" />
              <Stop offset="1" stopColor="#050f0c" />
            </LinearGradient>
          </Defs>
          {/* thruster nozzle, torso, belt and buckle, core housing */}
          <Path d="M-9,41 h18 l-3,7 h-12 z" fill="#334155" />
          <Rect x={-21} y={12} width={42} height={33} rx={13} fill="url(#body)" />
          <Rect x={-21} y={36} width={42} height={4} fill={NAVY} />
          <Rect x={-4} y={35.5} width={8} height={5} rx={1.2} fill="#fbbf24" />
          <Circle cx={0} cy={24} r={7.5} fill="#0b1f1a" />
          <Circle cx={-13} cy={18} r={2.6} fill="#fff" opacity={0.7} />
          {/* neck, headset, mic */}
          <Rect x={-7} y={5} width={14} height={9} rx={3} fill={NAVY} />
          <Circle cx={-40} cy={-15} r={9.5} fill={NAVY} />
          <Circle cx={-40} cy={-15} r={5} fill="none" stroke={LED} strokeWidth={2} />
          <Circle cx={40} cy={-15} r={9.5} fill={NAVY} />
          <Circle cx={40} cy={-15} r={5} fill="none" stroke={LED} strokeWidth={2} />
          <Path d="M-42,-6 C-42,6 -32,10 -20,8" stroke={NAVY} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={-19} cy={8} r={3} fill={NAVY} />
          <Circle cx={-19} cy={8} r={1.4} fill={LED} />
          {/* helmet and visor */}
          <Rect x={-37} y={-44} width={74} height={54} rx={22} fill="url(#body)" />
          <Ellipse cx={-22} cy={-30} rx={9} ry={4.5} fill="#fff" opacity={0.8} transform="rotate(-28 -22 -30)" />
          <Rect x={-29} y={-33} width={58} height={35} rx={14} fill="url(#visor)" />
          <Path d="M-24,-26 Q-14,-31 -2,-30" stroke="#fff" strokeWidth={2} opacity={0.18} fill="none" strokeLinecap="round" />
          <Rect x={-25} y={-11} width={7} height={3.5} rx={1.75} fill="#fb7185" opacity={0.4} />
          <Rect x={18} y={-11} width={7} height={3.5} rx={1.75} fill="#fb7185" opacity={0.4} />
          {/* cap */}
          <Path d="M-35,-38 C-35,-60 -19,-68 0,-68 C19,-68 35,-60 35,-38 Z" fill={NAVY} />
          <Rect x={-35} y={-45} width={70} height={7} fill="#10b981" />
          <Path d="M0,-60 l2.4,4.9 5.4,0.8 -3.9,3.8 0.9,5.4 -4.8,-2.6 -4.8,2.6 0.9,-5.4 -3.9,-3.8 5.4,-0.8 z" fill="#fbbf24" />
          <Path d="M-39,-38 Q0,-31 39,-38 L41,-34 Q0,-25 -41,-34 Z" fill="#0f172a" />
          <Mouth mood={mood} />
          <Extras mood={mood} />
        </Layer>

        <Layer style={[{ transformOrigin: at(0, 24) }, coreStyle]}>
          <Circle cx={0} cy={24} r={6.5} fill={LED} opacity={0.3} />
          <Circle cx={0} cy={24} r={4.2} fill={LED} />
        </Layer>

        <Layer style={[{ transformOrigin: at(0, -16) }, eyesStyle]}>
          <Eyes mood={mood} />
        </Layer>
      </Animated.View>
    </View>
  );
}

function Shell({ id }: { id: string }) {
  return (
    <Defs>
      <RadialGradient id={id} cx="32%" cy="22%" r="90%">
        <Stop offset="0" stopColor="#ffffff" />
        <Stop offset="0.55" stopColor="#e6ece9" />
        <Stop offset="1" stopColor="#b9c6c0" />
      </RadialGradient>
    </Defs>
  );
}

const line = { stroke: LED, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };

function Eyes({ mood }: { mood: NiboMood }) {
  if (mood === "sleepy") {
    return (
      <G>
        <Path d="M-17,-16 h9" {...line} />
        <Path d="M8,-16 h9" {...line} />
      </G>
    );
  }
  if (mood === "cheer") {
    return (
      <G>
        <Path d="M-18,-13 l5.5,-6 5.5,6" {...line} />
        <Path d="M7,-13 l5.5,-6 5.5,6" {...line} />
      </G>
    );
  }
  if (mood === "oops") {
    return (
      <G>
        <Path d="M-17,-21 l7,5 -7,5" {...line} />
        <Path d="M17,-21 l-7,5 7,5" {...line} />
      </G>
    );
  }
  return (
    <G>
      {/* a soft halo behind each LED stands in for the web's blur filter */}
      <Rect x={-17.5} y={-24.5} width={11} height={16} rx={5.5} fill={LED} opacity={0.25} />
      <Rect x={6.5} y={-24.5} width={11} height={16} rx={5.5} fill={LED} opacity={0.25} />
      <Rect x={-16} y={-23} width={8} height={13} rx={4} fill={LED} />
      <Rect x={8} y={-23} width={8} height={13} rx={4} fill={LED} />
      <Rect x={-14} y={-21} width={2.4} height={3.4} rx={1.2} fill="#ecfdf5" />
      <Rect x={10} y={-21} width={2.4} height={3.4} rx={1.2} fill="#ecfdf5" />
    </G>
  );
}

function Mouth({ mood }: { mood: NiboMood }) {
  if (mood === "cheer") return <Path d="M-7,-6 Q0,1 7,-6" {...line} strokeWidth={2.4} />;
  if (mood === "oops") return <Path d="M-5,-4 q2.5,-3 5,0 t5,0" {...line} strokeWidth={2.2} />;
  if (mood === "think" || mood === "sleepy") return <Path d="M-4,-5 h8" {...line} strokeWidth={2.2} />;
  return <Path d="M-6,-6 Q0,-1 6,-6" {...line} strokeWidth={2.2} />;
}

function Extras({ mood }: { mood: NiboMood }) {
  if (mood === "think") {
    return (
      <G fill="#10b981">
        <Circle cx={42} cy={-50} r={3} />
        <Circle cx={50} cy={-59} r={3.8} />
        <Circle cx={58} cy={-69} r={4.8} />
      </G>
    );
  }
  if (mood === "sleepy") {
    return (
      <G fill="#047857">
        <SvgText x={36} y={-52} fontSize={13} fontWeight="900">
          z
        </SvgText>
        <SvgText x={46} y={-63} fontSize={10} fontWeight="900">
          z
        </SvgText>
      </G>
    );
  }
  if (mood === "cheer") {
    return (
      <G fill="#fbbf24">
        <Path d="M-52,-48 l3,-8 3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 z" />
        <Path d="M50,-38 l2,-6 2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 z" />
      </G>
    );
  }
  if (mood === "oops") return <Path d="M24,-30 q-3.5,5 0,7 q3.5,-2 0,-7 z" fill="#7dd3fc" />;
  return null;
}
