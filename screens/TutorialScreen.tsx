import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";

const TUTORIAL_KEY = "@kavach_tutorial_completed";

const STEP_TOOLTIP_KEYS = [
  "tutorialBalance",
  "tutorialSend",
  "tutorialFraud",
  "tutorialSOS",
  "tutorialSecurity",
] as const;

type Hole = { x: number; y: number; w: number; h: number };

function SpotlightOverlay({
  width,
  height,
  hole,
  dimColor,
}: {
  width: number;
  height: number;
  hole: Hole;
  dimColor: string;
}) {
  const { x, y, w, h } = hole;
  const topH = Math.max(0, y);
  const leftW = Math.max(0, x);
  const bottomY = y + h;
  const midH = Math.max(0, h);
  const bottomH = Math.max(0, height - bottomY);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <View style={[styles.dimBand, { height: topH, width, backgroundColor: dimColor }]} />
      <View style={{ flexDirection: "row", width, height: midH }}>
        <View style={[styles.dimBand, { width: leftW, backgroundColor: dimColor }]} />
        <View style={{ width: w, height: h }} pointerEvents="none" />
        <View style={[styles.dimBand, { flex: 1, backgroundColor: dimColor }]} />
      </View>
      <View style={[styles.dimBand, { height: bottomH, width, backgroundColor: dimColor }]} />
    </View>
  );
}

export default function TutorialScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);

  const dimColor = isDark ? "rgba(0,0,0,0.82)" : "rgba(15,23,42,0.78)";

  const holes: Hole[] = useMemo(() => {
    const pad = Spacing.lg;
    const cardW = width - pad * 2;
    const balanceH = height * 0.26;
    const balanceY = insets.top + height * 0.08;
    const gridTop = balanceY + balanceH + Spacing.md;
    const cell = (width - pad * 2) / 4;
    const fraudX = pad + cell * 3;
    const sosY = insets.top + height * 0.02;
    const hubY = gridTop + 140;

    return [
      { x: pad, y: balanceY, w: cardW, h: balanceH },
      { x: pad, y: gridTop, w: cell - 6, h: 110 },
      { x: fraudX, y: gridTop, w: cell - 6, h: 110 },
      { x: width - pad - 52, y: sosY, w: 52, h: 44 },
      { x: pad, y: hubY, w: cardW, h: height * 0.22 },
    ];
  }, [width, height, insets.top]);

  const hole = holes[step] ?? holes[0];

  const tooltipKey = STEP_TOOLTIP_KEYS[step];
  const isLast = step === STEP_TOOLTIP_KEYS.length - 1;

  const completeTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, "true");
    } catch {
      /* ignore */
    }
    navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });
  }, [navigation]);

  const onSkip = () => {
    void completeTutorial();
  };

  const onNext = () => {
    if (isLast) {
      void completeTutorial();
    } else {
      setStep((s) => s + 1);
    }
  };

  const glowColor = KAVACHColors.primary;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <SpotlightOverlay width={width} height={height} hole={hole} dimColor={dimColor} />

      <View
        pointerEvents="none"
        style={[
          styles.glowRing,
          {
            left: hole.x - 3,
            top: hole.y - 3,
            width: hole.w + 6,
            height: hole.h + 6,
            borderColor: glowColor,
            shadowColor: glowColor,
          },
        ]}
      />

      <Pressable
        onPress={onSkip}
        style={[styles.skipBtn, { top: insets.top + Spacing.sm, right: Spacing.lg }]}
        accessibilityRole="button"
        accessibilityLabel={t("tutorialSkip")}
      >
        <ThemedText style={{ color: theme.text, fontWeight: "600" }}>{t("tutorialSkip")}</ThemedText>
      </Pressable>

      <View
        style={[
          styles.tooltip,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            left: Spacing.lg,
            right: Spacing.lg,
            bottom: insets.bottom + 56,
          },
        ]}
      >
        <ThemedText type="body" style={{ color: theme.text, marginBottom: Spacing.md }}>
          {t(tooltipKey)}
        </ThemedText>
        <Pressable
          onPress={onNext}
          style={[styles.nextBtn, { backgroundColor: KAVACHColors.primary }]}
          accessibilityRole="button"
        >
          <ThemedText style={styles.nextBtnText}>
            {isLast ? t("tutorialDone") : t("tutorialNext")}
          </ThemedText>
        </Pressable>
      </View>

      <View style={[styles.dots, { bottom: insets.bottom + Spacing.lg }]}>
        {STEP_TOOLTIP_KEYS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === step ? KAVACHColors.primary : theme.border,
                width: i === step ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dimBand: {},
  skipBtn: {
    position: "absolute",
    zIndex: 20,
    padding: Spacing.sm,
  },
  glowRing: {
    position: "absolute",
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    zIndex: 5,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: Platform.OS === "android" ? 8 : 0,
  },
  tooltip: {
    position: "absolute",
    zIndex: 15,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  nextBtn: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    zIndex: 18,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
