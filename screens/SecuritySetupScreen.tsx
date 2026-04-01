import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { CustomFaceUnlock } from "@/components/CustomFaceUnlock";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  saveSecurePin,
  saveBiometricFlag,
  saveCustomFaceFlag,
  saveCustomFaceEnrolledFlag,
} from "@/utils/secureManager";
import simService from "@/services/SIMService";
import { Spacing, KAVACHColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const PIN_LENGTH = 6;

type SetupStep = "biometric" | "pin_create" | "pin_confirm" | "aadhaar";

export default function SecuritySetupScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const {
    setupPin,
    enableBiometric,
    enableCustomFace,
    completeOnboarding,
    userData,
    registerSIM,
  } = useAuth();

  const [step, setStep] = useState<SetupStep>("biometric");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [biometricType, setBiometricType] =
    useState<string>("System Biometrics");
  const [pinError, setPinError] = useState(false);
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [hasHardwareBio, setHasHardwareBio] = useState(false);

  const shakeAnimation = useSharedValue(0);

  React.useEffect(() => {
    checkBiometricType();
  }, []);

  const checkBiometricType = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      setHasHardwareBio(hasHardware && isEnrolled);

      if (hasHardware && isEnrolled) {
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricType("Fingerprint");
        } else if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricType("Face ID");
        }
      }
    } catch (error) {
      console.log("Biometric check error:", error);
    }
  };

  const animatedShake = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  const handleBiometricSetup = async () => {
    try {
      if (!hasHardwareBio) {
        // Fallback to custom face setup directly
        handleCustomFaceSetup();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricType} for KAVACH`,
        fallbackLabel: "Use PIN instead",
      });

      if (result.success) {
        await saveBiometricFlag(true);
        await enableBiometric(true);
      }
      setStep("pin_create");
    } catch (error) {
      console.log("Biometric setup error:", error);
      setStep("pin_create");
    }
  };

  const handleCustomFaceSetup = async () => {
    setShowFaceEnrollment(true);
  };

  const handleCustomFaceEnrollmentSuccess = async () => {
    try {
      await saveCustomFaceFlag(true);
      await saveCustomFaceEnrolledFlag(true);
      await enableCustomFace(true);
      setShowFaceEnrollment(false);
      setStep("pin_create");
    } catch (error) {
      console.log("Custom Face setup error:", error);
      setShowFaceEnrollment(false);
      setStep("pin_create");
    }
  };

  const handleSkipBiometric = () => {
    setStep("pin_create");
  };

  const handlePinChange = (value: string) => {
    if (value.length <= PIN_LENGTH) {
      setPin(value);
      setPinError(false);
      if (value.length === PIN_LENGTH) {
        setTimeout(() => setStep("pin_confirm"), 300);
      }
    }
  };

  const handleConfirmPinChange = (value: string) => {
    if (value.length <= PIN_LENGTH) {
      setConfirmPin(value);
      setPinError(false);
      if (value.length === PIN_LENGTH) {
        if (value === pin) {
          handlePinSetupComplete(value);
        } else {
          setPinError(true);
          shakeAnimation.value = withSequence(
            withSpring(-10, { damping: 3, stiffness: 400 }),
            withSpring(10, { damping: 3, stiffness: 400 }),
            withSpring(-10, { damping: 3, stiffness: 400 }),
            withSpring(0, { damping: 3, stiffness: 400 }),
          );
          setConfirmPin("");
        }
      }
    }
  };

  const handlePinSetupComplete = async (finalPin: string) => {
    console.log("✅ PIN setup complete, starting navigation...");
    try {
      console.log("💾 Saving PIN...");
      await saveSecurePin(finalPin);
      await setupPin(finalPin);
      console.log("✅ PIN saved");

      console.log("🔄 Completing onboarding...");
      await completeOnboarding();
      console.log("✅ Onboarding completed");

      console.log("🚀 Navigating to Dashboard...");
      // Navigate immediately on web, use setTimeout for native
      if (Platform.OS === "web") {
        navigation.reset({
          index: 0,
          routes: [{ name: "Dashboard" }],
        });
      } else {
        // Register SIM on native platforms
        try {
          await registerSIMDuringSetup();
        } catch (simError) {
          console.warn(
            "⚠️ SIM registration failed, continuing anyway:",
            simError,
          );
        }

        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Dashboard" }],
          });
        }, 100);
      }
    } catch (error) {
      console.error("❌ PIN setup error:", error);
      // Try to navigate anyway
      console.log("🔄 Attempting navigation despite error...");
      navigation.reset({
        index: 0,
        routes: [{ name: "Dashboard" }],
      });
    }
  };

  const registerSIMDuringSetup = async () => {
    try {
      // Request permission and register SIM
      const hasPermission = await simService.requestPhoneStatePermission();
      if (hasPermission) {
        const result = await registerSIM();
        if (result.success) {
          console.log("✅ SIM registered successfully during security setup");
        } else {
          console.warn("⚠️ SIM registration failed:", result.error);
        }
      } else {
        console.warn(
          "⚠️ Phone state permission not granted for SIM registration",
        );
      }
    } catch (error) {
      console.error("❌ Error during SIM registration:", error);
    }
  };

  const handleAadhaarLink = async () => {
    console.log("🔗 handleAadhaarLink - Starting...");
    try {
      // Try to persist aadhaar locally (if available on userData). If not available,
      // proceed with the existing linking flow which may return/verify the aadhaar.
      const aadhaarNumber =
        (userData as any)?.aadhaarNumber ?? (userData as any)?.aadhaar ?? null;
      if (aadhaarNumber) {
        await saveAadhaar(aadhaarNumber);
      }

      await linkAadhaar();

      // Register SIM before completing onboarding (skip on web)
      if (Platform.OS !== "web") {
        await registerSIMDuringSetup();
      }

      await completeOnboarding();
      console.log("✅ Onboarding complete, navigating to Dashboard...");

      // Use a slight delay to ensure state updates
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "Dashboard" }],
        });
      }, 100);
    } catch (error) {
      console.error("❌ handleAadhaarLink error:", error);
    }
  };

  const handleSkipAadhaar = async () => {
    console.log("⏭️ handleSkipAadhaar - Starting...");
    try {
      // Register SIM before completing onboarding (skip on web)
      if (Platform.OS !== "web") {
        await registerSIMDuringSetup();
      }

      await completeOnboarding();
      console.log("✅ Onboarding complete, navigating to Dashboard...");

      // Use a slight delay to ensure state updates
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "Dashboard" }],
        });
      }, 100);
    } catch (error) {
      console.error("❌ handleSkipAadhaar error:", error);
    }
  };

  const renderBiometricStep = () => (
    <View style={styles.stepContainer}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: KAVACHColors.primary + "15" },
        ]}
      >
        <Feather
          name={biometricType === "Face ID" ? "smile" : "lock"}
          size={48}
          color={KAVACHColors.primary}
        />
      </View>
      <ThemedText type="h2" style={styles.title}>
        {t("setupBiometric")}
      </ThemedText>
      <ThemedText
        type="small"
        style={[styles.subtitle, { color: theme.textSecondary }]}
      >
        Enable {hasHardwareBio ? biometricType : "KAVACH Face ID"} for quick and
        secure access to KAVACH
      </ThemedText>

      {hasHardwareBio ? (
        <>
          <Button
            onPress={handleBiometricSetup}
            style={[
              styles.actionButton,
              { backgroundColor: KAVACHColors.primary },
            ]}
          >
            Enable {biometricType}
          </Button>

          <Button
            onPress={handleCustomFaceSetup}
            variant="outline"
            style={styles.actionButton}
          >
            Use Camera Face ID instead
          </Button>
        </>
      ) : (
        <Button
          onPress={handleCustomFaceSetup}
          style={[
            styles.actionButton,
            { backgroundColor: KAVACHColors.primary },
          ]}
        >
          Enable Camera Face ID
        </Button>
      )}

      <Pressable onPress={handleSkipBiometric} style={styles.skipButton}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Skip for now
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderPinStep = (isConfirm: boolean) => (
    <View style={styles.stepContainer}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: KAVACHColors.primary + "15" },
        ]}
      >
        <Feather name="lock" size={48} color={KAVACHColors.primary} />
      </View>
      <ThemedText type="h2" style={styles.title}>
        {isConfirm ? t("confirmPin") : t("createPin")}
      </ThemedText>
      <ThemedText
        type="small"
        style={[styles.subtitle, { color: theme.textSecondary }]}
      >
        {isConfirm
          ? "Enter the same PIN to confirm"
          : "Create a secure 6-digit PIN for backup access"}
      </ThemedText>

      <Animated.View style={[styles.pinContainer, animatedShake]}>
        <View style={styles.pinDots}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                {
                  backgroundColor:
                    (isConfirm ? confirmPin : pin).length > index
                      ? pinError
                        ? KAVACHColors.sos
                        : KAVACHColors.primary
                      : theme.border,
                },
              ]}
            />
          ))}
        </View>
        <TextInput
          style={styles.hiddenInput}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          value={isConfirm ? confirmPin : pin}
          onChangeText={isConfirm ? handleConfirmPinChange : handlePinChange}
          autoFocus
          secureTextEntry
        />
      </Animated.View>

      {pinError ? (
        <ThemedText
          type="small"
          style={[styles.errorText, { color: KAVACHColors.sos }]}
        >
          PINs do not match. Please try again.
        </ThemedText>
      ) : null}

      {isConfirm ? (
        <Pressable
          onPress={() => {
            setStep("pin_create");
            setPin("");
            setConfirmPin("");
          }}
          style={styles.skipButton}
        >
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Change PIN
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <>
      <ScreenKeyboardAwareScrollView>
        <View style={styles.progressContainer}>
          {["biometric", "pin_create"].map((s, index) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    step === s || (step === "pin_confirm" && s === "pin_create")
                      ? KAVACHColors.primary
                      : step === "pin_confirm" && index < 1
                        ? KAVACHColors.primary
                        : theme.border,
                },
              ]}
            />
          ))}
        </View>

        {step === "biometric" && renderBiometricStep()}
        {step === "pin_create" && renderPinStep(false)}
        {step === "pin_confirm" && renderPinStep(true)}
      </ScreenKeyboardAwareScrollView>

      <CustomFaceUnlock
        visible={showFaceEnrollment}
        mode="enroll"
        userId={userData?.phoneNumber || ""}
        onClose={() => setShowFaceEnrollment(false)}
        onSuccess={handleCustomFaceEnrollmentSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["3xl"],
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContainer: {
    alignItems: "center",
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
    marginBottom: Spacing["2xl"],
  },
  actionButton: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  skipButton: {
    padding: Spacing.md,
  },
  pinContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  pinDots: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 60,
  },
  errorText: {
    marginBottom: Spacing.xl,
  },
});
