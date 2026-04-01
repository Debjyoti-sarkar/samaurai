import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const MOCK_BANKS = [
  { id: "sbi", name: "State Bank of India", accountNumber: "XXXX XXXX 4521" },
  { id: "hdfc", name: "HDFC Bank", accountNumber: "XXXX XXXX 7832" },
  { id: "icici", name: "ICICI Bank", accountNumber: "XXXX XXXX 9156" },
  { id: "axis", name: "Axis Bank", accountNumber: "XXXX XXXX 3478" },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function BankLinkingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { linkBank, setAuthStep, userData } = useAuth();

  const [isSearching, setIsSearching] = useState(true);
  const [foundBanks, setFoundBanks] = useState<typeof MOCK_BANKS>([]);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const scanProgress = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    scanProgress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );

    const timer = setTimeout(() => {
      setIsSearching(false);
      setFoundBanks(MOCK_BANKS.slice(0, Math.floor(Math.random() * 2) + 1));
      checkmarkScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const scanAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanProgress.value * 360}deg` }],
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const handleLinkBank = async () => {
    if (!selectedBank) return;
    
    const bank = foundBanks.find((b) => b.id === selectedBank);
    if (!bank) return;

    setIsLinking(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    await linkBank(bank.name, bank.accountNumber.replace(/\s/g, ""));
    setAuthStep("security_setup");
    navigation.navigate("SecuritySetup");
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          {isSearching ? (
            <Animated.View style={scanAnimatedStyle}>
              <Feather name="loader" size={48} color={KAVACHColors.primary} />
            </Animated.View>
          ) : (
            <Animated.View style={checkmarkAnimatedStyle}>
              <Feather name="check-circle" size={48} color={KAVACHColors.success} />
            </Animated.View>
          )}
        </View>
        <ThemedText type="h2" style={styles.title}>
          {t("linkBankAccount")}
        </ThemedText>
        <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isSearching
            ? "Searching for bank accounts linked to your phone..."
            : t("phoneMatchFound")}
        </ThemedText>
      </View>

      {isSearching ? (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={KAVACHColors.primary} />
          <ThemedText type="small" style={[styles.searchingText, { color: theme.textSecondary }]}>
            Looking up +91 {userData?.phoneNumber || "XXXXXXXXXX"}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.banksContainer}>
          {foundBanks.map((bank) => (
            <BankCard
              key={bank.id}
              bank={bank}
              isSelected={selectedBank === bank.id}
              onSelect={() => setSelectedBank(bank.id)}
              theme={theme}
            />
          ))}
        </View>
      )}

      {!isSearching && foundBanks.length > 0 ? (
        <Button
          onPress={handleLinkBank}
          disabled={!selectedBank || isLinking}
          style={[styles.linkButton, { backgroundColor: KAVACHColors.primary }]}
        >
          {isLinking ? "Linking..." : t("confirmAndLink")}
        </Button>
      ) : null}

      {!isSearching && foundBanks.length === 0 ? (
        <View style={styles.noBanksContainer}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={[styles.noBanksText, { color: theme.textSecondary }]}>
            No bank accounts found linked to this phone number.
          </ThemedText>
          <Button
            onPress={() => navigation.goBack()}
            style={[styles.retryButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            Try Different Number
          </Button>
        </View>
      ) : null}
    </ScreenScrollView>
  );
}

function BankCard({
  bank,
  isSelected,
  onSelect,
  theme,
}: {
  bank: typeof MOCK_BANKS[0];
  isSelected: boolean;
  onSelect: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      }}
      style={[
        styles.bankCard,
        {
          backgroundColor: theme.card,
          borderColor: isSelected ? KAVACHColors.primary : theme.border,
          borderWidth: isSelected ? 2 : 1,
        },
        animatedStyle,
      ]}
    >
      <View style={[styles.bankIcon, { backgroundColor: KAVACHColors.primary + "20" }]}>
        <Feather name="credit-card" size={24} color={KAVACHColors.primary} />
      </View>
      <View style={styles.bankInfo}>
        <ThemedText style={styles.bankName}>{bank.name}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {bank.accountNumber}
        </ThemedText>
      </View>
      {isSelected ? (
        <View style={[styles.checkIcon, { backgroundColor: KAVACHColors.primary }]}>
          <Feather name="check" size={16} color="#FFFFFF" />
        </View>
      ) : (
        <View style={[styles.radioOuter, { borderColor: theme.border }]} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  searchingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
  },
  searchingText: {
    marginTop: Spacing.xl,
  },
  banksContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  bankCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  linkButton: {
    marginTop: Spacing.lg,
  },
  noBanksContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.lg,
  },
  noBanksText: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
});
