import React from "react";
import { Modal, StyleSheet, View, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { KAVACHColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

interface RiskModalProps {
  visible: boolean;
  risk: RiskLevel;
  score: number;
  reasons: string[];
  onContinue: () => void;
  onCancel: () => void;
}

export const RiskModal: React.FC<RiskModalProps> = ({
  visible,
  risk,
  score,
  reasons,
  onContinue,
  onCancel,
}) => {
  const { theme } = useTheme();

  if (!visible) return null;

  const isHigh = risk === "HIGH";
  const isMedium = risk === "MEDIUM";
  const isLow = risk === "LOW";

  const color = isHigh
    ? KAVACHColors.sos
    : isMedium
    ? KAVACHColors.warning
    : KAVACHColors.success;

  const iconOptions = isHigh
    ? "x-octagon"
    : isMedium
    ? "alert-triangle"
    : "shield";

  const title = isHigh
    ? "High Fraud Risk"
    : isMedium
    ? "Medium Fraud Risk"
    : "Low Risk";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInUp.duration(400).springify()}
          exiting={FadeOut.duration(200)}
          style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.lg]}
        >
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: color + "15" }]}>
            <Feather name={iconOptions} size={48} color={color} />
          </View>

          <ThemedText type="h2" style={[styles.title, { color }]}>
            {title}
          </ThemedText>

          <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }}>
            Kavach Shield has analyzed this transaction before processing.
          </ThemedText>

          {/* Risk Score Meter */}
          <View style={styles.scoreContainer}>
            <View style={styles.scoreHeader}>
              <ThemedText style={{ fontWeight: "600" }}>Risk Score</ThemedText>
              <ThemedText style={{ color, fontWeight: "bold" }}>{score}%</ThemedText>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: `${score}%`, backgroundColor: color },
                ]}
              />
            </View>
          </View>

          {/* Reasons List */}
          {reasons && reasons.length > 0 && (
            <View style={styles.reasonsContainer}>
              <ThemedText type="small" style={[styles.reasonsTitle, { color: theme.textSecondary }]}>
                Flagged Reasons:
              </ThemedText>
              <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
                {reasons.map((reason, index) => (
                  <View key={index} style={styles.reasonItem}>
                    <Feather name="info" size={16} color={color} style={{ marginTop: 2 }} />
                    <ThemedText style={[styles.reasonText, { color: theme.text }]}>
                      {reason}
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {/* If High -> Encourage Cancel. Allow continue with explicit warning */}
            <Button
              onPress={onCancel}
              style={{
                backgroundColor: isHigh ? color : theme.border,
                flex: 1,
                borderColor: isHigh ? color : theme.border,
              }}
            >
              <ThemedText style={{ color: isHigh ? "#FFF" : theme.text }}>
                {isHigh ? "Cancel Payment" : "Cancel"}
              </ThemedText>
            </Button>

            <Button
              onPress={onContinue}
              variant={isHigh ? "outline" : "primary"}
              style={{
                flex: 1,
                borderColor: isHigh ? color : "transparent",
                backgroundColor: isHigh ? "transparent" : color,
              }}
            >
              <ThemedText style={{ color: isHigh ? color : "#FFF" }}>
                {isHigh ? "Proceed Anyway" : "Continue"}
              </ThemedText>
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  scoreContainer: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  progressBarBg: {
    height: 12,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  reasonsContainer: {
    width: "100%",
    marginBottom: Spacing.xl,
    maxHeight: 150,
  },
  reasonsTitle: {
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonsList: {
    flexGrow: 0,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
    marginTop: Spacing.sm,
  },
});
