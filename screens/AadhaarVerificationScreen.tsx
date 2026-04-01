/**
 * Aadhaar Verification Screen
 * Implements REAL Aadhaar authentication via Sandbox.co.in OKYC API
 *
 * Flow:
 * 1. User enters 12-digit Aadhaar number
 * 2. OTP is sent to Aadhaar-linked mobile
 * 3. User enters OTP for verification
 * 4. On success, receives verified KYC data (name, DOB, address, photo)
 */

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useScreenSecurity } from "@/hooks/useScreenSecurity";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import {
  aadhaarService,
  AadhaarData,
} from "@/services/digilockerService";

const USER_KEY = "@kavach_user";

type VerificationStep = "input" | "otp" | "verified";

export default function AadhaarVerificationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { userData, refreshUserData } = useAuth();

  // Enable screen security for Aadhaar screen
  useScreenSecurity(true);

  const [step, setStep] = useState<VerificationStep>("input");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] = useState<Partial<AadhaarData> | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check existing verification status and API status on mount
  useEffect(() => {
    checkVerificationStatus();
    checkApiConfiguration();
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Validate Aadhaar number as user types
  useEffect(() => {
    const digits = aadhaarNumber.replace(/\D/g, "");
    if (digits.length === 12) {
      const validation = aadhaarService.validateAadhaarNumber(digits);
      if (!validation.valid) {
        setValidationError(validation.error || "Invalid Aadhaar number");
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [aadhaarNumber]);

  const checkVerificationStatus = async () => {
    const status = await aadhaarService.getVerificationStatus();
    if (status.verified) {
      const storedData = await aadhaarService.getStoredAadhaarData();
      setAadhaarData(storedData);
      setStep("verified");
    } else if (userData?.aadhaarLinked) {
      setStep("verified");
    }
  };

  const checkApiConfiguration = async () => {
    const status = await aadhaarService.checkApiStatus();
    setApiConfigured(status.configured);
    if (!status.configured) {
      console.warn("[Aadhaar] API not configured:", status.message);
    }
  };

  const formatAadhaar = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(" ");
  };

  // ==================== OTP Flow ====================
  const handleSendOtp = async () => {
    const digits = aadhaarNumber.replace(/\D/g, "");

    if (digits.length !== 12) {
      Alert.alert("Invalid Aadhaar", "Please enter a valid 12-digit Aadhaar number");
      return;
    }

    // Validate using service
    const validation = aadhaarService.validateAadhaarNumber(digits);
    if (!validation.valid) {
      Alert.alert("Invalid Aadhaar", validation.error || "Please enter a valid Aadhaar number");
      return;
    }

    setIsLoading(true);

    try {
      const result = await aadhaarService.requestOTP(digits);

      if (result.success) {
        setSessionId(result.sessionId || null);
        setStep("otp");
        setResendTimer(60); // 60 seconds for real OTP
        Alert.alert(
          "OTP Sent",
          result.message || "A verification code has been sent to your Aadhaar-registered mobile number"
        );
      } else {
        if (result.setupRequired) {
          Alert.alert(
            "Service Unavailable",
            "Aadhaar verification service is not configured. Please contact support."
          );
        } else {
          Alert.alert("Error", result.error || "Failed to send OTP. Please try again.");
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send OTP. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP");
      return;
    }

    setIsLoading(true);

    try {
      const result = await aadhaarService.verifyOTP(otp, sessionId || undefined);

      if (result.success && result.data) {
        setAadhaarData(result.data);
        await saveVerification(result.data);
        setStep("verified");
        Alert.alert(
          "Verification Successful",
          `Your Aadhaar has been verified successfully!\n\nName: ${result.data.name}`
        );
      } else {
        Alert.alert("Verification Failed", result.error || "Invalid OTP. Please try again.");
        // Don't clear OTP on failure - let user correct it
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    setOtp("");
    handleSendOtp();
  };

  // ==================== Helper Functions ====================
  const saveVerification = async (data: AadhaarData) => {
    try {
      const updatedUser = {
        ...userData,
        aadhaarLinked: true,
        aadhaarMasked: data.uid,
        aadhaarName: data.name,
        aadhaarVerifiedAt: data.verifiedAt,
      };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      if (refreshUserData) {
        await refreshUserData();
      }
    } catch (error) {
      console.error("Failed to save verification:", error);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      "Unlink Aadhaar",
      "Are you sure you want to unlink your Aadhaar? Some features may become unavailable.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            await aadhaarService.clearAllData();
            const updatedUser = { ...userData, aadhaarLinked: false, aadhaarName: undefined };
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
            if (refreshUserData) {
              await refreshUserData();
            }
            setStep("input");
            setAadhaarNumber("");
            setOtp("");
            setAadhaarData(null);
            setSessionId(null);
          },
        },
      ]
    );
  };

  // ==================== Render Functions ====================

  // Verified State
  if (step === "verified") {
    return (
      <ScreenScrollView>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.success + "15" }]}>
            <Feather name="check-circle" size={32} color={KAVACHColors.success} />
          </View>
          <ThemedText type="h3" style={styles.title}>Aadhaar Verified</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your identity has been verified via UIDAI
          </ThemedText>
        </View>

        {/* Profile Photo from Aadhaar */}
        {aadhaarData?.photo && (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: aadhaarData.photo }}
              style={styles.profilePhoto}
              resizeMode="cover"
            />
          </View>
        )}

        <View style={[styles.verifiedCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <View style={styles.verifiedRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Aadhaar Number</ThemedText>
            <ThemedText style={styles.maskedNumber}>
              {aadhaarData?.uid || "XXXX XXXX XXXX"}
            </ThemedText>
          </View>
          {aadhaarData?.name && (
            <View style={styles.verifiedRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Name</ThemedText>
              <ThemedText style={styles.maskedNumber}>{aadhaarData.name}</ThemedText>
            </View>
          )}
          {aadhaarData?.gender && (
            <View style={styles.verifiedRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Gender</ThemedText>
              <ThemedText>{aadhaarData.gender}</ThemedText>
            </View>
          )}
          {aadhaarData?.dob && (
            <View style={styles.verifiedRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Date of Birth</ThemedText>
              <ThemedText>{aadhaarData.dob}</ThemedText>
            </View>
          )}
          <View style={styles.verifiedRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Status</ThemedText>
            <View style={styles.statusBadge}>
              <Feather name="check" size={14} color={KAVACHColors.success} />
              <ThemedText style={{ color: KAVACHColors.success, marginLeft: 4 }}>
                Verified
              </ThemedText>
            </View>
          </View>
          {aadhaarData?.verifiedAt && (
            <View style={styles.verifiedRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Verified On</ThemedText>
              <ThemedText type="caption">
                {new Date(aadhaarData.verifiedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Address if available */}
        {aadhaarData?.address && (aadhaarData.address.locality || aadhaarData.address.district) && (
          <View style={[styles.addressCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.addressHeader}>
              <Feather name="map-pin" size={18} color={KAVACHColors.primary} />
              <ThemedText style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Address</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {[
                aadhaarData.address.locality,
                aadhaarData.address.district,
                aadhaarData.address.state,
                aadhaarData.address.pincode,
              ].filter(Boolean).join(", ")}
            </ThemedText>
          </View>
        )}

        <View style={[styles.uidaiBadge, { backgroundColor: "#FFF3E0" }]}>
          <View style={styles.uidaiLogo}>
            <ThemedText style={{ fontSize: 20 }}>🇮🇳</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontWeight: "600", color: "#E65100" }}>
              UIDAI Verified
            </ThemedText>
            <ThemedText type="caption" style={{ color: "#F57C00" }}>
              Unique Identification Authority of India
            </ThemedText>
          </View>
          <Feather name="shield" size={24} color="#E65100" />
        </View>

        <View style={[styles.benefitsCard, { backgroundColor: KAVACHColors.info + "10" }]}>
          <Feather name="shield" size={20} color={KAVACHColors.info} />
          <View style={styles.benefitsText}>
            <ThemedText style={{ fontWeight: "500" }}>Enhanced Security</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Your account is protected with Aadhaar-based KYC verification
            </ThemedText>
          </View>
        </View>

        <Button onPress={handleUnlink} variant="outline" style={styles.unlinkButton}>
          Unlink Aadhaar
        </Button>
      </ScreenScrollView>
    );
  }

  // Aadhaar Input
  if (step === "input") {
    return (
      <ScreenScrollView>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
            <Feather name="shield" size={32} color={KAVACHColors.primary} />
          </View>
          <ThemedText type="h3" style={styles.title}>Aadhaar Verification</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your 12-digit Aadhaar number to verify your identity
          </ThemedText>
        </View>

        {/* API Status Warning */}
        {apiConfigured === false && (
          <View style={[styles.warningCard, { backgroundColor: KAVACHColors.warning + "15" }]}>
            <Feather name="alert-triangle" size={20} color={KAVACHColors.warning} />
            <ThemedText style={[styles.warningText, { color: theme.text }]}>
              Aadhaar verification service is currently being configured. Please try again later.
            </ThemedText>
          </View>
        )}

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Aadhaar Number
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                borderColor: validationError ? KAVACHColors.sos : theme.border,
                color: theme.text
              },
            ]}
            value={formatAadhaar(aadhaarNumber)}
            onChangeText={(text) => setAadhaarNumber(text.replace(/\D/g, ""))}
            placeholder="XXXX XXXX XXXX"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            maxLength={14}
            editable={!isLoading}
          />
          {validationError && (
            <ThemedText style={styles.errorText}>{validationError}</ThemedText>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: KAVACHColors.info + "10" }]}>
          <Feather name="info" size={20} color={KAVACHColors.info} />
          <ThemedText style={[styles.infoText, { color: theme.text }]}>
            An OTP will be sent to your Aadhaar-registered mobile number for verification. Make sure your mobile number is linked with your Aadhaar.
          </ThemedText>
        </View>

        <Button
          onPress={handleSendOtp}
          disabled={isLoading || aadhaarNumber.replace(/\D/g, "").length !== 12 || !!validationError || apiConfigured === false}
        >
          {isLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <ThemedText style={{ color: "#fff" }}>Sending OTP...</ThemedText>
            </View>
          ) : (
            "Send OTP"
          )}
        </Button>

        {/* Benefits */}
        <View style={styles.benefits}>
          <ThemedText type="h4" style={styles.benefitsTitle}>Why verify Aadhaar?</ThemedText>

          <View style={styles.benefitItem}>
            <Feather name="trending-up" size={20} color={KAVACHColors.primary} />
            <ThemedText style={{ flex: 1 }}>Higher transaction limits (up to ₹2,00,000)</ThemedText>
          </View>

          <View style={styles.benefitItem}>
            <Feather name="shield" size={20} color={KAVACHColors.primary} />
            <ThemedText style={{ flex: 1 }}>Enhanced account security</ThemedText>
          </View>

          <View style={styles.benefitItem}>
            <Feather name="check-circle" size={20} color={KAVACHColors.primary} />
            <ThemedText style={{ flex: 1 }}>Complete KYC verification</ThemedText>
          </View>

          <View style={styles.benefitItem}>
            <Feather name="zap" size={20} color={KAVACHColors.primary} />
            <ThemedText style={{ flex: 1 }}>Instant bank account linking</ThemedText>
          </View>
        </View>
      </ScreenScrollView>
    );
  }

  // OTP Verification
  if (step === "otp") {
    return (
      <ScreenScrollView>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => { setStep("input"); setOtp(""); }}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
            <Feather name="message-square" size={32} color={KAVACHColors.primary} />
          </View>
          <ThemedText type="h3" style={styles.title}>Enter OTP</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter the 6-digit OTP sent to your Aadhaar-registered mobile number
          </ThemedText>
        </View>

        <View style={styles.aadhaarPreview}>
          <ThemedText style={{ color: theme.textSecondary }}>Aadhaar:</ThemedText>
          <ThemedText style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
            {aadhaarService.maskAadhaarNumber(aadhaarNumber)}
          </ThemedText>
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Verification Code
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.otpInput,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/\D/g, "").slice(0, 6))}
            placeholder="• • • • • •"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            maxLength={6}
            editable={!isLoading}
            autoFocus
          />
        </View>

        <Pressable
          onPress={handleResendOtp}
          style={styles.resendLink}
          disabled={resendTimer > 0 || isLoading}
        >
          <ThemedText
            style={{ color: resendTimer > 0 ? theme.textSecondary : KAVACHColors.primary }}
          >
            {resendTimer > 0
              ? `Resend OTP in ${resendTimer}s`
              : "Didn't receive OTP? Resend"}
          </ThemedText>
        </Pressable>

        <View style={[styles.infoCard, { backgroundColor: KAVACHColors.warning + "10" }]}>
          <Feather name="clock" size={20} color={KAVACHColors.warning} />
          <ThemedText style={[styles.infoText, { color: theme.text }]}>
            OTP is valid for 10 minutes. If you don't receive the OTP, check if your mobile number is linked with your Aadhaar.
          </ThemedText>
        </View>

        <Button
          onPress={handleVerifyOtp}
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <ThemedText style={{ color: "#fff" }}>Verifying...</ThemedText>
            </View>
          ) : (
            "Verify OTP"
          )}
        </Button>
      </ScreenScrollView>
    );
  }

  // Loading fallback
  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <ActivityIndicator size="large" color={KAVACHColors.primary} />
        <ThemedText style={{ marginTop: Spacing.lg }}>Loading...</ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    padding: Spacing.sm,
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
    paddingHorizontal: Spacing.lg,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: KAVACHColors.success,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    letterSpacing: 2,
  },
  otpInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 24,
  },
  errorText: {
    color: KAVACHColors.sos,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  warningCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
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
  aadhaarPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: BorderRadius.sm,
  },
  resendLink: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  benefits: {
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  benefitsTitle: {
    marginBottom: Spacing.sm,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  verifiedCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  verifiedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  maskedNumber: {
    fontSize: 16,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  uidaiBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  uidaiLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  benefitsCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  benefitsText: {
    flex: 1,
  },
  unlinkButton: {
    marginTop: Spacing.md,
  },
});
