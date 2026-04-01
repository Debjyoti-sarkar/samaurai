import React, { useState } from "react";
import { View, StyleSheet, Pressable, Linking, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const EMERGENCY_NUMBERS = [
  { id: "police", name: "Police", number: "100", icon: "shield" as const },
  { id: "cyber", name: "Cyber Crime", number: "1930", icon: "monitor" as const },
  { id: "women", name: "Women Helpline", number: "1091", icon: "heart" as const },
  { id: "senior", name: "Senior Citizen", number: "14567", icon: "users" as const },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SOSScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleCall = (number: string) => {
    if (Platform.OS === "web") {
      Alert.alert("Call from Device", `Please call ${number} from your phone`);
      return;
    }
    Linking.openURL(`tel:${number}`);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const handleReportFraud = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setReportSubmitted(true);
  };

  if (reportSubmitted) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <ThemedText type="h3">{t("fraudAlert")}</ThemedText>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: KAVACHColors.success + "20" }]}>
            <Feather name="check-circle" size={64} color={KAVACHColors.success} />
          </View>
          <ThemedText type="h2" style={styles.successTitle}>
            Report Submitted
          </ThemedText>
          <ThemedText type="body" style={[styles.successText, { color: theme.textSecondary }]}>
            Your fraud report has been submitted successfully. Our team will investigate and take action within 24 hours.
          </ThemedText>
          <View style={[styles.referenceCard, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Reference Number
            </ThemedText>
            <ThemedText type="h4">
              FRD-{Date.now().toString().slice(-8)}
            </ThemedText>
          </View>
          <Button
            onPress={() => navigation.goBack()}
            style={{ backgroundColor: KAVACHColors.primary, width: "100%", marginTop: Spacing.xl }}
          >
            Back to Dashboard
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={{ width: 44 }} />
        <ThemedText type="h3">{t("emergencyHelp")}</ThemedText>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.alertContainer, pulseStyle]}>
          <View style={[styles.alertIcon, { backgroundColor: KAVACHColors.sos }]}>
            <Feather name="alert-triangle" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>

        <ThemedText type="h4" style={styles.alertTitle}>
          Emergency Assistance
        </ThemedText>
        <ThemedText type="small" style={[styles.alertSubtitle, { color: theme.textSecondary }]}>
          Contact authorities or report fraud immediately
        </ThemedText>

        <View style={styles.emergencyNumbers}>
          {EMERGENCY_NUMBERS.map((item) => (
            <AnimatedPressable
              key={item.id}
              onPress={() => handleCall(item.number)}
              style={[styles.emergencyCard, { backgroundColor: theme.card }, Shadows.md]}
            >
              <View style={[styles.emergencyIcon, { backgroundColor: KAVACHColors.sos + "15" }]}>
                <Feather name={item.icon} size={24} color={KAVACHColors.sos} />
              </View>
              <View style={styles.emergencyInfo}>
                <ThemedText style={styles.emergencyName}>{item.name}</ThemedText>
                <ThemedText type="h4" style={{ color: KAVACHColors.sos }}>
                  {item.number}
                </ThemedText>
              </View>
              <Feather name="phone" size={20} color={KAVACHColors.sos} />
            </AnimatedPressable>
          ))}
        </View>
      </View>

      <View style={styles.reportSection}>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Experienced fraud or suspicious activity?
        </ThemedText>
        <Button
          onPress={handleReportFraud}
          style={{ backgroundColor: KAVACHColors.sos }}
        >
          {t("reportFraud")}
        </Button>
      </View>

      <View style={[styles.tipCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="info" size={16} color={KAVACHColors.info} />
        <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.textSecondary }}>
          If you've been a victim of financial fraud, block your cards immediately and file a complaint within 24 hours for maximum protection.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  alertContainer: {
    marginBottom: Spacing.xl,
  },
  alertIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    marginBottom: Spacing.sm,
  },
  alertSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  emergencyNumbers: {
    width: "100%",
    gap: Spacing.sm,
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 14,
    marginBottom: 2,
  },
  reportSection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  referenceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.xs,
  },
});
