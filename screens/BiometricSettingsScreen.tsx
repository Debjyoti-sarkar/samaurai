import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Switch } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";

const USER_KEY = "@kavach_user";

export default function BiometricSettingsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { userData } = useAuth();

  const [isSupported, setIsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("Biometric");
  const [isEnabled, setIsEnabled] = useState(userData?.biometricEnabled || false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setIsSupported(compatible && enrolled);

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Fingerprint");
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType("Iris Scan");
      }
    } catch (error) {
      console.log("Biometric check error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      // Authenticate before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricType} for login`,
        cancelLabel: "Cancel",
        fallbackLabel: "Use PIN",
      });

      if (!result.success) {
        Alert.alert("Authentication Failed", "Could not verify your identity");
        return;
      }
    }

    setIsEnabled(value);

    // Save to storage
    try {
      const updatedUser = { ...userData, biometricEnabled: value };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

      Alert.alert(
        "Success",
        value 
          ? `${biometricType} authentication enabled` 
          : `${biometricType} authentication disabled`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save settings");
      setIsEnabled(!value); // Revert
    }
  };

  const getIcon = () => {
    if (biometricType === "Face ID") return "smile";
    if (biometricType === "Fingerprint") return "smartphone";
    return "shield";
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          <Feather name={getIcon()} size={32} color={KAVACHColors.primary} />
        </View>
        <ThemedText type="h3" style={styles.title}>{biometricType} Authentication</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Use {biometricType.toLowerCase()} for quick and secure login
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText>Checking device capabilities...</ThemedText>
        </View>
      ) : !isSupported ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Feather name="alert-circle" size={24} color={KAVACHColors.warning} />
          <ThemedText style={styles.cardTitle}>Not Available</ThemedText>
          <ThemedText style={[styles.cardText, { color: theme.textSecondary }]}>
            {biometricType} is not set up on this device. Please enable it in your device settings first.
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={[styles.settingRow, { backgroundColor: theme.card }, Shadows.sm]}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingTitle}>Enable {biometricType}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Use instead of PIN for faster login
              </ThemedText>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: theme.border, true: KAVACHColors.primary + "60" }}
              thumbColor={isEnabled ? KAVACHColors.primary : theme.backgroundSecondary}
            />
          </View>

          <View style={[styles.infoCard, { backgroundColor: KAVACHColors.info + "15" }]}>
            <Feather name="info" size={20} color={KAVACHColors.info} />
            <ThemedText style={[styles.infoText, { color: theme.text }]}>
              Your PIN will still be required as a backup if {biometricType.toLowerCase()} fails.
            </ThemedText>
          </View>

          <View style={styles.benefits}>
            <ThemedText type="h4" style={styles.benefitsTitle}>Benefits</ThemedText>
            
            <View style={styles.benefitItem}>
              <Feather name="zap" size={20} color={KAVACHColors.primary} />
              <View style={styles.benefitText}>
                <ThemedText>Faster Login</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  No need to enter your PIN each time
                </ThemedText>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <Feather name="shield" size={20} color={KAVACHColors.primary} />
              <View style={styles.benefitText}>
                <ThemedText>Enhanced Security</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Biometrics are unique to you
                </ThemedText>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <Feather name="lock" size={20} color={KAVACHColors.primary} />
              <View style={styles.benefitText}>
                <ThemedText>Secure Storage</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Your biometric data never leaves your device
                </ThemedText>
              </View>
            </View>
          </View>
        </>
      )}
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
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cardText: {
    textAlign: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
  },
  benefits: {
    gap: Spacing.md,
  },
  benefitsTitle: {
    marginBottom: Spacing.sm,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  benefitText: {
    flex: 1,
  },
});
