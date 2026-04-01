import React, { useState } from "react";
import { View, StyleSheet, Alert, TextInput, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";

const USER_KEY = "@kavach_user";

export default function ChangePinScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { userData } = useAuth();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePin = async () => {
    // Validate current PIN
    if (currentPin !== userData?.pin) {
      Alert.alert("Error", "Current PIN is incorrect");
      return;
    }

    // Validate new PIN
    if (newPin.length !== 6) {
      Alert.alert("Error", "New PIN must be 6 digits");
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      Alert.alert("Error", "PIN must contain only numbers");
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert("Error", "New PIN and confirmation don't match");
      return;
    }

    if (newPin === currentPin) {
      Alert.alert("Error", "New PIN must be different from current PIN");
      return;
    }

    setIsLoading(true);
    try {
      // Update PIN in storage
      const updatedUser = { ...userData, pin: newPin };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

      Alert.alert("Success", "Your PIN has been changed successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to change PIN. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderPinInput = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    showPin: boolean,
    setShowPin: (v: boolean) => void
  ) => (
    <View style={styles.inputContainer}>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={(text) => setValue(text.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="••••••"
          placeholderTextColor={theme.textSecondary}
          keyboardType="numeric"
          secureTextEntry={!showPin}
          maxLength={6}
        />
        <Pressable onPress={() => setShowPin(!showPin)} style={styles.eyeButton}>
          <Feather name={showPin ? "eye" : "eye-off"} size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          <Feather name="lock" size={32} color={KAVACHColors.primary} />
        </View>
        <ThemedText type="h3" style={styles.title}>Change Your PIN</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter your current PIN and set a new 6-digit PIN
        </ThemedText>
      </View>

      {renderPinInput("Current PIN", currentPin, setCurrentPin, showCurrentPin, setShowCurrentPin)}
      {renderPinInput("New PIN", newPin, setNewPin, showNewPin, setShowNewPin)}
      {renderPinInput("Confirm New PIN", confirmPin, setConfirmPin, showConfirmPin, setShowConfirmPin)}

      <View style={styles.requirements}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          PIN Requirements:
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          • Must be exactly 6 digits
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          • Numbers only (0-9)
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          • Must be different from current PIN
        </ThemedText>
      </View>

      <Button
        onPress={handleChangePin}
        disabled={isLoading || !currentPin || !newPin || !confirmPin}
        style={styles.button}
      >
        {isLoading ? "Changing PIN..." : "Change PIN"}
      </Button>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 18,
    letterSpacing: 8,
  },
  eyeButton: {
    padding: Spacing.sm,
  },
  requirements: {
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  button: {
    marginTop: Spacing.md,
  },
});
