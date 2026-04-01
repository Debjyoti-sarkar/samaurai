/**
 * Fraud Alert Detail Screen
 *
 * Shows detailed fraud analysis when user taps notification.
 * Provides actions: Block Sender, Report Fraud, Mark as Safe, Dismiss
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  Share
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, KAVACHColors } from '@/constants/theme';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import realTimeSMSMonitor, { SMSFraudRecord, FraudAnalysis } from '@/services/RealTimeSMSMonitor';

interface FraudAlertScreenProps {
  route?: {
    params?: {
      recordId?: string;
      sms?: {
        sender: string;
        body: string;
        timestamp: number;
      };
      analysis?: FraudAnalysis;
    };
  };
  navigation?: any;
}

// Fraud indicators with icons
const FRAUD_INDICATORS = [
  { pattern: /won|winner|prize|lottery|congratulations/i, reason: 'Contains "won prize" language', icon: 'gift' },
  { pattern: /immediately|urgent|now|hurry|fast|quick/i, reason: 'Requests immediate action', icon: 'clock' },
  { pattern: /₹\s*\d+|rs\.?\s*\d+/i, reason: 'Mentions money amount', icon: 'dollar-sign' },
  { pattern: /call.*\d{10}|contact.*\d{10}/i, reason: 'Personal number (not verified)', icon: 'phone' },
  { pattern: /click|link|http|www\./i, reason: 'Contains suspicious link', icon: 'link' },
  { pattern: /otp|pin|password|cvv/i, reason: 'Asks for sensitive credentials', icon: 'lock' },
  { pattern: /kyc|verify|update.*account/i, reason: 'Fake KYC/verification request', icon: 'alert-triangle' },
  { pattern: /block|suspend|deactivate|expire/i, reason: 'Uses scare tactics', icon: 'alert-octagon' },
  { pattern: /bank|hdfc|icici|sbi|axis/i, reason: 'Impersonates bank', icon: 'credit-card' },
  { pattern: /government|income.*tax|refund/i, reason: 'Impersonates government', icon: 'shield' }
];

export default function FraudAlertScreen({ route, navigation }: FraudAlertScreenProps) {
  const { theme } = useTheme();
  const params = route?.params;

  const [record, setRecord] = useState<SMSFraudRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  // Animation values
  const alertPulse = useSharedValue(1);
  const scoreProgress = useSharedValue(0);

  useEffect(() => {
    loadRecord();
    // Pulse animation for danger indicator
    alertPulse.value = withRepeat(
      withTiming(1.1, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const loadRecord = async () => {
    setIsLoading(true);

    if (params?.recordId) {
      // Load from storage by ID
      const records = await realTimeSMSMonitor.getRecords(100);
      const found = records.find(r => r.id === params.recordId);
      if (found) {
        setRecord(found);
        animateScore(found.analysis.riskScore);
      }
    } else if (params?.sms && params?.analysis) {
      // Create temporary record from params
      const tempRecord: SMSFraudRecord = {
        id: `temp_${Date.now()}`,
        sms: {
          id: String(params.sms.timestamp),
          sender: params.sms.sender,
          body: params.sms.body,
          timestamp: params.sms.timestamp
        },
        analysis: params.analysis,
        userAction: 'pending',
        createdAt: Date.now()
      };
      setRecord(tempRecord);
      animateScore(params.analysis.riskScore);
    }

    setIsLoading(false);
  };

  const animateScore = (score: number) => {
    scoreProgress.value = withTiming(score / 100, { duration: 1500 });
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertPulse.value }]
  }));

  const scoreBarStyle = useAnimatedStyle(() => ({
    width: `${scoreProgress.value * 100}%`
  }));

  // Detect which fraud indicators match
  const getMatchingIndicators = (body: string): Array<{ reason: string; icon: string }> => {
    const matches: Array<{ reason: string; icon: string }> = [];
    for (const indicator of FRAUD_INDICATORS) {
      if (indicator.pattern.test(body)) {
        matches.push({ reason: indicator.reason, icon: indicator.icon });
      }
    }
    return matches;
  };

  // Action handlers
  const handleBlockSender = async () => {
    if (!record) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Block in our system
    await realTimeSMSMonitor.blockSender(record.sms.sender);
    await realTimeSMSMonitor.updateRecordAction(record.id, 'blocked');

    // Try to open SMS app with the sender
    const smsUrl = Platform.select({
      android: `sms:${record.sms.sender}`,
      ios: `sms:${record.sms.sender}`
    });

    Alert.alert(
      'Sender Blocked',
      `${record.sms.sender} has been blocked in KAVACH.\n\nWould you like to also block in your SMS app?`,
      [
        { text: 'No, Done', style: 'cancel', onPress: () => handleDone('blocked') },
        {
          text: 'Open SMS App',
          onPress: async () => {
            try {
              if (smsUrl) await Linking.openURL(smsUrl);
            } catch (e) {
              console.log('Could not open SMS app');
            }
            handleDone('blocked');
          }
        }
      ]
    );
  };

  const handleReportFraud = async () => {
    if (!record) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Update record
    await realTimeSMSMonitor.updateRecordAction(record.id, 'reported');

    Alert.alert(
      'Report Fraud',
      'How would you like to report this fraud?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 1930 (Cybercrime)',
          onPress: async () => {
            try {
              await Linking.openURL('tel:1930');
            } catch (e) {
              Alert.alert('Error', 'Could not open phone dialer');
            }
          }
        },
        {
          text: 'Visit Cybercrime Portal',
          onPress: async () => {
            try {
              await Linking.openURL('https://cybercrime.gov.in');
            } catch (e) {
              Alert.alert('Error', 'Could not open browser');
            }
          }
        },
        {
          text: 'Share Details',
          onPress: async () => {
            try {
              await Share.share({
                message: `FRAUD SMS REPORT\n\nFrom: ${record.sms.sender}\nMessage: ${record.sms.body}\n\nRisk Score: ${record.analysis.riskScore}%\nDetected by KAVACH`
              });
            } catch (e) {
              console.log('Share failed');
            }
            handleDone('reported');
          }
        }
      ]
    );
  };

  const handleMarkSafe = async () => {
    if (!record) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert(
      'Mark as Safe?',
      'Are you sure this message is legitimate? This helps improve our detection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, It\'s Safe',
          onPress: async () => {
            // Add sender to trusted list
            await realTimeSMSMonitor.trustSender(record.sms.sender);
            await realTimeSMSMonitor.updateRecordAction(record.id, 'dismissed');

            // Store feedback for ML improvement
            await storeFeedback(record, 'safe');

            Alert.alert(
              'Feedback Recorded',
              `${record.sms.sender} has been marked as trusted. Future messages from this sender won't be flagged.`,
              [{ text: 'OK', onPress: () => handleDone('safe') }]
            );
          }
        }
      ]
    );
  };

  const handleDismiss = async () => {
    if (!record) return;

    await realTimeSMSMonitor.updateRecordAction(record.id, 'dismissed');
    handleDone('dismissed');
  };

  const handleDone = (action: string) => {
    setActionTaken(action);
    // Navigate back or close
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  // Store feedback for ML improvement
  const storeFeedback = async (record: SMSFraudRecord, userVerdict: 'safe' | 'fraud') => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const stored = await AsyncStorage.getItem('@kavach_ml_feedback');
      const feedback = stored ? JSON.parse(stored) : [];

      feedback.push({
        messageHash: hashMessage(record.sms.body),
        sender: record.sms.sender,
        systemVerdict: record.analysis.riskLevel,
        userVerdict,
        riskScore: record.analysis.riskScore,
        timestamp: Date.now()
      });

      // Keep last 500 feedback entries
      const trimmed = feedback.slice(-500);
      await AsyncStorage.setItem('@kavach_ml_feedback', JSON.stringify(trimmed));
    } catch (e) {
      console.log('Error storing feedback:', e);
    }
  };

  // Simple hash for message deduplication
  const hashMessage = (msg: string): string => {
    let hash = 0;
    for (let i = 0; i < msg.length; i++) {
      const char = msg.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return KAVACHColors.sos;
    if (score >= 40) return KAVACHColors.warning;
    return KAVACHColors.success;
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'HIGH RISK - FRAUD';
    if (score >= 40) return 'MEDIUM RISK - SUSPICIOUS';
    return 'LOW RISK';
  };

  if (isLoading || !record) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="shield" size={48} color={KAVACHColors.primary} />
        <ThemedText type="small" style={{ marginTop: Spacing.md }}>
          Loading alert details...
        </ThemedText>
      </View>
    );
  }

  const riskScore = record.analysis.riskScore;
  const riskColor = getRiskColor(riskScore);
  const matchingIndicators = getMatchingIndicators(record.sms.body);

  return (
    <ScreenKeyboardAwareScrollView style={{ backgroundColor: theme.backgroundDefault }}>
      {/* Header with Alert Icon */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <Animated.View
          style={[
            styles.alertIconContainer,
            { backgroundColor: riskColor + '20' },
            riskScore >= 70 ? pulseStyle : undefined
          ]}
        >
          <Feather
            name={riskScore >= 70 ? 'alert-octagon' : 'alert-triangle'}
            size={64}
            color={riskColor}
          />
        </Animated.View>

        <ThemedText type="h2" style={[styles.alertTitle, { color: riskColor }]}>
          {riskScore >= 70 ? 'FRAUD DETECTED' : riskScore >= 40 ? 'SUSPICIOUS MESSAGE' : 'LOW RISK'}
        </ThemedText>

        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center' }}>
          Detected {new Date(record.createdAt).toLocaleString()}
        </ThemedText>
      </Animated.View>

      {/* Risk Score Bar */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(500)}
        style={[styles.scoreCard, { backgroundColor: theme.card }]}
      >
        <View style={styles.scoreHeader}>
          <ThemedText type="small" style={{ fontWeight: '600' }}>
            Fraud Score
          </ThemedText>
          <ThemedText type="h3" style={{ color: riskColor }}>
            {riskScore}%
          </ThemedText>
        </View>

        <View style={[styles.scoreBarContainer, { backgroundColor: theme.border }]}>
          <Animated.View
            style={[
              styles.scoreBarFill,
              { backgroundColor: riskColor },
              scoreBarStyle
            ]}
          />
        </View>

        <ThemedText type="caption" style={{ color: riskColor, fontWeight: '600', marginTop: Spacing.xs }}>
          {getRiskLabel(riskScore)}
        </ThemedText>
      </Animated.View>

      {/* Message Preview */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(500)}
        style={[styles.messageCard, { backgroundColor: theme.card, borderLeftColor: riskColor }]}
      >
        <View style={styles.senderRow}>
          <Feather name="user" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, fontWeight: '600' }}>
            {record.sms.sender}
          </ThemedText>
        </View>

        <ThemedText type="body" style={[styles.messageBody, { color: theme.text }]}>
          {record.sms.body}
        </ThemedText>
      </Animated.View>

      {/* Why is this suspicious? */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(500)}
        style={[styles.indicatorsCard, { backgroundColor: theme.card }]}
      >
        <View style={styles.indicatorsHeader}>
          <Feather name="flag" size={18} color={riskColor} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, fontWeight: '600' }}>
            Why is this suspicious?
          </ThemedText>
        </View>

        {matchingIndicators.length > 0 ? (
          matchingIndicators.map((indicator, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(450 + index * 50)}
              style={styles.indicatorItem}
            >
              <View style={[styles.indicatorIcon, { backgroundColor: riskColor + '15' }]}>
                <Feather name={indicator.icon as any} size={14} color={riskColor} />
              </View>
              <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
                {indicator.reason}
              </ThemedText>
            </Animated.View>
          ))
        ) : (
          record.analysis.reasons.map((reason, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(450 + index * 50)}
              style={styles.indicatorItem}
            >
              <View style={[styles.indicatorIcon, { backgroundColor: riskColor + '15' }]}>
                <Feather name="alert-circle" size={14} color={riskColor} />
              </View>
              <ThemedText type="small" style={{ flex: 1, color: theme.text }}>
                {reason}
              </ThemedText>
            </Animated.View>
          ))
        )}
      </Animated.View>

      {/* Additional Analysis */}
      {(record.analysis.urlsFound.length > 0 || record.analysis.otpDetected) && (
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={[styles.additionalCard, { backgroundColor: KAVACHColors.sos + '10' }]}
        >
          {record.analysis.urlsFound.length > 0 && (
            <View style={styles.additionalItem}>
              <Feather name="link" size={16} color={KAVACHColors.sos} />
              <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: KAVACHColors.sos }}>
                Contains {record.analysis.urlsFound.length} suspicious link(s) - DO NOT CLICK
              </ThemedText>
            </View>
          )}
          {record.analysis.otpDetected && (
            <View style={styles.additionalItem}>
              <Feather name="key" size={16} color={KAVACHColors.sos} />
              <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: KAVACHColors.sos }}>
                OTP/PIN request detected - NEVER SHARE
              </ThemedText>
            </View>
          )}
        </Animated.View>
      )}

      {/* Action Buttons */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(500)}
        style={styles.actionsContainer}
      >
        {/* Primary Actions */}
        <View style={styles.primaryActions}>
          <Pressable
            style={[styles.actionButton, styles.blockButton]}
            onPress={handleBlockSender}
          >
            <Feather name="slash" size={20} color="#FFFFFF" />
            <ThemedText type="small" style={styles.actionButtonText}>
              Block Sender
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.reportButton]}
            onPress={handleReportFraud}
          >
            <Feather name="flag" size={20} color="#FFFFFF" />
            <ThemedText type="small" style={styles.actionButtonText}>
              Report Fraud
            </ThemedText>
          </Pressable>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: KAVACHColors.success }]}
            onPress={handleMarkSafe}
          >
            <Feather name="check-circle" size={18} color={KAVACHColors.success} />
            <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: KAVACHColors.success }}>
              Mark as Safe
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={handleDismiss}
          >
            <Feather name="x" size={18} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
              Dismiss
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {/* Safety Tips */}
      <Animated.View
        entering={FadeInDown.delay(700).duration(500)}
        style={[styles.tipsCard, { backgroundColor: theme.backgroundSecondary }]}
      >
        <View style={styles.tipsHeader}>
          <Feather name="shield" size={16} color={KAVACHColors.primary} />
          <ThemedText type="caption" style={{ marginLeft: Spacing.sm, fontWeight: '600' }}>
            Safety Tips
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
          • Banks NEVER ask for OTP, PIN, or passwords via SMS{'\n'}
          • Don't click links in unexpected messages{'\n'}
          • Verify with official bank apps/websites{'\n'}
          • Report fraud: Call 1930 or visit cybercrime.gov.in
        </ThemedText>
      </Animated.View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg
  },
  alertIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg
  },
  alertTitle: {
    marginBottom: Spacing.xs,
    textAlign: 'center'
  },
  scoreCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  scoreBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4
  },
  messageCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    marginBottom: Spacing.lg
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  messageBody: {
    lineHeight: 22
  },
  indicatorsCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg
  },
  indicatorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm
  },
  indicatorIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm
  },
  additionalCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg
  },
  additionalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs
  },
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl
  },
  primaryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md
  },
  blockButton: {
    backgroundColor: KAVACHColors.sos
  },
  reportButton: {
    backgroundColor: KAVACHColors.warning
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.md
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1
  },
  tipsCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing['3xl']
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm
  }
});
