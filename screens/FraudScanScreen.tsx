import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";
import FraudDetectionService, { ScanResult as FraudScanResult } from "@/services/FraudDetectionService";
import SMSReaderService from "@/services/SMSReaderService";

type ScanResult = "safe" | "suspicious" | "dangerous" | null;

export default function FraudScanScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [detectedIndicators, setDetectedIndicators] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [statistics, setStatistics] = useState({
    totalScanned: 0,
    fraudDetected: 0,
    suspiciousDetected: 0,
  });

  const scanProgress = useSharedValue(0);
  const resultScale = useSharedValue(0);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    const stats = await FraudDetectionService.getFraudStatistics();
    setStatistics(stats);
  };

  const scanAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanProgress.value * 360}deg` }],
  }));

  const resultAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resultScale.value }],
    opacity: resultScale.value,
  }));

  const handleScanSMS = async () => {
    try {
      const hasPermission = await SMSReaderService.requestPermissions();
      
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'SMS reading permission is required to scan messages. Please grant permission in settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsScanning(true);
      scanProgress.value = withRepeat(withTiming(1, { duration: 1000 }), -1, false);

      const smsMessages = await SMSReaderService.getRecentSMS(50);
      
      if (smsMessages.length === 0) {
        Alert.alert('No Messages', 'No banking-related SMS messages found.');
        setIsScanning(false);
        scanProgress.value = 0;
        return;
      }

      let fraudCount = 0;
      let suspiciousCount = 0;

      for (const msg of smsMessages) {
        const analysis = await FraudDetectionService.analyzeSMS(msg.body, msg.address);
        await FraudDetectionService.updateStatistics(analysis.category);
        
        if (analysis.category === 'fraud') fraudCount++;
        if (analysis.category === 'suspicious') suspiciousCount++;
      }

      await loadStatistics();
      setIsScanning(false);
      scanProgress.value = 0;

      Alert.alert(
        'Scan Complete',
        `Scanned ${smsMessages.length} messages\n🚨 Fraud: ${fraudCount}\n⚠️ Suspicious: ${suspiciousCount}\n✅ Safe: ${smsMessages.length - fraudCount - suspiciousCount}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('SMS scan error:', error);
      Alert.alert('Error', 'Failed to scan SMS messages. Please try again.');
      setIsScanning(false);
      scanProgress.value = 0;
    }
  };

  const handleScan = async () => {
    if (!message.trim()) return;

    setIsScanning(true);
    setResult(null);
    resultScale.value = 0;

    scanProgress.value = withRepeat(withTiming(1, { duration: 1000 }), 3, false);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const analysis: FraudScanResult = await FraudDetectionService.analyzeSMS(
        message,
        sender || 'Manual Entry'
      );
      
      await FraudDetectionService.updateStatistics(analysis.category);
      await loadStatistics();

      let resultType: ScanResult;
      if (analysis.category === 'fraud') {
        resultType = 'dangerous';
      } else if (analysis.category === 'suspicious') {
        resultType = 'suspicious';
      } else {
        resultType = 'safe';
      }

      setResult(resultType);
      setDetectedIndicators(analysis.reasons);
      setRecommendations(analysis.recommendations);
      setConfidence(analysis.confidence);
      setIsScanning(false);

      resultScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Error', 'Failed to analyze message');
      setIsScanning(false);
    }
  };

  const handleClear = () => {
    setMessage("");
    setSender("");
    setResult(null);
    setDetectedIndicators([]);
    setRecommendations([]);
    setConfidence(0);
    resultScale.value = 0;
  };

  const getResultColor = () => {
    switch (result) {
      case "safe":
        return KAVACHColors.success;
      case "suspicious":
        return KAVACHColors.warning;
      case "dangerous":
        return KAVACHColors.sos;
      default:
        return theme.textSecondary;
    }
  };

  const getResultIcon = (): keyof typeof Feather.glyphMap => {
    switch (result) {
      case "safe":
        return "check-circle";
      case "suspicious":
        return "alert-triangle";
      case "dangerous":
        return "alert-octagon";
      default:
        return "help-circle";
    }
  };

  const getResultMessage = () => {
    switch (result) {
      case "safe":
        return "This message appears to be safe. No fraud indicators detected.";
      case "suspicious":
        return "This message contains suspicious content. Be cautious before responding.";
      case "dangerous":
        return "Warning! This message shows multiple fraud indicators. Do not respond or click any links.";
      default:
        return "";
    }
  };

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.success + "15" }]}>
          <Feather name="shield" size={48} color={KAVACHColors.success} />
        </View>
        <ThemedText type="h3" style={styles.title}>
          {t("scanForFraud")}
        </ThemedText>
        <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
          Scan SMS or paste suspicious messages to check for fraud
        </ThemedText>
      </View>

      {/* Statistics Card */}
      <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
          Detection Statistics
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h4" style={{ color: KAVACHColors.primary }}>
              {statistics.totalScanned}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Scanned
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h4" style={{ color: KAVACHColors.sos }}>
              {statistics.fraudDetected}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Fraud
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h4" style={{ color: KAVACHColors.warning }}>
              {statistics.suspiciousDetected}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Suspicious
            </ThemedText>
          </View>
        </View>
      </View>

      {/* SMS Scan Button */}
      <Button
        onPress={handleScanSMS}
        disabled={isScanning}
        style={{ backgroundColor: KAVACHColors.primary, marginBottom: Spacing.lg }}
      >
        <Feather name="mail" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
        {isScanning ? "Scanning SMS..." : "Scan All SMS Messages"}
      </Button>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText type="caption" style={[styles.dividerText, { color: theme.textSecondary }]}>
          OR MANUAL ENTRY
        </ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <View style={styles.inputSection}>
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          Sender (Optional)
        </ThemedText>
        <TextInput
          style={[
            styles.senderInput,
            { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="e.g., VM-HDFC or +919876543210"
          placeholderTextColor={theme.textSecondary}
          value={sender}
          onChangeText={setSender}
        />
      </View>

      <View style={styles.inputSection}>
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          Message to analyze
        </ThemedText>
        <TextInput
          style={[
            styles.messageInput,
            { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Paste the message here..."
          placeholderTextColor={theme.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          onPress={handleScan}
          disabled={!message.trim() || isScanning}
          style={{ backgroundColor: KAVACHColors.primary, flex: 1 }}
        >
          {isScanning ? "Scanning..." : "Scan for Fraud"}
        </Button>
        {message ? (
          <Pressable
            onPress={handleClear}
            style={[styles.clearButton, { borderColor: theme.border }]}
          >
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {isScanning ? (
        <View style={styles.scanningContainer}>
          <Animated.View style={scanAnimatedStyle}>
            <Feather name="loader" size={48} color={KAVACHColors.primary} />
          </Animated.View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
            Analyzing message patterns...
          </ThemedText>
        </View>
      ) : null}

      {result ? (
        <Animated.View style={[styles.resultContainer, resultAnimatedStyle]}>
          <View
            style={[
              styles.resultCard,
              { backgroundColor: getResultColor() + "15", borderColor: getResultColor() },
            ]}
          >
            <View style={[styles.resultIconCircle, { backgroundColor: getResultColor() }]}>
              <Feather name={getResultIcon()} size={32} color="#FFFFFF" />
            </View>
            <ThemedText type="h4" style={{ color: getResultColor(), marginBottom: Spacing.sm }}>
              {result === "safe" ? "Safe" : result === "suspicious" ? "Suspicious" : "Dangerous"}
            </ThemedText>
            <ThemedText type="small" style={[styles.confidenceBadge, { color: getResultColor() }]}>
              {confidence.toFixed(0)}% Confidence
            </ThemedText>
            <ThemedText type="small" style={[styles.resultMessage, { color: theme.text }]}>
              {getResultMessage()}
            </ThemedText>

            {detectedIndicators.length > 0 ? (
              <View style={styles.indicatorsContainer}>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm, fontWeight: "600" }}>
                  Detected indicators:
                </ThemedText>
                {detectedIndicators.map((indicator, index) => (
                  <View key={index} style={styles.indicatorTag}>
                    <Feather name="alert-circle" size={12} color={getResultColor()} />
                    <ThemedText type="caption" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                      {indicator}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {recommendations.length > 0 ? (
              <View style={styles.recommendationsContainer}>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm, fontWeight: "600" }}>
                  Recommendations:
                </ThemedText>
                {recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationTag}>
                    <Feather name="shield" size={12} color={KAVACHColors.success} />
                    <ThemedText type="caption" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                      {rec}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <View style={[styles.tipsCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
          Tips to stay safe:
        </ThemedText>
        <View style={styles.tipItem}>
          <Feather name="check" size={16} color={KAVACHColors.success} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>
            Never share OTP or PIN with anyone
          </ThemedText>
        </View>
        <View style={styles.tipItem}>
          <Feather name="check" size={16} color={KAVACHColors.success} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>
            Banks never ask for personal details via SMS
          </ThemedText>
        </View>
        <View style={styles.tipItem}>
          <Feather name="check" size={16} color={KAVACHColors.success} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>
            Verify sender before clicking any links
          </ThemedText>
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: 11,
    fontWeight: "600",
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 11,
  },
  senderInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  messageInput: {
    minHeight: 150,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  clearButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanningContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  resultContainer: {
    marginBottom: Spacing.xl,
  },
  resultCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: "center",
  },
  resultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  confidenceBadge: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  resultMessage: {
    textAlign: "center",
  },
  indicatorsContainer: {
    marginTop: Spacing.lg,
    width: "100%",
  },
  indicatorTag: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  recommendationsContainer: {
    marginTop: Spacing.lg,
    width: "100%",
  },
  recommendationTag: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tipsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
});