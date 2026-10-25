import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

/**
 * The site gate at night from the website's sign-in (components/auth/gate-scene.tsx),
 * drawn from the same 800×300 artwork and moving the same way: a car pulls up, the
 * boom lifts and it drives through while another leaves on the near lane, a guard
 * walks the wall, the searchlight and the camera sweep and the booth's beacon pulses.
 *
 * The web animates parts of one SVG with CSS. Here each moving part is its own layer,
 * stacked in the artwork's order and moved by the native driver, so the JS thread
 * draws the picture once and never again. Fills its box like `xMidYMax slice`.
 * Still when the phone asks for reduced motion.
 */

const W = 800;
const H = 300;

const WINDOWS: [number, number][] = [
  [34, 128], [58, 128], [34, 152], [58, 176],
  [118, 104], [142, 104], [118, 128], [142, 152], [118, 176],
  [214, 140], [238, 164], [214, 188],
  [300, 96], [324, 120], [300, 144], [324, 168], [300, 192],
  [700, 112], [724, 136], [748, 112], [700, 160], [748, 184],
];
// The web's windows come and go; frozen here at the mix one frame of that shows.
const WINDOW_OPACITY = [0.95, 0.4, 0.85, 0.95, 0.18, 0.95, 0.85, 0.4, 0.95, 0.95, 0.85, 0.95, 0.4, 0.95, 0.95, 0.18, 0.85, 0.95, 0.4, 0.85, 0.95, 0.95];

const STARS: [number, number][] = [
  [40, 24], [110, 52], [180, 18], [260, 44], [340, 22], [410, 58],
  [470, 16], [540, 40], [600, 70], [660, 30], [760, 54], [790, 18],
];

function Guard({ torch = false }: { torch?: boolean }) {
  return (
    <>
      {torch && <Path d="M-6,-30 L-120,-6 L-118,22 Z" fill="url(#gs-beam)" />}
      <Rect x={-5} y={-14} width={5} height={16} rx={2} fill="#1e2a44" />
      <Rect x={1} y={-14} width={5} height={16} rx={2} fill="#26355a" />
      <Rect x={-6} y={0} width={7} height={3} rx={1} fill="#0b0f19" />
      <Rect x={0} y={0} width={7} height={3} rx={1} fill="#0b0f19" />
      <Path d="M-8,-36 h16 l2,24 h-20 z" fill="#9fb8d6" />
      <Rect x={-8} y={-16} width={16} height={3} fill="#1e2a44" />
      <Rect x={-12} y={-34} width={5} height={14} rx={2} fill="#8aa6c8" transform="rotate(35 -10 -34)" />
      {torch && <Circle cx={-8} cy={-30} r={2.4} fill="#fde68a" />}
      <Circle cx={0} cy={-42} r={6} fill="#c68a5a" />
      <Path d="M-7,-45 q7,-8 14,0 z" fill="#0f172a" />
      <Rect x={-9} y={-46} width={12} height={2} rx={1} fill="#0f172a" />
    </>
  );
}

function Car({ body, roof }: { body: string; roof: string }) {
  return (
    <>
      <Path d="M0,0 h104 a6,6 0 0 1 6,6 v14 h-116 v-14 a6,6 0 0 1 6,-6 z" transform="translate(0 236)" fill={body} />
      <Path d="M20,236 l12,-16 h44 l14,16 z" fill={roof} />
      <Path d="M34,234 l9,-11 h14 v11 z M61,234 v-11 h14 l9,11 z" fill="#99f6e4" opacity={0.7} />
      <Rect x={104} y={241} width={6} height={5} rx={1} fill="#fef3c7" />
      <Path d="M110,243 L190,232 L190,258 Z" fill="#fef3c7" opacity={0.24} />
      <Rect x={-6} y={241} width={4} height={5} rx={1} fill="#ef4444" />
      {[22, 84].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={256} r={9} fill="#0b0f19" />
          <Circle cx={cx} cy={256} r={3.5} fill="#64748b" />
          <Rect x={cx - 1} y={248} width={2} height={16} fill="#334155" />
        </G>
      ))}
    </>
  );
}

/** The gradients every layer may use. Each layer is its own <Svg>, so each carries them. */
function Paints() {
  return (
    <Defs>
      <LinearGradient id="gs-beam" x1="1" y1="0" x2="0" y2="0">
        <Stop offset="0" stopColor="#fde68a" stopOpacity={0.55} />
        <Stop offset="1" stopColor="#fde68a" stopOpacity={0} />
      </LinearGradient>
      <LinearGradient id="gs-search" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#6ee7b7" stopOpacity={0.32} />
        <Stop offset="1" stopColor="#6ee7b7" stopOpacity={0} />
      </LinearGradient>
      <RadialGradient id="gs-moon" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#f8fafc" />
        <Stop offset="0.7" stopColor="#e2e8f0" />
        <Stop offset="1" stopColor="#cbd5e1" />
      </RadialGradient>
      <RadialGradient id="gs-glow" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#a7f3d0" stopOpacity={0.28} />
        <Stop offset="1" stopColor="#a7f3d0" stopOpacity={0} />
      </RadialGradient>
      <Pattern id="gs-stripe" width={16} height={8} patternUnits="userSpaceOnUse">
        <Rect width={8} height={8} fill="#f59e0b" />
        <Rect x={8} width={8} height={8} fill="#f8fafc" />
      </Pattern>
    </Defs>
  );
}

/**
 * A CSS keyframe track as an interpolation of a 0→1 clock. `[t, value, easing]` per
 * stop, the easing applying from that stop to the next as CSS applies it; each eased
 * stretch is sampled so the native driver can follow the curve.
 */
type Key = [number, number, ((x: number) => number)?];
function track(stops: Key[]) {
  const input: number[] = [];
  const output: number[] = [];
  stops.forEach(([t, v, ease], i) => {
    const next = stops[i + 1];
    if (!next || !ease || next[1] === v) {
      input.push(t);
      output.push(v);
      return;
    }
    for (let k = 0; k < 12; k++) {
      input.push(t + ((next[0] - t) * k) / 12);
      output.push(v + (next[1] - v) * ease(k / 12));
    }
  });
  // Interpolation needs strictly rising input; nudge any repeated instant.
  for (let i = 1; i < input.length; i++) if (input[i]! <= input[i - 1]!) input[i] = input[i - 1]! + 1e-6;
  return { inputRange: input, outputRange: output };
}

const carEase = Easing.bezier(0.4, 0, 0.3, 1);
const boomEase = Easing.bezier(0.45, 0, 0.25, 1);

const CAR = track([[0, -170, carEase], [0.22, 250], [0.44, 250, carEase], [0.75, 920], [0.999, 920], [1, -170]]);
const CAR2 = track([[0, 1080, carEase], [0.22, 616], [0.44, 616, carEase], [0.75, -200], [0.999, -200], [1, 1080]]);
const BOOM = track([[0, 0], [0.3, 0, boomEase], [0.4, 80], [0.76, 80, boomEase], [0.88, 0], [1, 0]]);
const PATROL = track([[0, 28], [0.48, 340], [0.52, 340], [0.96, 28], [1, 28]]);

function useLoop(ms: number, still: boolean, alternate = false, easing: (x: number) => number = Easing.linear) {
  const value = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (still) {
      value.setValue(alternate ? 0.5 : 0.36);
      return;
    }
    const run = alternate
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: ms, easing, useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: ms, easing, useNativeDriver: true }),
          ]),
        )
      : Animated.loop(Animated.timing(value, { toValue: 1, duration: ms, easing, useNativeDriver: true }));
    run.start();
    return () => run.stop();
  }, [value, ms, still, alternate, easing]);
  return value;
}

export function GateScene({ height = 220, style }: { height?: number; style?: ViewStyle }) {
  const [width, setWidth] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => sub.remove();
  }, []);

  const cycle = useLoop(12_000, still);
  const patrol = useLoop(18_000, still);
  const search = useLoop(10_000, still, true, Easing.inOut(Easing.ease));
  const cam = useLoop(7_000, still, true, Easing.inOut(Easing.ease));
  const beacon = useLoop(700, still, true, Easing.inOut(Easing.ease));

  // The second car and its boom run half a cycle behind the first (the web's -6s).
  const cycle2 = useMemo(() => Animated.modulo(Animated.add(cycle, 0.5), 1), [cycle]);

  // `xMidYMax slice`: cover the box, centred across, anchored to the road.
  const s = Math.max(width / W, height / H);
  const sw = W * s;
  const sh = H * s;
  const frame: ViewStyle = { position: "absolute", left: (width - sw) / 2, top: height - sh, width: sw, height: sh };
  const at = (x: number, y: number): ViewStyle => ({ transformOrigin: `${x * s}px ${y * s}px` });
  const u = (v: number) => v * s;

  const layer = (children: React.ReactNode) => (
    <Svg width={sw} height={sh} viewBox={`0 0 ${W} ${H}`}>
      <Paints />
      {children}
    </Svg>
  );

  return (
    <View
      style={[styles.box, { height }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {width > 0 && (
        <>
          {/* Sky */}
          <View style={frame}>
            {layer(
              <>
                <Circle cx={640} cy={60} r={60} fill="url(#gs-glow)" />
                <Circle cx={640} cy={60} r={20} fill="url(#gs-moon)" />
                <Circle cx={633} cy={55} r={3.5} fill="#cbd5e1" />
                <Circle cx={646} cy={66} r={2.5} fill="#cbd5e1" />
                {STARS.map(([x, y], i) => (
                  <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill="#e2e8f0" opacity={i % 3 === 0 ? 1 : i % 3 === 1 ? 0.55 : 0.3} />
                ))}
              </>,
            )}
          </View>

          {/* Searchlight from the booth roof */}
          <Animated.View
            style={[frame, at(645, 132), { transform: [{ rotate: search.interpolate({ inputRange: [0, 1], outputRange: ["-24deg", "22deg"] }) }] }]}
          >
            {layer(<Path d="M640,132 L560,-20 L700,-20 Z" fill="url(#gs-search)" />)}
          </Animated.View>

          {/* The town, the wall and its railing */}
          <View style={frame}>
            {layer(
              <>
                <G fill="#14231d">
                  <Rect x={20} y={114} width={56} height={116} />
                  <Rect x={104} y={90} width={60} height={140} />
                  <Rect x={200} y={126} width={56} height={104} />
                  <Rect x={286} y={82} width={60} height={148} />
                  <Rect x={380} y={150} width={70} height={80} />
                  <Rect x={686} y={98} width={80} height={132} />
                </G>
                {WINDOWS.map(([x, y], i) => (
                  <Rect key={`${x}-${y}`} x={x} y={y} width={12} height={10} rx={1.5} fill="#fbbf24" opacity={WINDOW_OPACITY[i]} />
                ))}
                <Rect x={0} y={206} width={430} height={26} fill="#1b2e26" />
                <Rect x={0} y={204} width={430} height={4} fill="#2a4438" />
                <G stroke="#2a4438" strokeWidth={2}>
                  {Array.from({ length: 27 }, (_, i) => (
                    <Line key={i} x1={8 + i * 16} y1={204} x2={8 + i * 16} y2={190} />
                  ))}
                  <Line x1={0} y1={192} x2={430} y2={192} />
                </G>
              </>,
            )}
          </View>

          {/* A guard walking the wall, turning at each end */}
          <Animated.View
            style={{
              position: "absolute",
              left: frame.left as number,
              top: (frame.top as number) + u(232 - 60),
              width: u(40),
              height: u(70),
              marginLeft: -u(20),
              transform: [
                { translateX: patrol.interpolate(PATROL).interpolate({ inputRange: [0, 1], outputRange: [0, u(1)] }) },
                { scaleX: patrol.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [-1, -1, 1, 1] }) },
              ],
            }}
          >
            <Svg width={u(40)} height={u(70)} viewBox="-20 -60 40 70">
              <Guard />
            </Svg>
          </Animated.View>

          {/* CCTV pole */}
          <View style={frame}>{layer(<Rect x={452} y={120} width={4} height={110} fill="#334155" />)}</View>
          <Animated.View
            style={[frame, at(454, 118), { transform: [{ rotate: cam.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "10deg"] }) }] }]}
          >
            {layer(
              <>
                <Rect x={438} y={112} width={26} height={12} rx={3} fill="#cbd5e1" />
                <Rect x={434} y={114} width={6} height={8} rx={1.5} fill="#475569" />
                <Circle cx={460} cy={118} r={1.8} fill="#ef4444" />
              </>,
            )}
          </Animated.View>

          {/* The booth, the guard at the post with his torch, the road and the entry boom's post */}
          <View style={frame}>
            {layer(
              <>
                <Rect x={600} y={150} width={90} height={82} rx={3} fill="#e7efe9" />
                <Rect x={594} y={140} width={102} height={12} rx={2} fill="#047857" />
                <SvgText x={645} y={149.5} textAnchor="middle" fontSize={8.5} fontWeight="800" fill="#ecfdf5" letterSpacing={2}>
                  NBSS
                </SvgText>
                <Rect x={612} y={164} width={46} height={30} rx={2} fill="#fde68a" />
                <Line x1={635} y1={164} x2={635} y2={194} stroke="#d6b65a" strokeWidth={1.5} />
                <Rect x={666} y={168} width={16} height={64} rx={1.5} fill="#94a3b8" />
                <Circle cx={670} cy={200} r={1.4} fill="#334155" />
                <Rect x={640} y={128} width={10} height={12} rx={2} fill="#475569" />
                <G transform="translate(570 232)">
                  <Guard torch />
                </G>
                <Rect x={0} y={232} width={800} height={68} fill="#0d1512" />
                <Rect x={0} y={232} width={800} height={3} fill="#24372f" />
                {Array.from({ length: 22 }, (_, i) => (
                  <Rect key={i} x={i * 48} y={267} width={26} height={2.5} rx={1.25} fill="#4b6b5d" />
                ))}
                <Rect x={0} y={297} width={800} height={3} fill="#24372f" />
                <Rect x={582} y={226} width={18} height={10} rx={2} fill="#334155" />
                <Rect x={586} y={214} width={10} height={24} rx={2} fill="#475569" />
              </>,
            )}
          </View>

          {/* The beacon on the booth roof */}
          <Animated.View
            style={[
              frame,
              at(645, 126),
              {
                opacity: beacon.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                transform: [{ scale: beacon.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }],
              },
            ]}
          >
            {layer(<Circle cx={645} cy={126} r={5} fill="#34d399" />)}
          </Animated.View>

          {/* Entry boom, lifting for the car coming in */}
          <Animated.View style={[frame, at(591, 239), { transform: [{ rotate: cycle.interpolate(BOOM).interpolate({ inputRange: [0, 80], outputRange: ["0deg", "80deg"] }) }] }]}>
            {layer(
              <>
                <Rect x={414} y={236} width={180} height={7} rx={3.5} fill="url(#gs-stripe)" />
                <Circle cx={414} cy={239.5} r={3} fill="#ef4444" />
                <Rect x={414} y={243} width={3} height={16} rx={1} fill="#94a3b8" />
              </>,
            )}
          </Animated.View>
          <View style={frame}>{layer(<Circle cx={591} cy={239} r={5} fill="#1e293b" />)}</View>

          {/* A car coming in on the far lane */}
          <Animated.View style={[frame, { transform: [{ translateX: cycle.interpolate(CAR).interpolate({ inputRange: [0, 1], outputRange: [0, s] }) }] }]}>
            {layer(<Car body="#0f766e" roof="#115e59" />)}
          </Animated.View>

          {/* Exit boom, opening the other way, and its post */}
          <Animated.View style={[frame, at(465, 271), { transform: [{ rotate: cycle2.interpolate(BOOM).interpolate({ inputRange: [0, 80], outputRange: ["0deg", "-80deg"] }) }] }]}>
            {layer(
              <>
                <Rect x={470} y={268} width={134} height={7} rx={3.5} fill="url(#gs-stripe)" />
                <Circle cx={604} cy={271.5} r={3} fill="#ef4444" />
                <Rect x={601} y={275} width={3} height={16} rx={1} fill="#94a3b8" />
              </>,
            )}
          </Animated.View>
          <View style={frame}>
            {layer(
              <>
                <Rect x={460} y={262} width={10} height={34} rx={2} fill="#475569" />
                <Rect x={456} y={292} width={18} height={8} rx={2} fill="#334155" />
                <Circle cx={465} cy={271} r={5} fill="#1e293b" />
              </>,
            )}
          </View>

          {/* A car leaving on the near lane, facing left */}
          <Animated.View style={[frame, { transform: [{ translateX: cycle2.interpolate(CAR2).interpolate({ inputRange: [0, 1], outputRange: [0, s] }) }] }]}>
            {layer(
              <G transform="translate(110 32) scale(-1 1)">
                <Car body="#1e3a8a" roof="#1e40af" />
              </G>,
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", overflow: "hidden", backgroundColor: "#06110d" },
});
