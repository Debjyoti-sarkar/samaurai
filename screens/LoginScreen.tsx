import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { CustomFaceUnlock } from "@/components/CustomFaceUnlock";
import { FaceAuthSnackbar } from "@/components/FaceAuthSnackbar";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import {
  Spacing,
  BorderRadius,
  KAVACHColors,
  Shadows,
} from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import { useSIMMonitor } from "@/hooks/useSIMMonitor";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { getFaceEnrollmentStatus } from "@/services/faceVerification";
import { verifySecurePin } from "@/utils/secureManager";

const PIN_LENGTH = 6;

export default function LoginScreen() {
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, setLanguage, language, languages } = useLanguage();
  const { userData, login, completeReauth } = useAuth();
  const { trackFailedPin, trackFailedAuth, startSession, restoreTrust } =
    useNexaSafe();

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("Biometric");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showFaceUnlock, setShowFaceUnlock] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarTone, setSnackbarTone] = useState<
    "error" | "success" | "info"
  >("info");

  const shakeAnimation = useSharedValue(0);

  const handleSIMChangeOnLogin = useCallback(() => {
    console.log("SIM changed detected on login screen - data will be wiped");
  }, []);

  const { checkSIM } = useSIMMonitor({
    enabled: true,
    onSIMChange: handleSIMChangeOnLogin,
  });

  const showSnackbar = useCallback(
    (message: string, tone: "error" | "success" | "info" = "info") => {
      setSnackbarMessage(message);
      setSnackbarTone(tone);
      setTimeout(() => setSnackbarMessage(""), 2600);
    },
    [],
  );

  const animatedShake = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  const finishLogin = useCallback(async () => {
    completeReauth();
    startSession();
    restoreTrust();
    await login();
    navigation.reset({
      index: 0,
      routes: [{ name: "Dashboard" }],
    });
  }, [completeReauth, login, navigation, restoreTrust, startSession]);

  const handleBiometricLogin = useCallback(async () => {
    try {
      const simOk = await checkSIM();
      if (!simOk) return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login to KAVACH",
        fallbackLabel: "Use PIN instead",
      });

      if (result.success) {
        await finishLogin();
      } else {
        trackFailedAuth();
      }
    } catch (error) {
      console.log("Biometric login error:", error);
      trackFailedAuth();
    }
  }, [checkSIM, finishLogin, trackFailedAuth]);

  const checkBiometricAndAttempt = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

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

      if (userData?.biometricEnabled) {
        handleBiometricLogin();
      }
    } catch (error) {
      console.log("Biometric check error:", error);
    }
  }, [handleBiometricLogin, userData?.biometricEnabled]);

  useEffect(() => {
    checkBiometricAndAttempt();
  }, [checkBiometricAndAttempt]);

  const openCustomFaceUnlock = useCallback(async () => {
    try {
      if (!userData?.phoneNumber) {
        showSnackbar("User profile missing for face unlock", "error");
        return;
      }

      const status = await getFaceEnrollmentStatus(userData.phoneNumber);
      if (!status.enrolled) {
        navigation.navigate("FaceSetup");
        return;
      }

      setShowFaceUnlock(true);
    } catch (error) {
      console.log("Face status error:", error);
      showSnackbar("Face setup check failed. Please try again.", "error");
    }
  }, [navigation, showSnackbar, userData?.phoneNumber]);

  const handleCustomFaceAuthSuccess = useCallback(async () => {
    setShowFaceUnlock(false);
    await finishLogin();
  }, [finishLogin]);

  const handleCustomFaceFailure = useCallback(
    (message: string) => {
      const lower = message.toLowerCase();
      if (lower.includes("not detected")) {
        showSnackbar("Face not detected. Align your face and retry.", "error");
      } else if (lower.includes("confidence")) {
        showSnackbar("Low confidence. Retry in better lighting.", "error");
      } else if (lower.includes("match")) {
        showSnackbar("Face verification failed. Please retry.", "error");
      } else {
        showSnackbar(message || "Face verification failed", "error");
      }
    },
    [showSnackbar],
  );

  const handlePinChange = (value: string) => {
    if (value.length <= PIN_LENGTH) {
      setPin(value);
      setPinError(false);
      if (value.length === PIN_LENGTH) {
        verifyPin(value);
      }
    }
  };

  const verifyPin = async (enteredPin: string) => {
    const simOk = await checkSIM();
    if (!simOk) {
      setPin("");
      return;
    }

    const ok = await verifySecurePin(enteredPin);
    if (ok || enteredPin === userData?.pin) {
      await finishLogin();
      return;
    }

    setPinError(true);
    trackFailedPin();
    shakeAnimation.value = withSequence(
      withSpring(-10, { damping: 3, stiffness: 400 }),
      withSpring(10, { damping: 3, stiffness: 400 }),
      withSpring(-10, { damping: 3, stiffness: 400 }),
      withSpring(0, { damping: 3, stiffness: 400 }),
    );
    setPin("");
  };

  const handleLanguageSelect = async (langCode: string) => {
    await setLanguage(langCode as any);
    setShowLanguageMenu(false);
  };

  const handleForgotPin = useCallback(() => {
    navigation.navigate("OTPVerification", {
      phoneNumber: userData?.phoneNumber,
      purpose: "reset",
    });
  }, [navigation, userData?.phoneNumber]);

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <View style={{ width: 44 }} />
        <Pressable
          onPress={() => setShowLanguageMenu(!showLanguageMenu)}
          style={[
            styles.languageButton,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="globe" size={20} color={theme.text} />
        </Pressable>
      </View>

      {showLanguageMenu ? (
        <View
          style={[
            styles.languageMenu,
            { backgroundColor: theme.card },
            Shadows.lg,
          ]}
        >
          {languages.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => handleLanguageSelect(lang.code)}
              style={[
                styles.languageMenuItem,
                language === lang.code && {
                  backgroundColor: KAVACHColors.primary + "20",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.languageMenuText,
                  language === lang.code && { color: KAVACHColors.primary },
                ]}
              >
                {lang.nativeName}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.content}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText
          style={[
            styles.appName,
            { color: isDark ? theme.text : KAVACHColors.primary },
          ]}
        >
          KAVACH
        </ThemedText>
        <ThemedText style={[styles.welcome, { color: theme.textSecondary }]}>
          {t("welcome")}
        </ThemedText>

        <View style={styles.pinSection}>
          <ThemedText type="body" style={styles.pinLabel}>
            {t("enterPin")}
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
                        pin.length > index
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
              value={pin}
              onChangeText={handlePinChange}
              autoFocus
              secureTextEntry
            />
          </Animated.View>

          {pinError ? (
            <ThemedText
              type="small"
              style={[styles.errorText, { color: KAVACHColors.sos }]}
            >
              Incorrect PIN. Please try again.
            </ThemedText>
          ) : null}

          <Pressable onPress={handleForgotPin} style={styles.forgotButton}>
            <ThemedText type="small" style={{ color: KAVACHColors.primary }}>
              {t("forgotPin")}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.authButtonRow}>
          {userData?.biometricEnabled ? (
            <Pressable
              onPress={handleBiometricLogin}
              style={[
                styles.biometricButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather
                name={biometricType === "Face ID" ? "smile" : "lock"}
                size={24}
                color={KAVACHColors.primary}
              />
              <ThemedText
                style={[styles.biometricText, { color: KAVACHColors.primary }]}
              >
                {biometricType}
              </ThemedText>
            </Pressable>
          ) : null}

          {userData?.customFaceEnabled ? (
            <Pressable
              onPress={openCustomFaceUnlock}
              style={[
                styles.biometricButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="camera" size={24} color={KAVACHColors.info} />
              <ThemedText
                style={[styles.biometricText, { color: KAVACHColors.info }]}
              >
                KAVACH Face ID
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <CustomFaceUnlock
        visible={showFaceUnlock}
        mode="verify"
        userId={userData?.phoneNumber || ""}
        onClose={() => setShowFaceUnlock(false)}
        onSuccess={handleCustomFaceAuthSuccess}
        onFailure={handleCustomFaceFailure}
      />

      <FaceAuthSnackbar
        visible={!!snackbarMessage}
        message={snackbarMessage}
        tone={snackbarTone}
      />
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  languageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  languageMenu: {
    position: "absolute",
    top: 70,
    right: 0,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    zIndex: 100,
  },
  languageMenuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  languageMenuText: { fontSize: 16 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  welcome: { fontSize: 16, marginBottom: Spacing["4xl"] },
  pinSection: { alignItems: "center", width: "100%" },
  pinLabel: { marginBottom: Spacing.xl },
  pinContainer: { alignItems: "center", marginBottom: Spacing.lg },
  pinDots: { flexDirection: "row", gap: Spacing.md },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  hiddenInput: { position: "absolute", opacity: 0, width: "100%", height: 60 },
  errorText: { marginBottom: Spacing.md },
  forgotButton: { padding: Spacing.md },
  authButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing["3xl"],
    justifyContent: "center",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  biometricText: { fontSize: 16, fontWeight: "500" },
});
