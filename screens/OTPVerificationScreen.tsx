/**
 * OTP Verification Screen
 * Full OTP verification flow with real-time detection and fraud protection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import OTPAutoFill from '../components/OTPAutoFill';
import { useOTPDetection } from '../hooks/useOTPDetection';
import { smsMonitor } from '../services/smsMonitor';
import SMSFraudAlert from '../components/SMSFraudAlert';
import { useBiometricAnalysis, ComprehensiveAnalysisResult } from '../hooks/useBiometricAnalysis';
import { useScreenSecurity } from '../hooks/useScreenSecurity';

type OTPVerificationParams = {
  phoneNumber?: string;
  purpose?: 'login' | 'transaction' | 'registration' | 'reset';
  amount?: number;
  recipient?: string;
  onSuccess?: () => void;
};

const OTPVerificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: OTPVerificationParams }, 'params'>>();

  // Enable screen security for OTP screen
  useScreenSecurity(true);

  const {
    phoneNumber = '+91 XXXXXX1234',
    purpose = 'transaction',
    amount,
    recipient,
  } = route.params || {};

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [fraudAlertData, setFraudAlertData] = useState<any>(null);
  const [bbaRiskLevel, setBbaRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const otpInputRef = useRef<string>('');

  // BBA tracking for OTP entry
  const biometricAnalysis = useBiometricAnalysis({
    userId: 'user_otp_verification',
    screenContext: 'OTPVerification',
    autoStart: true,
    riskThreshold: 60,
    onRiskDetected: (result: ComprehensiveAnalysisResult) => {
      console.log('[OTPVerification] BBA Risk Detected:', result.riskLevel);
      setBbaRiskLevel(result.riskLevel);

      if (result.blockTransaction) {
        Alert.alert(
          'Security Alert',
          'Unusual behavior patterns detected. Please verify your identity.',
          [{ text: 'OK' }]
        );
      }
    }
  });

  const {
    isListening,
    hasPermission,
    currentOTP,
    timeRemaining,
    requestPermission,
    clearCurrentOTP,
  } = useOTPDetection({
    autoStart: true,
    showFraudWarnings: false, // We'll handle it ourselves
    onOTPDetected: (otp) => {
      console.log('OTP detected:', otp.otp);
      if (!otp.isTrusted) {
        // Show fraud warning for untrusted senders
        setFraudAlertData({
          sender: otp.sender,
          message: otp.message,
          analysis: {
            isFraud: true,
            fraudScore: 65,
            riskLevel: 'medium',
            categories: [{ name: 'unknown_sender', score: 0.6 }],
            riskFactors: [{ category: 'sender', description: 'Unknown sender ID', weight: 0.6 }],
            urlsFound: [],
            phoneNumbersFound: [],
            otpDetected: true,
            amountMentioned: otp.amount || null,
            senderTrusted: false,
            recommendation: 'Verify this OTP is from a legitimate source before using.',
          },
        });
        setShowFraudAlert(true);
      }
    },
    onFraudDetected: (otp, score) => {
      setFraudAlertData({
        sender: otp.sender,
        message: otp.message,
        analysis: {
          isFraud: true,
          fraudScore: score,
          riskLevel: score > 70 ? 'high' : 'medium',
          categories: [{ name: 'suspicious_otp', score: score / 100 }],
          riskFactors: [],
          urlsFound: [],
          phoneNumbersFound: [],
          otpDetected: true,
          amountMentioned: otp.amount || null,
          senderTrusted: false,
          recommendation: 'This OTP message appears suspicious. Do not use unless you initiated this transaction.',
        },
      });
      setShowFraudAlert(true);
    },
  });

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Track OTP input changes for BBA
  const handleOTPChange = useCallback((value: string) => {
    const isDelete = value.length < otpInputRef.current.length;
    otpInputRef.current = value;

    // Track keystroke patterns
    if (value.length > 0) {
      const lastChar = value[value.length - 1];
      biometricAnalysis.trackKeyPress(lastChar);
      setTimeout(() => biometricAnalysis.trackKeyRelease(lastChar), 80);
    }

    // Track input changes for cognitive analysis
    biometricAnalysis.recordInputChange('otp_input', value, isDelete);
  }, [biometricAnalysis]);

  // Track touch events on the screen
  const handleTouchEvent = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const pressure = (event.nativeEvent as any).force;
    biometricAnalysis.trackTouch(locationX, locationY, pressure);
  }, [biometricAnalysis]);

  const handleOTPComplete = async (otp: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    // End input tracking and get BBA analysis
    biometricAnalysis.endInputTracking('otp_input');
    const bbaResult = biometricAnalysis.performAnalysis();

    console.log('[OTPVerification] BBA Analysis on submit:', {
      riskScore: bbaResult.overallRiskScore,
      riskLevel: bbaResult.riskLevel,
      anomalies: bbaResult.allAnomalies.length
    });

    // Check if BBA indicates high risk
    if (bbaResult.blockTransaction) {
      setIsVerifying(false);
      Alert.alert(
        'Transaction Blocked',
        'Suspicious behavior detected. For your security, this transaction has been blocked. Please try again or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Simulate verification API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock verification - in real app, call your backend with BBA data
      const isValid = otp.length === 6; // Simple validation

      if (isValid) {
        // Add this session as a sample to improve BBA profile
        biometricAnalysis.addSampleToProfile();

        clearCurrentOTP();
        Alert.alert(
          'Success',
          'OTP verified successfully!',
          [
            {
              text: 'Continue',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        setVerificationError('Invalid OTP. Please try again.');
      }
    } catch (error) {
      setVerificationError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(30);
    setVerificationError(null);

    // Simulate resend API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('OTP Sent', `A new OTP has been sent to ${phoneNumber}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
      setCanResend(true);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'SMS permission is needed for automatic OTP detection. You can still enter OTP manually.',
        [{ text: 'OK' }]
      );
    }
  };

  const getPurposeText = () => {
    switch (purpose) {
      case 'login':
        return 'to log in to your account';
      case 'transaction':
        return amount
          ? `to confirm payment of ₹${amount.toLocaleString()}${recipient ? ` to ${recipient}` : ''}`
          : 'to confirm your transaction';
      case 'registration':
        return 'to complete your registration';
      case 'reset':
        return 'to reset your password';
      default:
        return 'to verify your identity';
    }
  };

  // Start input tracking when component mounts
  useEffect(() => {
    biometricAnalysis.startInputTracking('otp_input', 'otp');

    return () => {
      biometricAnalysis.endSession();
    };
  }, []);

  // Get risk indicator color
  const getRiskIndicatorColor = () => {
    switch (bbaRiskLevel) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC00';
      default: return '#34C759';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onTouchStart={handleTouchEvent}
          onTouchMove={handleTouchEvent}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verify OTP</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={48} color="#007AFF" />
            </View>
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>Verification Code</Text>
          <Text style={styles.description}>
            Enter the 6-digit OTP sent to{'\n'}
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            {'\n'}{getPurposeText()}
          </Text>

          {/* Transaction Details */}
          {purpose === 'transaction' && amount && (
            <View style={styles.transactionCard}>
              <Ionicons name="card-outline" size={24} color="#007AFF" />
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionLabel}>Transaction Amount</Text>
                <Text style={styles.transactionAmount}>₹{amount.toLocaleString()}</Text>
                {recipient && (
                  <Text style={styles.transactionRecipient}>To: {recipient}</Text>
                )}
              </View>
            </View>
          )}

          {/* Permission Request */}
          {Platform.OS === 'android' && !hasPermission && (
            <TouchableOpacity
              style={styles.permissionCard}
              onPress={handleRequestPermission}
            >
              <Ionicons name="notifications-outline" size={24} color="#FF9500" />
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Enable Auto-Detection</Text>
                <Text style={styles.permissionText}>
                  Allow SMS access for automatic OTP detection
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}

          {/* BBA Risk Indicator */}
          {bbaRiskLevel !== 'low' && (
            <View style={[styles.riskIndicator, { backgroundColor: getRiskIndicatorColor() + '20', borderColor: getRiskIndicatorColor() }]}>
              <Ionicons
                name={bbaRiskLevel === 'critical' ? 'warning' : 'shield'}
                size={18}
                color={getRiskIndicatorColor()}
              />
              <Text style={[styles.riskText, { color: getRiskIndicatorColor() }]}>
                {bbaRiskLevel === 'critical'
                  ? 'High security alert - unusual activity detected'
                  : bbaRiskLevel === 'high'
                  ? 'Security monitoring active'
                  : 'Verifying your identity patterns'}
              </Text>
            </View>
          )}

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <OTPAutoFill
              length={6}
              onOTPComplete={handleOTPComplete}
              onOTPChange={handleOTPChange}
              error={verificationError || undefined}
              label=""
              showAutoDetect={true}
              disabled={isVerifying}
            />
          </View>

          {/* Verifying Indicator */}
          {isVerifying && (
            <View style={styles.verifyingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.verifyingText}>Verifying OTP...</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.resendButton}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                Resend in {resendTimer}s
              </Text>
            )}
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.securityText}>
              Never share your OTP with anyone. Bank representatives will never ask for your OTP.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fraud Alert Modal */}
      {showFraudAlert && fraudAlertData && (
        <SMSFraudAlert
          visible={showFraudAlert}
          onClose={() => setShowFraudAlert(false)}
          smsContent={fraudAlertData.message}
          sender={fraudAlertData.sender}
          analysis={fraudAlertData.analysis}
          onReport={() => {
            smsMonitor.reportSpam(fraudAlertData.message, fraudAlertData.sender);
            setShowFraudAlert(false);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#333',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#007AFF30',
  },
  transactionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionLabel: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionRecipient: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF950030',
  },
  permissionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  permissionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  otpContainer: {
    marginBottom: 24,
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verifyingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resendButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  timerText: {
    fontSize: 14,
    color: '#999',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  securityText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  riskIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  riskText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});

export default OTPVerificationScreen;
