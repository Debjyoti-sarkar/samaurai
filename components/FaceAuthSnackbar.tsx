import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { KAVACHColors, Shadows } from "@/constants/theme";

interface FaceAuthSnackbarProps {
  visible: boolean;
  message: string;
  tone?: "error" | "success" | "info";
}

export function FaceAuthSnackbar({
  visible,
  message,
  tone = "info",
}: FaceAuthSnackbarProps) {
  if (!visible || !message) return null;

  const backgroundColor =
    tone === "error"
      ? KAVACHColors.sos
      : tone === "success"
        ? KAVACHColors.success
        : KAVACHColors.info;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ThemedText style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Shadows.lg,
    zIndex: 999,
  },
  text: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
