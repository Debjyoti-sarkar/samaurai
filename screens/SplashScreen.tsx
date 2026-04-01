import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
} from "react-native-reanimated";

import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { getOnboardingInitialRoute } from "@/navigation/onboardingRoutes";

// ── Colours ──────────────────────────────────────────────
const BG          = "#050816";
const PURPLE      = "#6C63FF";
const TEAL        = "#4ECDC4";
const CORAL       = "#FF6B6B";
const TAGLINE_COL = "#8888AA";
const WHITE       = "#FFFFFF";

const SPLASH_SEEN_KEY   = "@kavach_splash_seen";
const LETTERS           = ["K", "A", "V", "A", "C", "H"];
const LETTER_START_MS   = 1200;
const LETTER_STAGGER_MS = 100;
const LETTER_FADE_MS    = 220;

type SplashScreenProps = { onComplete?: () => void };

// ── Tiny floating particle ───────────────────────────────
function Particle({
  x, delay, size, opacity,
}: {
  x: number; delay: number; size: number; opacity: number;
}) {
  const translateY = useSharedValue(0);
  const op = useSharedValue(opacity);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(withTiming(-30, { duration: 3000 }), -1, true),
    );
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(opacity, { duration: 1500 }),
          withTiming(0.05,    { duration: 1500 }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: x, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// ── Main component ───────────────────────────────────────
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const navigation  = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { hasCompletedOnboarding, authStep } = useAuth();

  const onCompleteRef = useRef(onComplete);
  const authRef = useRef({ hasCompletedOnboarding, authStep });
  onCompleteRef.current = onComplete;
  authRef.current = { hasCompletedOnboarding, authStep };

  // ── Shared values (unchanged) ──────────────────────────
  const circleScale      = useSharedValue(0);
  const shieldScale      = useSharedValue(0);
  const letter0          = useSharedValue(0);
  const letter1          = useSharedValue(0);
  const letter2          = useSharedValue(0);
  const letter3          = useSharedValue(0);
  const letter4          = useSharedValue(0);
  const letter5          = useSharedValue(0);
  const letterOpacities  = [letter0,letter1,letter2,letter3,letter4,letter5];
  const taglineTranslateY = useSharedValue(24);
  const taglineOpacity   = useSharedValue(0);
  const dot1Opacity      = useSharedValue(0);
  const dot2Opacity      = useSharedValue(0);
  const dot3Opacity      = useSharedValue(0);
  const screenOpacity    = useSharedValue(1);
  const ringScale        = useSharedValue(0.3);
  const ringOpacity      = useSharedValue(0);
  const versionOpacity   = useSharedValue(0);

  useEffect(() => {
    // Outer ring
    ringOpacity.value = withTiming(0.5, { duration: 400 });
    ringScale.value   = withSpring(1.15, { damping: 12, stiffness: 80 });

    // Purple circle
    circleScale.value = withSpring(1, { damping: 14, stiffness: 95, mass: 0.85 });

    // Shield bounce
    shieldScale.value = withDelay(
      500,
      withSpring(1, { damping: 9, stiffness: 160, mass: 0.6 }),
    );

    // Letters
    letterOpacities.forEach((sv, i) => {
      sv.value = withDelay(
        LETTER_START_MS + i * LETTER_STAGGER_MS,
        withTiming(1, { duration: LETTER_FADE_MS }),
      );
    });

    // Tagline
    taglineTranslateY.value = withDelay(1800, withTiming(0, { duration: 700 }));
    taglineOpacity.value    = withDelay(1800, withTiming(1, { duration: 700 }));

    // Version text
    versionOpacity.value = withDelay(2200, withTiming(0.4, { duration: 600 }));

    // Dots
    const dotPulse = (dur: number) =>
      withRepeat(
        withSequence(withTiming(1, { duration: dur }), withTiming(0.3, { duration: dur })),
        -1, false,
      );
    dot1Opacity.value = withDelay(2500, dotPulse(140));
    dot2Opacity.value = withDelay(2620, dotPulse(140));
    dot3Opacity.value = withDelay(2740, dotPulse(140));

    // Navigate away
    const finishSplash = () => {
      void (async () => {
        try {
          await AsyncStorage.setItem(SPLASH_SEEN_KEY, "true");
          const next = getOnboardingInitialRoute(
            authRef.current.hasCompletedOnboarding,
            authRef.current.authStep,
          );
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: next as keyof RootStackParamList }],
            }),
          );
        } catch {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "LanguageSelection" }],
            }),
          );
        }
        onCompleteRef.current?.();
      })();
    };

    screenOpacity.value = withDelay(
      3000,
      withSequence(
        withTiming(0, { duration: 500 }, (finished) => {
          if (finished) runOnJS(finishSplash)();
        }),
      ),
    );
  }, []);

  // ── Animated styles ────────────────────────────────────
  const ringStyle    = useAnimatedStyle(() => ({
    opacity:   ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const circleStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));
  const shieldStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: shieldScale.value }],
  }));
  const glowStyle    = useAnimatedStyle(() => ({
    transform: [{ scale: shieldScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity:   taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));
  const screenStyle  = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const versionStyle = useAnimatedStyle(() => ({ opacity: versionOpacity.value }));

  const letterStyles = [
    useAnimatedStyle(() => ({ opacity: letter0.value })),
    useAnimatedStyle(() => ({ opacity: letter1.value })),
    useAnimatedStyle(() => ({ opacity: letter2.value })),
    useAnimatedStyle(() => ({ opacity: letter3.value })),
    useAnimatedStyle(() => ({ opacity: letter4.value })),
    useAnimatedStyle(() => ({ opacity: letter5.value })),
  ];
  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3Opacity.value }));

  return (
    <Animated.View style={[styles.root, screenStyle]}>

      {/* ── Background orbs ── */}
      <View style={[styles.orb, styles.orbTopLeft,   { backgroundColor: PURPLE }]} />
      <View style={[styles.orb, styles.orbBottomRight,{ backgroundColor: TEAL   }]} />
      <View style={[styles.orb, styles.orbMidRight,  { backgroundColor: CORAL  }]} />

      {/* ── Floating particles ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Particle x="15%" delay={0}    size={3} opacity={0.20} />
        <Particle x="30%" delay={400}  size={3} opacity={0.20} />
        <Particle x="55%" delay={800}  size={3} opacity={0.20} />
        <Particle x="70%" delay={200}  size={3} opacity={0.20} />
        <Particle x="82%" delay={600}  size={3} opacity={0.20} />
        <Particle x="45%" delay={1000} size={3} opacity={0.20} />
      </View>

      {/* ── Centre content ── */}
      <View style={styles.center} pointerEvents="none">

        {/* Outer ring */}
        <Animated.View style={[styles.ring, ringStyle]} />

        {/* Purple glow circle */}
        <Animated.View style={[styles.glowCircle, circleStyle]} />

        {/* Soft glow behind shield */}
        <Animated.View style={[styles.glow, glowStyle]} />

        {/* Shield icon */}
        <Animated.View style={[styles.shieldWrap, shieldStyle]}>
          <View style={styles.shieldInner}>
            <Feather name="shield" size={72} color={WHITE} />
          </View>
        </Animated.View>

        <Animated.Text style={styles.logoName}>Kavach</Animated.Text>

        {/* KAVACH letters */}
        <View style={styles.titleRow}>
          {LETTERS.map((ch, i) => (
            <Animated.Text key={`${ch}-${i}`} style={[styles.letter, letterStyles[i]]}>
              {ch}
            </Animated.Text>
          ))}
        </View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Security in your hands
        </Animated.Text>
        <Animated.Text style={[styles.taglineHindi, taglineStyle]}>
          सुरक्षा आपके हाथ में
        </Animated.Text>

      </View>

      {/* ── Dots row ── */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { backgroundColor: PURPLE }, dot1Style]} />
        <Animated.View style={[styles.dot, { backgroundColor: TEAL   }, dot2Style]} />
        <Animated.View style={[styles.dot, { backgroundColor: CORAL  }, dot3Style]} />
      </View>

      {/* ── Version ── */}
      <Animated.Text style={[styles.version, versionStyle]}>v1.0.0</Animated.Text>

    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Background orbs
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.10,
  },
  orbTopLeft: {
    width: 380, height: 380,
    top: -120, left: -100,
  },
  orbBottomRight: {
    width: 320, height: 320,
    bottom: -100, right: -80,
  },
  orbMidRight: {
    width: 260, height: 260,
    top: "38%", right: -110,
  },

  // Particle
  particle: {
    position: "absolute",
    bottom: "20%",
    backgroundColor: WHITE,
  },

  // Centre
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Platform.OS === "ios" ? 56 : 48,
  },

  // Outer ring
  ring: {
    position: "absolute",
    width: 220, height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: PURPLE,
  },

  // Purple glow circle
  glowCircle: {
    position: "absolute",
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 20,
    opacity: 0.9,
  },

  // Soft glow behind shield
  glow: {
    position: "absolute",
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: PURPLE,
    opacity: 0.12,
  },

  // Shield
  shieldWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  shieldInner: {
    width: 100, height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108,99,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.3)",
  },

  // Title
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoName: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  letter: {
    fontSize: 46,
    fontWeight: "800",
    color: WHITE,
    letterSpacing: 10,
  },

  // Taglines
  tagline: {
    marginTop: 14,
    fontSize: 15,
    color: WHITE,
    letterSpacing: 2.5,
    textAlign: "center",
    fontWeight: "300",
  },
  taglineHindi: {
    marginTop: 6,
    fontSize: 13,
    color: TAGLINE_COL,
    letterSpacing: 1,
    textAlign: "center",
  },

  // Dots
  dotsRow: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 60 : 44,
    left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
  },

  // Version
  version: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 32 : 20,
    alignSelf: "center",
    fontSize: 11,
    color: "#3A3A6A",
    letterSpacing: 1,
  },
});