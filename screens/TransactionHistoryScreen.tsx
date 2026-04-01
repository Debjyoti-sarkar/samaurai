// TransactionHistoryScreen.tsx
import React from "react";
import { View, StyleSheet, Pressable, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

import { speak } from "../utils/speak";

// ✔ Correct import (matches your directory)
import { MOCK_TRANSACTIONS } from "@/data/transactions";

type TransactionType = "sent" | "received" | "refund" | "failed";

interface Transaction {
  id: string;
  type: TransactionType;
  name: string;
  upiId: string;
  amount: number;
  date: string;
  time: string;
  status: "completed" | "pending" | "failed";
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();

  const getTypeIcon = (): keyof typeof Feather.glyphMap => {
    switch (transaction.type) {
      case "sent":
        return "arrow-up-right";
      case "received":
        return "arrow-down-left";
      case "refund":
        return "rotate-ccw";
      case "failed":
        return "x-circle";
    }
  };

  const getTypeColor = () => {
    switch (transaction.type) {
      case "sent":
        return KAVACHColors.sos;
      case "received":
        return KAVACHColors.success;
      case "refund":
        return KAVACHColors.info;
      case "failed":
        return KAVACHColors.textSecondary;
    }
  };

  const getAmountPrefix = () => {
    switch (transaction.type) {
      case "sent":
        return "-";
      case "received":
      case "refund":
        return "+";
      case "failed":
        return "";
    }
  };

  return (
    <Pressable
      onPress={() => {
        // ✔ Voice speak + translations
        const amountText = transaction.amount.toLocaleString("en-IN");
        const typeText = transaction.type === "sent" ? t("sent") : 
                         transaction.type === "received" ? t("received") :
                         transaction.type === "refund" ? t("refund") : t("failed");
        const message = `${typeText} ${amountText} ${t("rupees")} ${transaction.type === "sent" ? t("to") : t("from")} ${transaction.name}`;
        speak(message, language);
      }}
      style={[styles.transactionItem, { backgroundColor: theme.card }]}
    >
      <View style={[styles.transactionIcon, { backgroundColor: getTypeColor() + "20" }]}>
        <Feather name={getTypeIcon()} size={20} color={getTypeColor()} />
      </View>

      <View style={styles.transactionInfo}>
        <ThemedText style={styles.transactionName}>{transaction.name}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {transaction.upiId}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {transaction.date} at {transaction.time}
        </ThemedText>
      </View>

      <View style={styles.transactionAmount}>
        <ThemedText
          style={[
            styles.amountText,
            {
              color:
                transaction.type === "sent" || transaction.type === "failed"
                  ? theme.text
                  : KAVACHColors.success,
            },
          ]}
        >
          {getAmountPrefix()}₹{transaction.amount.toLocaleString("en-IN")}
        </ThemedText>

        {transaction.status === "failed" ? (
          <ThemedText type="caption" style={{ color: KAVACHColors.sos }}>
            Failed
          </ThemedText>
        ) : transaction.status === "pending" ? (
          <ThemedText type="caption" style={{ color: KAVACHColors.warning }}>
            Pending
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function TransactionHistoryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { paddingTop, paddingBottom } = useScreenInsets();

  const [filter, setFilter] = React.useState<"all" | "sent" | "received">("all");

  const filteredTransactions = MOCK_TRANSACTIONS.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "sent") return tx.type === "sent";
    if (filter === "received") return tx.type === "received" || tx.type === "refund";
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop }]}>
        <View style={styles.filterRow}>
          <FilterButton label="All" isActive={filter === "all"} onPress={() => setFilter("all")} theme={theme} />
          <FilterButton label="Sent" isActive={filter === "sent"} onPress={() => setFilter("sent")} theme={theme} />
          <FilterButton label="Received" isActive={filter === "received"} onPress={() => setFilter("received")} theme={theme} />
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </View>
  );
}

function FilterButton({ label, isActive, onPress }: any) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterButton,
        { backgroundColor: isActive ? KAVACHColors.primary : theme.backgroundSecondary },
      ]}
    >
      <ThemedText type="small" style={{ color: isActive ? "#FFF" : theme.text, fontWeight: "500" }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  filterRow: { flexDirection: "row", gap: Spacing.sm },
  filterButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.full },
  listContent: { paddingHorizontal: Spacing.xl },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: { flex: 1, gap: 2 },
  transactionName: { fontWeight: "500" },
  transactionAmount: { alignItems: "flex-end" },
  amountText: { fontSize: 16, fontWeight: "600" },
});
