import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, GestureResponderEvent, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTTS } from "@/hooks/useTTS";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DashboardScreen() {
  const { speak } = useTTS();
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { userData } = useAuth();
  const { trackScreenVisit, trackTap, trackTapDuration, trackSwipe, isSessionActive } = useNexaSafe();

  const tapStartTime = useRef<number>(0);
  const scrollStartY = useRef<number>(0);
  const scrollStartTime = useRef<number>(0);

  useEffect(() => {
    if (isSessionActive) trackScreenVisit('Dashboard');
  }, [isSessionActive]);

  const handleTapStart = (e: GestureResponderEvent) => tapStartTime.current = Date.now();
  const handleTapEnd = (e: GestureResponderEvent, zone: string = 'active') => {
    if (isSessionActive) {
      const { locationX, locationY } = e.nativeEvent;
      const duration = Date.now() - tapStartTime.current;
      trackTap('Dashboard', locationX, locationY, zone);
      trackTapDuration('Dashboard', duration);
    }
  };

  const handleScrollBegin = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollStartY.current = e.nativeEvent.contentOffset.y;
    scrollStartTime.current = Date.now();
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSessionActive) {
      const endY = e.nativeEvent.contentOffset.y;
      const duration = Date.now() - scrollStartTime.current;
      trackSwipe(scrollStartY.current, endY, duration);
    }
  };

  useWakeWord(() => {
    speak("Opening Voice Assistant");
    navigation.navigate("VoiceAssistant");
  });

  const accountBalance = 5250.75;

  function SOSButton() {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <AnimatedPressable
        onPress={() => {
          speak("SOS Emergency");
          navigation.navigate("SOS");
        }}
        onPressIn={() => (scale.value = withSpring(0.9))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={[styles.sosButton, { backgroundColor: KAVACHColors.sos }, Shadows.md, animatedStyle]}
      >
        <Feather name="shield" size={16} color="#FFFFFF" />
        <ThemedText style={styles.sosText}>SOS</ThemedText>
      </AnimatedPressable>
    );
  }

  function ActionIcon({ icon, label, color, onPress, isHero }: any) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <View style={{ alignItems: 'center', width: '25%' }}>
        <AnimatedPressable
          onPress={onPress}
          onPressIn={(e) => { handleTapStart(e); scale.value = withSpring(0.9); }}
          onPressOut={(e) => { handleTapEnd(e); scale.value = withSpring(1); }}
          style={[
            styles.actionButton,
            { backgroundColor: isHero ? color : theme.backgroundSecondary },
            isHero ? Shadows.lg : null,
            animatedStyle
          ]}
        >
          <Feather name={icon} size={isHero ? 28 : 24} color={isHero ? '#FFF' : theme.text} />
        </AnimatedPressable>
        <ThemedText type="caption" style={[styles.actionLabel, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: 100 }}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {/* HEADER */}
        <Animated.View style={styles.header} entering={FadeInDown.delay(100)}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: KAVACHColors.primary }]} />
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Willkommen zurück,</ThemedText>
              <ThemedText type="h3" style={{ color: theme.text, fontWeight: '700' }}>User</ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <AnimatedPressable
              onPress={toggleTheme}
              style={[styles.sosButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name={isDark ? "sun" : "moon"} size={16} color={theme.text} />
            </AnimatedPressable>
            <SOSButton />
          </View>
        </Animated.View>

        {/* HERO BALANCE CARD */}
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.balanceCard, { backgroundColor: theme.card, borderColor: theme.border }, Shadows.lg]}>
          <View style={styles.cardGlow} />
          <View style={styles.balanceHeader}>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Total Balance</ThemedText>
              <ThemedText type="h1" style={{ color: theme.text, marginTop: 4 }}>
                ₹ {accountBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </ThemedText>
            </View>
            <View style={[styles.bankBadge, { backgroundColor: theme.backgroundSecondary }]}>
               <Feather name="check-circle" size={14} color={KAVACHColors.success} />
               <ThemedText type="caption" style={{ marginLeft: 4, color: theme.text, fontWeight: '600' }}>
                 {userData?.bankName || "SBI"}
               </ThemedText>
            </View>
          </View>
          <View style={{ marginTop: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between' }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, letterSpacing: 2 }}>{userData?.bankAccountMasked || "**** **** 1234"}</ThemedText>
          </View>
        </Animated.View>

        {/* PRIMARY ACTIONS */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.actionsGrid}>
          <ActionIcon 
            icon="send" label="Send" isHero color={KAVACHColors.primary} 
            onPress={() => { speak("Send Money"); navigation.navigate("SendMoney"); }} 
          />
          <ActionIcon 
            icon="mic" label="Assistant" color={KAVACHColors.info} 
            onPress={() => { speak("Voice Assistant"); navigation.navigate("VoiceAssistant"); }} 
          />
          <ActionIcon 
            icon="maximize" label="Scan QR" color={KAVACHColors.warning} 
            onPress={() => { speak("QR Scanner"); navigation.navigate("QRScanner"); }} 
          />
          <ActionIcon 
            icon="shield" label="Fraud Scan" color={KAVACHColors.success} 
            onPress={() => { speak("Fraud Scan"); navigation.navigate("FraudScan"); }} 
          />
        </Animated.View>

        {/* SECURITY HUB */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Security Hub</ThemedText>
          <View style={[styles.hubCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable style={styles.hubRow} onPress={() => navigation.navigate("SecurityDashboard")}>
              <View style={[styles.hubIcon, { backgroundColor: KAVACHColors.primary + '20' }]}>
                <Feather name="lock" size={20} color={KAVACHColors.primary} />
              </View>
              <View style={styles.hubText}>
                <ThemedText type="body" style={{ fontWeight: '600', color: theme.text }}>Security Dashboard</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Manage biometric & device health</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable style={styles.hubRow} onPress={() => navigation.navigate("BehaviorAnalytics")}>
              <View style={[styles.hubIcon, { backgroundColor: KAVACHColors.info + '20' }]}>
                <Feather name="activity" size={20} color={KAVACHColors.info} />
              </View>
              <View style={styles.hubText}>
                <ThemedText type="body" style={{ fontWeight: '600', color: theme.text }}>Behavior Analytics</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Monitor your app usage safety</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* UPI EDUCATION BANNER */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Pressable 
            style={[styles.learningBanner, { backgroundColor: KAVACHColors.secondary }]}
            onPress={() => navigation.navigate("UpiLearning")}
          >
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" style={{ color: '#FFF' }}>UPI Safety Tips</ThemedText>
              <ThemedText type="caption" style={{ color: '#FFF', opacity: 0.9, marginTop: 4 }}>Learn how to keep your transfers secure.</ThemedText>
            </View>
            <Feather name="play-circle" size={32} color="#FFF" />
          </Pressable>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  sosText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  balanceCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: KAVACHColors.primary,
    opacity: 0.15,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    textAlign: "center",
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  hubCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  hubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hubText: {
    flex: 1,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  learningBanner: {
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  }
});
