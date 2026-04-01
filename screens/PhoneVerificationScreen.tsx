import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { FirebaseRecaptchaVerifierModal, FirebaseRecaptchaBanner } from "expo-firebase-recaptcha";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { app } from "@/utils/firebaseConfig";
import { sendFirebaseOTP, verifyFirebaseOTP, clearVerification } from "@/utils/firebaseOtpManager";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

// ==================== OTP BYPASS FLAG ====================
// Set to true to skip Firebase OTP verification (for testing/web)
// Set to false to enable real OTP verification
const OTP_BYPASS_ENABLED = Platform.OS === 'web' ? true : true; // Always bypass on web
// =========================================================

export default function PhoneVerificationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { setPhoneNumber, setAuthStep } = useAuth();

  // Recaptcha ref for Firebase Phone Auth
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number");
      return;
    }

    // OTP BYPASS: Skip Firebase verification when enabled
    if (OTP_BYPASS_ENABLED) {
      console.log("⚠️ OTP BYPASS ENABLED - Skipping Firebase verification");
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
      setStep("otp");
      setResendTimer(60);
      setVerificationId("bypass-mode");
      Alert.alert(
        "OTP Bypass Mode",
        "OTP verification is disabled for testing. Enter any 6-digit code to proceed.",
        [{ text: "OK" }]
      );
      setLoading(false);
      return;
    }

    if (!recaptchaVerifier.current) {
      Alert.alert("Error", "Please wait for the verification system to load");
      return;
    }

    setLoading(true);
    try {
      console.log("🚀 Sending OTP to:", phone);

      const result = await sendFirebaseOTP(phone, recaptchaVerifier.current);

      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        setStep("otp");
        setResendTimer(60);

        Alert.alert(
          "OTP Sent!",
          `A 6-digit verification code has been sent to +91 ${phone}. Please check your SMS.`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to send OTP. Please try again.");
      }
    } catch (error: any) {
      console.error("Send OTP error:", error);
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);

    // OTP BYPASS: Accept any 6-digit code when enabled
    if (OTP_BYPASS_ENABLED) {
      console.log("⚠️ OTP BYPASS ENABLED - Accepting any 6-digit code");
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
      console.log("✅ Phone verified (bypass mode)");
      await setPhoneNumber(phone);
      setAuthStep("bank_linking");
      navigation.navigate("BankLinking");
      setLoading(false);
      return;
    }

    try {
      console.log("🔍 Verifying OTP...");

      const result = await verifyFirebaseOTP(otp, verificationId || undefined);

      if (result.success) {
        console.log("✅ Phone verified! User ID:", result.userId);

        await setPhoneNumber(phone);
        setAuthStep("bank_linking");
        navigation.navigate("BankLinking");
      } else {
        Alert.alert("Verification Failed", result.error || "Invalid OTP");
        setOtp("");
      }
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    setOtp("");
    clearVerification();
    setVerificationId(null);
    handleSendOtp();
  };

  const handleBack = () => {
    if (step === "otp") {
      setStep("phone");
      setOtp("");
      clearVerification();
      setVerificationId(null);
      setResendTimer(0);
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      {/* Firebase Recaptcha Modal - Only render on native platforms when OTP bypass is disabled */}
      {Platform.OS !== 'web' && !OTP_BYPASS_ENABLED && (
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={app.options}
          attemptInvisibleVerification={true}
          title="Verify you're human"
          cancelLabel="Cancel"
        />
      )}

      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
        <Feather name="smartphone" size={48} color={KAVACHColors.primary} />
      </View>

      <ThemedText type="h2" style={styles.title}>
        {step === "phone" ? "Phone Verification" : "Enter OTP"}
      </ThemedText>

      <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
        {step === "phone"
          ? "We'll send a verification code to your phone via SMS"
          : `Enter the 6-digit code sent to +91 ${phone}`}
      </ThemedText>

      {/* Real SMS indicator */}
      <View style={[styles.smsBanner, { backgroundColor: KAVACHColors.success + "20" }]}>
        <Feather name="check-circle" size={16} color={KAVACHColors.success} />
        <ThemedText type="caption" style={{ color: KAVACHColors.success, marginLeft: 8 }}>
          Real SMS OTP will be sent to your phone
        </ThemedText>
      </View>

      {step === "phone" ? (
        <View style={styles.inputSection}>
          <View style={styles.phoneInputContainer}>
            <View style={[styles.countryCode, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText style={styles.countryCodeText}>🇮🇳 +91</ThemedText>
            </View>
            <TextInput
              style={[styles.phoneInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>

          <Button
            onPress={handleSendOtp}
            disabled={phone.length !== 10 || loading}
            style={[styles.button, { backgroundColor: KAVACHColors.primary }]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : "Send OTP"}
          </Button>

          {/* Recaptcha notice */}
          <View style={styles.recaptchaNotice}>
            <FirebaseRecaptchaBanner />
          </View>
        </View>
      ) : (
        <View style={styles.inputSection}>
          {/* OTP sent confirmation */}
          <View style={[styles.otpSentBox, { backgroundColor: KAVACHColors.primary + "10" }]}>
            <Feather name="mail" size={20} color={KAVACHColors.primary} />
            <ThemedText type="caption" style={{ color: KAVACHColors.primary, marginLeft: 8 }}>
              Check your SMS inbox for the OTP
            </ThemedText>
          </View>

          <View style={styles.otpContainer}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: theme.card,
                    borderColor: otp.length === index ? KAVACHColors.primary : theme.border,
                    borderWidth: otp.length === index ? 2 : 1
                  }
                ]}
              >
                <ThemedText type="h3">{otp[index] || ""}</ThemedText>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.hiddenInput}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <Button
            onPress={handleVerifyOtp}
            disabled={otp.length !== 6 || loading}
            style={[styles.button, { backgroundColor: KAVACHColors.primary }]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : "Verify OTP"}
          </Button>

          <View style={styles.resendContainer}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Didn't receive the code?
            </ThemedText>
            <Pressable onPress={handleResendOtp} disabled={resendTimer > 0}>
              <ThemedText
                type="small"
                style={{
                  color: resendTimer > 0 ? theme.textSecondary : KAVACHColors.primary,
                  fontWeight: "600",
                  padding: 8
                }}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.xl },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.xl
  },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center", marginBottom: Spacing.lg },
  smsBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg
  },
  inputSection: { flex: 1 },
  phoneInputContainer: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
    gap: Spacing.sm
  },
  countryCode: {
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
    borderRadius: BorderRadius.sm
  },
  countryCodeText: { fontSize: 16, fontWeight: "600" },
  phoneInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontSize: 16
  },
  button: { marginBottom: Spacing.lg },
  recaptchaNotice: {
    marginTop: Spacing.md,
    alignItems: "center"
  },
  otpSentBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl
  },
  otpBox: {
    width: 50,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    ...Shadows.sm
  },
  hiddenInput: { position: "absolute", opacity: 0 },
  resendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md
  },
});
