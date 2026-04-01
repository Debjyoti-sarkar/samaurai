import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, RefreshControl, GestureResponderEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { useScreenSecurity } from "@/hooks/useScreenSecurity";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AccountCardProps {
  bankName: string;
  accountNumber: string;
  balance: number;
  isLinked: boolean;
  onPress: () => void;
}

function AccountCard({ bankName, accountNumber, balance, isLinked, onPress }: AccountCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[styles.accountCard, { backgroundColor: theme.card }, Shadows.md, animatedStyle]}
    >
      <View style={styles.accountHeader}>
        <View style={[styles.bankIcon, { backgroundColor: KAVACHColors.primary + "20" }]}>
          <Feather name="credit-card" size={24} color={KAVACHColors.primary} />
        </View>
        <View style={styles.accountInfo}>
          <ThemedText style={styles.bankName}>{bankName}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {accountNumber}
          </ThemedText>
        </View>
        {isLinked ? (
          <View style={[styles.linkedBadge, { backgroundColor: KAVACHColors.success + "20" }]}>
            <Feather name="check" size={12} color={KAVACHColors.success} />
            <ThemedText type="caption" style={{ color: KAVACHColors.success, marginLeft: 4 }}>
              Linked
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.balanceSection}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          Available Balance
        </ThemedText>
        <ThemedText type="h2" style={{ color: KAVACHColors.primary }}>
          ₹ {balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </ThemedText>
      </View>

      <View style={styles.accountActions}>
        <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="refresh-cw" size={16} color={theme.text} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.xs }}>
            Refresh
          </ThemedText>
        </Pressable>
        <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="file-text" size={16} color={theme.text} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.xs }}>
            Statement
          </ThemedText>
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

export default function BalanceScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // NexaSafe tracking
  const { trackScreenVisit, trackTap, trackTapDuration, isSessionActive } = useNexaSafe();
  const tapStartTime = useRef<number>(0);

  // Track screen visit on mount
  useEffect(() => {
    if (isSessionActive) {
      trackScreenVisit('Balance');
    }
  }, [isSessionActive]);

  // Handle tap tracking
  const handleTapStart = () => {
    tapStartTime.current = Date.now();
  };

  const handleTapEnd = (e: GestureResponderEvent, zone: string = 'active') => {
    if (isSessionActive) {
      const { locationX, locationY } = e.nativeEvent;
      const duration = Date.now() - tapStartTime.current;
      trackTap('Balance', locationX, locationY, zone);
      trackTapDuration('Balance', duration);
    }
  };

  // Enable screen security for balance screen (sensitive financial info)
  useScreenSecurity(true);

  const accounts = [
    {
      id: "1",
      bankName: userData?.bankName || "State Bank of India",
      accountNumber: userData?.bankAccountMasked || "XXXX XXXX 4521",
      balance: 5250.75,
      isLinked: true,
    },
    {
      id: "2",
      bankName: "HDFC Bank",
      accountNumber: "XXXX XXXX 7832",
      balance: 12450.00,
      isLinked: false,
    },
  ];

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={KAVACHColors.primary}
        />
      }
    >
      <View style={[styles.totalCard, { backgroundColor: KAVACHColors.primary }]}>
        <View style={styles.totalHeader}>
          <ThemedText style={styles.totalLabel}>{t("totalBalance")}</ThemedText>
          <Pressable onPress={() => setShowBalance(!showBalance)}>
            <Feather name={showBalance ? "eye" : "eye-off"} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <ThemedText style={styles.totalAmount}>
          {showBalance
            ? `₹ ${totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
            : "₹ ****.**"}
        </ThemedText>
        <ThemedText style={styles.totalSubtext}>
          Across {accounts.length} linked accounts
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Your Accounts
        </ThemedText>
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            bankName={account.bankName}
            accountNumber={account.accountNumber}
            balance={showBalance ? account.balance : 0}
            isLinked={account.isLinked}
            onPress={() => {}}
          />
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Quick Actions
        </ThemedText>
        <View style={styles.quickActions}>
          <QuickActionButton icon="plus-circle" label="Add Account" theme={theme} onPress={() => {}} />
          <QuickActionButton icon="book" label={t("loanCheck")} theme={theme} onPress={() => {}} />
          <QuickActionButton icon="settings" label="Manage" theme={theme} onPress={() => {}} />
        </View>
      </View>

      <View style={[styles.loanCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.loanHeader}>
          <View style={[styles.loanIcon, { backgroundColor: KAVACHColors.info + "20" }]}>
            <Feather name="trending-up" size={24} color={KAVACHColors.info} />
          </View>
          <View style={styles.loanInfo}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {t("loanCheck")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Based on your transaction history
            </ThemedText>
          </View>
        </View>
        <View style={styles.loanDetails}>
          <View style={styles.loanItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pre-approved limit
            </ThemedText>
            <ThemedText type="h4" style={{ color: KAVACHColors.info }}>
              ₹ 50,000
            </ThemedText>
          </View>
          <View style={styles.loanItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Interest rate from
            </ThemedText>
            <ThemedText type="h4" style={{ color: KAVACHColors.success }}>
              10.5% p.a.
            </ThemedText>
          </View>
        </View>
        <Pressable style={[styles.applyButton, { borderColor: KAVACHColors.info }]}>
          <ThemedText style={{ color: KAVACHColors.info, fontWeight: "600" }}>
            Check Eligibility
          </ThemedText>
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}

function QuickActionButton({
  icon,
  label,
  theme,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  theme: any;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickAction, { backgroundColor: theme.card }]}>
      <View style={[styles.quickActionIcon, { backgroundColor: KAVACHColors.primary + "15" }]}>
        <Feather name={icon} size={20} color={KAVACHColors.primary} />
      </View>
      <ThemedText type="caption" style={{ marginTop: Spacing.xs, textAlign: "center" }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  totalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  totalLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  totalAmount: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  totalSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  accountCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  bankName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  balanceSection: {
    marginBottom: Spacing.lg,
  },
  accountActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  quickActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  loanCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  loanHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  loanIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  loanInfo: {
    flex: 1,
  },
  loanDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  loanItem: {
    gap: Spacing.xs,
  },
  applyButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
