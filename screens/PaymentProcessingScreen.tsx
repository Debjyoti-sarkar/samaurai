import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Linking,
  GestureResponderEvent,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  KAVACHColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";
import {
  PaymentResult,
  buildUpiPaymentUrl,
  isValidUpiId,
  triggerDemoPaymentConfirmation,
  verifyPaymentStatus,
} from "@/services/paymentGateway";
import {
  useBiometricAnalysis,
  ComprehensiveAnalysisResult,
} from "@/hooks/useBiometricAnalysis";
import { behaviorAnalysis } from "@/services/behaviorAnalysis";
import { useScreenSecurity } from "@/hooks/useScreenSecurity";
import {
  authenticateHighValueTransaction,
  FACE_AUTH_THRESHOLD,
  requiresFaceAuth,
} from "@/utils/securityUtils";

type PaymentStage = "select" | "waiting" | "complete" | "blocked";
const SHOW_PAYMENT_DEMO_CONTROLS =
  __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PAYMENT_DEMO === "true";

export default function PaymentProcessingScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "PaymentProcessing">>();
  const { paymentOrder } = route.params;

  useScreenSecurity(true);

  const [stage, setStage] = useState<PaymentStage>("select");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null,
  );
  const [bbaRiskLevel, setBbaRiskLevel] = useState<
    "low" | "medium" | "high" | "critical"
  >("low");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [faceAuthCompleted, setFaceAuthCompleted] = useState(false);
  const [isLaunchingUpi, setIsLaunchingUpi] = useState(false);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [isDemoUpdating, setIsDemoUpdating] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Waiting for confirmation from the backend...",
  );

  const needsFaceAuth = requiresFaceAuth(paymentOrder.amount);
  const pulseScale = useSharedValue(1);

  const biometricAnalysis = useBiometricAnalysis({
    userId: "payment_user",
    screenContext: "PaymentProcessing",
    autoStart: true,
    riskThreshold: 50,
    onRiskDetected: (result: ComprehensiveAnalysisResult) => {
      setBbaRiskLevel(result.riskLevel);

      if (result.blockTransaction) {
        setStage("blocked");
        Alert.alert(
          "Transaction Blocked",
          "Suspicious activity patterns were detected. This transaction has been blocked for safety.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      }
    },
  });

  const handleTouchEvent = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      const pressure = (event.nativeEvent as any).force;
      biometricAnalysis.trackTouch(locationX, locationY, pressure);
    },
    [biometricAnalysis],
  );

  const trackAction = useCallback(
    (action: string) => {
      biometricAnalysis.trackAction(action);
      behaviorAnalysis.recordAction();
    },
    [biometricAnalysis],
  );

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withSpring(1.08, { damping: 2 }),
        withSpring(1, { damping: 2 }),
      ),
      -1,
      false,
    );
  }, [pulseScale]);

  useEffect(() => {
    return () => {
      biometricAnalysis.endSession();
    };
  }, [biometricAnalysis]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const runPaymentSecurityChecks = useCallback(async () => {
    if (needsFaceAuth && !faceAuthCompleted) {
      setIsAuthenticating(true);
      const authResult = await authenticateHighValueTransaction(
        paymentOrder.amount,
        paymentOrder.recipient,
      );
      setIsAuthenticating(false);

      if (!authResult.success && !authResult.skipped) {
        Alert.alert(
          "Authentication Required",
          authResult.error ||
            `Face authentication is required for transactions above Rs ${FACE_AUTH_THRESHOLD.toLocaleString(
              "en-IN",
            )}`,
          [{ text: "OK" }],
        );
        return false;
      }

      setFaceAuthCompleted(true);
    }

    const analysis = biometricAnalysis.performAnalysis();
    if (analysis.blockTransaction) {
      Alert.alert(
        "Transaction Blocked",
        "Suspicious behavior detected. This transaction cannot proceed.",
        [{ text: "OK" }],
      );
      return false;
    }

    return true;
  }, [
    biometricAnalysis,
    faceAuthCompleted,
    needsFaceAuth,
    paymentOrder.amount,
    paymentOrder.recipient,
  ]);

  const pollPaymentStatus = useCallback(async () => {
    if (isPollingStatus) return;

    trackAction("poll_payment_status");
    setIsPollingStatus(true);

    try {
      const result = await verifyPaymentStatus(paymentOrder.orderId);
      setLastCheckedAt(new Date().toISOString());

      if (result.status === "SUCCESS") {
        biometricAnalysis.addSampleToProfile();
        setPaymentResult(result);
        setStage("complete");
        return;
      }

      if (result.status === "FAILED") {
        setPaymentResult(result);
        setStage("complete");
        return;
      }

      setStatusMessage("Waiting for confirmation from the backend...");
    } catch (error) {
      console.error("Polling payment status failed:", error);
      setStatusMessage(
        "We could not reach the backend. Retrying automatically every 3 seconds.",
      );
    } finally {
      setIsPollingStatus(false);
    }
  }, [biometricAnalysis, isPollingStatus, paymentOrder.orderId, trackAction]);

  useEffect(() => {
    if (stage !== "waiting") return;

    pollPaymentStatus();
    const timer = setInterval(() => {
      pollPaymentStatus();
    }, 3000);

    return () => clearInterval(timer);
  }, [pollPaymentStatus, stage]);

  const openPaymentInUpiApp = async () => {
    trackAction("open_payment_upi_app");

    if (!isValidUpiId(paymentOrder.recipient)) {
      Alert.alert(
        "Invalid UPI ID",
        "Enter a valid UPI ID like name@bank before starting a real payment.",
      );
      return;
    }

    const canProceed = await runPaymentSecurityChecks();
    if (!canProceed) return;

    setIsLaunchingUpi(true);

    try {
      const upiUrl = buildUpiPaymentUrl(paymentOrder);
      const supported = await Linking.canOpenURL(upiUrl);

      if (!supported) {
        Alert.alert(
          "No UPI App Found",
          "Install a UPI app such as Google Pay, PhonePe, Paytm, or BHIM on this device.",
        );
        return;
      }

      await Linking.openURL(upiUrl);
      setStatusMessage("Waiting for confirmation...");
      setStage("waiting");
    } catch (error) {
      console.error("Failed to open UPI app:", error);
      Alert.alert(
        "Could Not Open UPI App",
        "The payment request could not be opened. Please try again.",
      );
    } finally {
      setIsLaunchingUpi(false);
    }
  };

  const handleDemoConfirmation = async (status: "SUCCESS" | "FAILED") => {
    setIsDemoUpdating(true);

    try {
      await triggerDemoPaymentConfirmation(paymentOrder.orderId, status);
      await pollPaymentStatus();
    } catch (error) {
      console.error("Demo payment confirmation failed:", error);
      Alert.alert(
        "Demo Update Failed",
        "The backend demo confirmation request could not be completed.",
      );
    } finally {
      setIsDemoUpdating(false);
    }
  };

  const handleDone = () => {
    if (paymentResult?.success) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Dashboard" }],
      });
      return;
    }

    navigation.goBack();
  };

  const getRiskIndicatorColor = () => {
    switch (bbaRiskLevel) {
      case "critical":
        return "#FF3B30";
      case "high":
        return "#FF9500";
      case "medium":
        return "#FFCC00";
      default:
        return "#34C759";
    }
  };

  if (stage === "complete" && paymentResult) {
    const badgeBg = paymentResult.success
      ? KAVACHColors.success + "20"
      : KAVACHColors.sos + "20";
    const badgeColor = paymentResult.success
      ? KAVACHColors.success
      : KAVACHColors.sos;

    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[styles.resultIcon, pulseStyle]}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: paymentResult.success
                    ? KAVACHColors.success + "20"
                    : KAVACHColors.sos + "20",
                },
              ]}
            >
              <Feather
                name={paymentResult.success ? "check-circle" : "x-circle"}
                size={80}
                color={
                  paymentResult.success
                    ? KAVACHColors.success
                    : KAVACHColors.sos
                }
              />
            </View>
          </Animated.View>

          <ThemedText type="h2" style={styles.resultTitle}>
            {paymentResult.success ? "Payment Successful!" : "Payment Failed"}
          </ThemedText>

          <View
            style={[
              styles.detailsCard,
              { backgroundColor: theme.card },
              Shadows.md,
            ]}
          >
            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Amount
              </ThemedText>
              <ThemedText type="h3" style={{ color: KAVACHColors.primary }}>
                Rs {paymentResult.amount.toLocaleString("en-IN")}
              </ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Recipient
              </ThemedText>
              <ThemedText>{paymentResult.recipient}</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Reference ID
              </ThemedText>
              <ThemedText style={styles.referenceId}>
                {paymentResult.referenceId}
              </ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Order ID
              </ThemedText>
              <ThemedText type="small">{paymentResult.orderId}</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Status
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                <ThemedText style={{ color: badgeColor, fontWeight: "600" }}>
                  {paymentResult.status}
                </ThemedText>
              </View>
            </View>

            {paymentResult.failureReason ? (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Reason
                  </ThemedText>
                  <ThemedText type="small" style={{ color: KAVACHColors.sos }}>
                    {paymentResult.failureReason}
                  </ThemedText>
                </View>
              </>
            ) : null}
          </View>

          <Button
            onPress={handleDone}
            style={{
              backgroundColor: KAVACHColors.primary,
              marginTop: Spacing.xl,
            }}
          >
            {paymentResult.success ? "Done" : "Try Again"}
          </Button>
        </ScrollView>
      </ThemedView>
    );
  }

  if (stage === "waiting") {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <Animated.View style={pulseStyle}>
            <ActivityIndicator size="large" color={KAVACHColors.primary} />
          </Animated.View>
          <ThemedText type="h3" style={styles.processingText}>
            Waiting for confirmation...
          </ThemedText>
          <ThemedText type="small" style={styles.centerSubtext}>
            {statusMessage}
          </ThemedText>

          <View
            style={[
              styles.detailsCard,
              { backgroundColor: theme.card, marginTop: Spacing.xl },
              Shadows.md,
            ]}
          >
            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Order ID
              </ThemedText>
              <ThemedText type="small">{paymentOrder.orderId}</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Recipient
              </ThemedText>
              <ThemedText>{paymentOrder.recipient}</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Last Checked
              </ThemedText>
              <ThemedText type="small">
                {lastCheckedAt
                  ? new Date(lastCheckedAt).toLocaleTimeString("en-IN")
                  : "Checking..."}
              </ThemedText>
            </View>
          </View>

          <View style={styles.waitingButtons}>
            <Button
              onPress={pollPaymentStatus}
              disabled={isPollingStatus || isDemoUpdating}
              style={{ backgroundColor: KAVACHColors.primary, flex: 1 }}
            >
              {isPollingStatus ? "Checking..." : "Check Again"}
            </Button>

            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.cancelButton, { borderColor: theme.border }]}
            >
              <ThemedText>Cancel</ThemedText>
            </Pressable>
          </View>

          {SHOW_PAYMENT_DEMO_CONTROLS ? (
            <View style={styles.demoButtons}>
              <Button
                onPress={() => handleDemoConfirmation("SUCCESS")}
                disabled={isDemoUpdating || isPollingStatus}
                style={{ backgroundColor: KAVACHColors.success, flex: 1 }}
              >
                Demo Success
              </Button>
              <Button
                onPress={() => handleDemoConfirmation("FAILED")}
                disabled={isDemoUpdating || isPollingStatus}
                style={{ backgroundColor: KAVACHColors.sos, flex: 1 }}
              >
                Demo Fail
              </Button>
            </View>
          ) : null}
        </View>
      </ThemedView>
    );
  }

  if (stage === "blocked") {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: KAVACHColors.sos + "20" },
            ]}
          >
            <Feather name="shield-off" size={80} color={KAVACHColors.sos} />
          </View>
          <ThemedText
            type="h2"
            style={[styles.resultTitle, { color: KAVACHColors.sos }]}
          >
            Transaction Blocked
          </ThemedText>
          <ThemedText type="small" style={styles.centerSubtext}>
            Suspicious activity patterns were detected. This payment has been
            blocked.
          </ThemedText>
          <Button
            onPress={() => navigation.goBack()}
            style={{ backgroundColor: KAVACHColors.sos }}
          >
            Go Back
          </Button>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onTouchStart={handleTouchEvent}
        onTouchMove={handleTouchEvent}
      >
        <ThemedText type="h2" style={styles.title}>
          Complete Payment
        </ThemedText>

        {needsFaceAuth && !faceAuthCompleted ? (
          <View
            style={[
              styles.bbaIndicator,
              { backgroundColor: "#FFF3E0", borderColor: "#FF9800" },
            ]}
          >
            <Feather name="shield" size={18} color="#FF9800" />
            <View style={styles.indicatorContent}>
              <ThemedText style={styles.indicatorTitle}>
                Face Authentication Required
              </ThemedText>
              <ThemedText type="caption" style={{ color: "#F57C00" }}>
                Transactions above Rs{" "}
                {FACE_AUTH_THRESHOLD.toLocaleString("en-IN")} require identity
                verification.
              </ThemedText>
            </View>
          </View>
        ) : null}

        {needsFaceAuth && faceAuthCompleted ? (
          <View
            style={[
              styles.bbaIndicator,
              { backgroundColor: "#E8F5E9", borderColor: "#4CAF50" },
            ]}
          >
            <Feather name="check-circle" size={18} color="#4CAF50" />
            <ThemedText
              style={{
                marginLeft: Spacing.sm,
                color: "#2E7D32",
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              Identity verified successfully
            </ThemedText>
          </View>
        ) : null}

        {isAuthenticating ? (
          <View
            style={[
              styles.bbaIndicator,
              { backgroundColor: "#E3F2FD", borderColor: "#2196F3" },
            ]}
          >
            <ActivityIndicator size="small" color="#2196F3" />
            <ThemedText
              style={{ marginLeft: Spacing.sm, color: "#1565C0", fontSize: 13 }}
            >
              Verifying your identity...
            </ThemedText>
          </View>
        ) : null}

        {bbaRiskLevel !== "low" ? (
          <View
            style={[
              styles.bbaIndicator,
              {
                backgroundColor: getRiskIndicatorColor() + "15",
                borderColor: getRiskIndicatorColor(),
              },
            ]}
          >
            <Feather
              name={bbaRiskLevel === "critical" ? "alert-triangle" : "shield"}
              size={18}
              color={getRiskIndicatorColor()}
            />
            <ThemedText
              style={[
                styles.bbaIndicatorText,
                { color: getRiskIndicatorColor() },
              ]}
            >
              {bbaRiskLevel === "critical"
                ? "Security alert: unusual patterns detected"
                : bbaRiskLevel === "high"
                  ? "Enhanced security monitoring is active"
                  : "Verifying transaction behavior"}
            </ThemedText>
          </View>
        ) : null}

        <View
          style={[
            styles.amountCard,
            { backgroundColor: KAVACHColors.primary + "15" },
          ]}
        >
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Amount to Pay
          </ThemedText>
          <ThemedText type="h1" style={{ color: KAVACHColors.primary }}>
            Rs {paymentOrder.amount.toFixed(2)}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
          >
            To: {paymentOrder.recipient}
          </ThemedText>
        </View>

        <View
          style={[
            styles.detailsCard,
            { backgroundColor: theme.card, marginBottom: Spacing.xl },
            Shadows.md,
          ]}
        >
          <View style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Backend Order
            </ThemedText>
            <ThemedText type="small">{paymentOrder.orderId}</ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Status Source
            </ThemedText>
            <ThemedText type="small">Backend-confirmed</ThemedText>
          </View>
        </View>

        <Pressable
          style={[
            styles.upiAppOption,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: KAVACHColors.primary,
            },
          ]}
          onPress={openPaymentInUpiApp}
          disabled={isLaunchingUpi}
        >
          <View
            style={[
              styles.upiAppIcon,
              { backgroundColor: KAVACHColors.primary + "20" },
            ]}
          >
            <Feather name="smartphone" size={24} color={KAVACHColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.upiAppName}>Open UPI App</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Start payment in your installed UPI app, then wait here for
              backend confirmation.
            </ThemedText>
          </View>
          <Feather
            name="external-link"
            size={20}
            color={KAVACHColors.primary}
          />
        </Pressable>

        <ThemedText type="small" style={styles.centerSubtext}>
          This screen will not mark success locally. It waits for the backend
          payment status endpoint to confirm the final result.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  centerSubtext: {
    color: "#6B7280",
    textAlign: "center",
  },
  title: {
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  amountCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  upiAppOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  upiAppIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderRadius: 12,
  },
  upiAppName: {
    fontSize: 16,
    fontWeight: "500",
  },
  detailsCard: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.md,
  },
  resultIcon: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  referenceId: {
    fontWeight: "600",
    fontFamily: "monospace",
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  processingText: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  waitingButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
    marginTop: Spacing.xl,
  },
  demoButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  bbaIndicator: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  indicatorContent: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  indicatorTitle: {
    fontWeight: "600",
    color: "#E65100",
    fontSize: 13,
  },
  bbaIndicatorText: {
    marginLeft: Spacing.sm,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
});
