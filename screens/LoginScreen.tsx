import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
} from "react-native";
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
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import { verifySecurePin } from "@/utils/secureManager";
import { useSIMMonitor } from "@/hooks/useSIMMonitor";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const PIN_LENGTH = 6;

export default function LoginScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, setLanguage, language, languages } = useLanguage();

  //  🔥 NEW
  const { userData, login, completeReauth } = useAuth();

  // NexaSafe integration for failed PIN tracking
  const { trackFailedPin, trackFailedAuth, startSession, restoreTrust } = useNexaSafe();

  // 🔒 SIM SECURITY: Check SIM before allowing login
  const handleSIMChangeOnLogin = useCallback(() => {
    console.log("🚨 SIM changed detected on login screen - data will be wiped");
  }, []);

  const { checkSIM, simValid } = useSIMMonitor({
    enabled: true,
    onSIMChange: handleSIMChangeOnLogin,
  });

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("Biometric");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const shakeAnimation = useSharedValue(0);

  useEffect(() => {
    checkBiometricAndAttempt();
  }, []);

  const checkBiometricAndAttempt = async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Fingerprint");
      }

      if (userData?.biometricEnabled) {
        handleBiometricLogin();
      }
    } catch (error) {
      console.log("Biometric check error:", error);
    }
  };

  const animatedShake = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  const handleBiometricLogin = async () => {
    try {
      // 🔒 SIM SECURITY: Verify SIM before allowing biometric login
      const simOk = await checkSIM();
      if (!simOk) {
        // SIM changed - data wipe will be triggered by useSIMMonitor
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login to KAVACH",
        fallbackLabel: "Use PIN instead",
      });

      if (result.success) {

        // 🔥 NEW — unlock app
        completeReauth();

        // NexaSafe: Start fresh session after successful login and restore trust
        startSession();
        restoreTrust();

        await login();
        navigation.reset({
          index: 0,
          routes: [{ name: "Dashboard" }],
        });
      } else {
        // NexaSafe: Track failed biometric auth
        trackFailedAuth();
      }
    } catch (error) {
      console.log("Biometric login error:", error);
      // NexaSafe: Track failed biometric auth on error
      trackFailedAuth();
    }
  };

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
    // 🔒 SIM SECURITY: Verify SIM before allowing login
    const simOk = await checkSIM();
    if (!simOk) {
      // SIM changed - data wipe will be triggered by useSIMMonitor
      // Don't proceed with login
      setPin("");
      return;
    }

    // Try secure PIN first
    const ok = await verifySecurePin(enteredPin);
    if (ok) {

      // 🔥 NEW
      completeReauth();

      // NexaSafe: Start fresh session after successful login and restore trust
      startSession();
      restoreTrust();

      await login();
      navigation.reset({
        index: 0,
        routes: [{ name: "Dashboard" }],
      });
      return;
    }

    // Legacy fallback
    if (enteredPin === userData?.pin) {

      // 🔥 NEW
      completeReauth();

      // NexaSafe: Start fresh session after successful login and restore trust
      startSession();
      restoreTrust();

      await login();
      navigation.reset({
        index: 0,
        routes: [{ name: "Dashboard" }],
      });
      return;
    }

    // Incorrect PIN
    setPinError(true);

    // NexaSafe: Track failed PIN attempt
    trackFailedPin();

    shakeAnimation.value = withSequence(
      withSpring(-10, { damping: 3, stiffness: 400 }),
      withSpring(10, { damping: 3, stiffness: 400 }),
      withSpring(-10, { damping: 3, stiffness: 400 }),
      withSpring(0, { damping: 3, stiffness: 400 })
    );
    setPin("");
  };

  const handleLanguageSelect = async (langCode: string) => {
    await setLanguage(langCode as any);
    setShowLanguageMenu(false);
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <View style={{ width: 44 }} />
        <Pressable
          onPress={() => setShowLanguageMenu(!showLanguageMenu)}
          style={[styles.languageButton, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="globe" size={20} color={theme.text} />
        </Pressable>
      </View>

      {showLanguageMenu ? (
        <View style={[styles.languageMenu, { backgroundColor: theme.card }, Shadows.lg]}>
          {languages.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => handleLanguageSelect(lang.code)}
              style={[
                styles.languageMenuItem,
                language === lang.code && { backgroundColor: KAVACHColors.primary + "20" },
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
          style={[styles.appName, { color: isDark ? theme.text : KAVACHColors.primary }]}
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
            <ThemedText type="small" style={[styles.errorText, { color: KAVACHColors.sos }]}>
              Incorrect PIN. Please try again.
            </ThemedText>
          ) : null}

          <Pressable onPress={() => {}} style={styles.forgotButton}>
            <ThemedText type="small" style={{ color: KAVACHColors.primary }}>
              {t("forgotPin")}
            </ThemedText>
          </Pressable>
        </View>

        {userData?.biometricEnabled ? (
          <Pressable
            onPress={handleBiometricLogin}
            style={[styles.biometricButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather
              name={biometricType === "Face ID" ? "smile" : "lock"}
              size={24}
              color={KAVACHColors.primary}
            />
            <ThemedText style={[styles.biometricText, { color: KAVACHColors.primary }]}>
              {t("useBiometric")}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
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
  logo: { width: 80, height: 80, marginBottom: Spacing.lg, borderRadius: BorderRadius.md },
  appName: { fontSize: 28, fontWeight: "800", letterSpacing: 2, marginBottom: Spacing.xs },
  welcome: { fontSize: 16, marginBottom: Spacing["4xl"] },
  pinSection: { alignItems: "center", width: "100%" },
  pinLabel: { marginBottom: Spacing.xl },
  pinContainer: { alignItems: "center", marginBottom: Spacing.lg },
  pinDots: { flexDirection: "row", gap: Spacing.md },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  hiddenInput: { position: "absolute", opacity: 0, width: "100%", height: 60 },
  errorText: { marginBottom: Spacing.md },
  forgotButton: { padding: Spacing.md },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing["3xl"],
    gap: Spacing.sm,
  },
  biometricText: { fontSize: 16, fontWeight: "500" },
});
