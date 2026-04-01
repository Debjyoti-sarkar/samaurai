/**
 * SMS Fraud Alert Component
 * Displays popup when suspicious SMS is detected
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Linking,
  Vibration,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { smsMonitor, SMSAnalysisResult } from '../services/smsMonitor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SMSFraudAlertProps {
  visible: boolean;
  onClose: () => void;
  smsContent: string;
  sender: string;
  analysis: SMSAnalysisResult['analysis'];
  alertId?: string;
  onReport?: () => void;
  onBlockSender?: () => void;
}

const SMSFraudAlert: React.FC<SMSFraudAlertProps> = ({
  visible,
  onClose,
  smsContent,
  sender,
  analysis,
  alertId,
  onReport,
  onBlockSender,
}) => {
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Vibrate on critical/high risk
      if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
        Vibration.vibrate([100, 200, 100, 200, 100]);
      }

      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Shake animation for critical alerts
      if (analysis.riskLevel === 'critical') {
        shakeAnimation();
      }
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const getRiskColor = () => {
    switch (analysis.riskLevel) {
      case 'critical':
        return '#FF3B30';
      case 'high':
        return '#FF9500';
      case 'medium':
        return '#FFCC00';
      default:
        return '#34C759';
    }
  };

  const getRiskIcon = () => {
    switch (analysis.riskLevel) {
      case 'critical':
        return 'skull-outline';
      case 'high':
        return 'warning-outline';
      case 'medium':
        return 'alert-circle-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getRiskTitle = () => {
    switch (analysis.riskLevel) {
      case 'critical':
        return 'SCAM ALERT!';
      case 'high':
        return 'FRAUD WARNING';
      case 'medium':
        return 'SUSPICIOUS MESSAGE';
      default:
        return 'CAUTION';
    }
  };

  const handleDismiss = async () => {
    if (alertId) {
      await smsMonitor.updateAlertAction(alertId, 'dismissed');
    }
    setActionTaken('dismissed');
    onClose();
  };

  const handleReport = async () => {
    if (alertId) {
      await smsMonitor.updateAlertAction(alertId, 'reported');
    }
    setActionTaken('reported');
    onReport?.();
    onClose();
  };

  const handleBlockSender = async () => {
    if (alertId) {
      await smsMonitor.updateAlertAction(alertId, 'blocked_sender');
    }
    setActionTaken('blocked');
    onBlockSender?.();
    onClose();
  };

  const formatCategory = (category: string) => {
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                { translateX: slideAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: getRiskColor() }]}>
            <Ionicons name={getRiskIcon()} size={48} color="#fff" />
            <Text style={styles.headerTitle}>{getRiskTitle()}</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>
                Risk Score: {Math.round(analysis.fraudScore)}%
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Sender Info */}
            <View style={styles.senderContainer}>
              <Ionicons name="person-circle-outline" size={24} color="#666" />
              <View style={styles.senderInfo}>
                <Text style={styles.senderLabel}>From</Text>
                <Text style={styles.senderValue}>{sender || 'Unknown'}</Text>
              </View>
              {analysis.senderTrusted && (
                <View style={styles.trustedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.trustedText}>Trusted</Text>
                </View>
              )}
            </View>

            {/* Message Content */}
            <View style={styles.messageContainer}>
              <Text style={styles.messageLabel}>Message</Text>
              <TouchableOpacity onPress={() => setShowFullMessage(!showFullMessage)}>
                <Text
                  style={styles.messageText}
                  numberOfLines={showFullMessage ? undefined : 4}
                >
                  {smsContent}
                </Text>
                {smsContent.length > 150 && (
                  <Text style={styles.showMoreText}>
                    {showFullMessage ? 'Show Less' : 'Show More'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Warning Box */}
            <View style={[styles.warningBox, { borderColor: getRiskColor() }]}>
              <Ionicons name="shield-outline" size={20} color={getRiskColor()} />
              <Text style={styles.warningText}>{analysis.recommendation}</Text>
            </View>

            {/* Detected Issues */}
            <View style={styles.issuesContainer}>
              <Text style={styles.sectionTitle}>Detected Issues</Text>

              {/* Categories */}
              {analysis.categories.length > 0 && (
                <View style={styles.categoriesRow}>
                  {analysis.categories.slice(0, 3).map((cat, index) => (
                    <View
                      key={index}
                      style={[styles.categoryBadge, { backgroundColor: getRiskColor() + '20' }]}
                    >
                      <Text style={[styles.categoryText, { color: getRiskColor() }]}>
                        {formatCategory(cat.name)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Risk Factors */}
              {analysis.riskFactors.slice(0, 4).map((factor, index) => (
                <View key={index} style={styles.factorItem}>
                  <Ionicons name="alert-circle" size={16} color={getRiskColor()} />
                  <Text style={styles.factorText}>{factor.description}</Text>
                </View>
              ))}

              {/* OTP Warning */}
              {analysis.otpDetected && (
                <View style={styles.otpWarning}>
                  <Ionicons name="key-outline" size={20} color="#FF3B30" />
                  <Text style={styles.otpWarningText}>
                    OTP/PIN detected! Never share your OTP with anyone.
                  </Text>
                </View>
              )}

              {/* URLs Found */}
              {analysis.urlsFound.length > 0 && (
                <View style={styles.urlWarning}>
                  <Ionicons name="link-outline" size={20} color="#FF9500" />
                  <Text style={styles.urlWarningText}>
                    {analysis.urlsFound.length} suspicious link(s) detected. Do NOT click!
                  </Text>
                </View>
              )}

              {/* Amount Mentioned */}
              {analysis.amountMentioned && (
                <View style={styles.amountInfo}>
                  <Ionicons name="cash-outline" size={20} color="#666" />
                  <Text style={styles.amountText}>
                    Amount mentioned: ₹{parseInt(analysis.amountMentioned).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Safety Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.sectionTitle}>Safety Tips</Text>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.tipText}>
                  Banks never ask for OTP, PIN, or passwords via SMS
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.tipText}>
                  Never click on links in suspicious messages
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.tipText}>
                  Verify directly with your bank using official contact
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.reportButton]}
              onPress={handleReport}
            >
              <Ionicons name="flag-outline" size={20} color="#FF3B30" />
              <Text style={styles.reportButtonText}>Report Fraud</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.blockButton]}
              onPress={handleBlockSender}
            >
              <Ionicons name="ban-outline" size={20} color="#FF9500" />
              <Text style={styles.blockButtonText}>Block Sender</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dismissButton]}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Simplified Toast-style Alert for non-critical messages
export const SMSFraudToast: React.FC<{
  visible: boolean;
  onClose: () => void;
  sender: string;
  riskLevel: string;
  fraudScore: number;
  onViewDetails: () => void;
}> = ({ visible, onClose, sender, riskLevel, fraudScore, onViewDetails }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 5 seconds
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onClose());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const getToastColor = () => {
    switch (riskLevel) {
      case 'high':
        return '#FF9500';
      case 'medium':
        return '#FFCC00';
      default:
        return '#666';
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[styles.toastBorder, { backgroundColor: getToastColor() }]} />
      <View style={styles.toastContent}>
        <Ionicons name="alert-circle" size={24} color={getToastColor()} />
        <View style={styles.toastText}>
          <Text style={styles.toastTitle}>Suspicious SMS Detected</Text>
          <Text style={styles.toastSubtitle}>
            From: {sender} • Risk: {fraudScore}%
          </Text>
        </View>
        <TouchableOpacity onPress={onViewDetails} style={styles.toastButton}>
          <Text style={styles.toastButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  scoreBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  scoreText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  senderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  senderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  senderLabel: {
    fontSize: 12,
    color: '#999',
  },
  senderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  trustedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75920',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trustedText: {
    color: '#34C759',
    fontSize: 12,
    marginLeft: 4,
  },
  messageContainer: {
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  showMoreText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  issuesContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  factorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
  },
  otpWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B3015',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  otpWarningText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  urlWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950015',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  urlWarningText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#FF9500',
  },
  amountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  amountText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
  },
  tipsContainer: {
    backgroundColor: '#34C75910',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#FF3B3015',
  },
  reportButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 6,
  },
  blockButton: {
    flex: 1,
    backgroundColor: '#FF950015',
  },
  blockButtonText: {
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 6,
  },
  dismissButton: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    marginTop: 4,
  },
  dismissButtonText: {
    color: '#666',
    fontWeight: '500',
  },

  // Toast styles
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  toastBorder: {
    height: 4,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  toastText: {
    flex: 1,
    marginLeft: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toastSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  toastButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
  },
  toastButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SMSFraudAlert;
