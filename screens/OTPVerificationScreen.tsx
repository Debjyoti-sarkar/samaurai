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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import OTPAutoFill from '../components/OTPAutoFill';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { useOTPDetection } from '../hooks/useOTPDetection';
import { smsMonitor } from '../services/smsMonitor';
import SMSFraudAlert from '../components/SMSFraudAlert';
import { useBiometricAnalysis, ComprehensiveAnalysisResult } from '../hooks/useBiometricAnalysis';
import { useScreenSecurity } from '../hooks/useScreenSecurity';
import { apiService } from '../services/apiService';

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

  useScreenSecurity(true);

  const {
    phoneNumber = '+91 XXXXXX1234',
    purpose = 'transaction',
    amount,
    recipient,
  } = route.params || {};

  const [otpSentPhone, setOtpSentPhone] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [fraudAlertData, setFraudAlertData] = useState<any>(null);
  const [bbaRiskLevel, setBbaRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');

  const otpInputRef = useRef<string>('');

  // MSG91 Widget configuration setup
  const widgetId = '366275687750353332343437';
  const authToken = process.env.EXPO_PUBLIC_MSG91_AUTH_TOKEN || '495595A0sG4XmEvW69c98f3aP1';
  // Note: Place the real authToken inside your root .env file as EXPO_PUBLIC_MSG91_AUTH_TOKEN.

  useEffect(() => {
    try {
      OTPWidget.initializeWidget(widgetId, authToken); 
    } catch (err) {
      console.log('MSG91 OTPWidget init failed:', err);
    }
  }, []);

  // ===== SEND REAL OTP =====
  useEffect(() => {
    sendRealOTP();
  }, []);

  const sendRealOTP = async () => {
    try {
      // Extract 10 digits without country code or + padding if needed or send directly 
      const rawNumber = phoneNumber.replace(/[^0-9]/g, '');
      const validIdentifier = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;

      const data = {
        identifier: validIdentifier
      };

      // Trigger the official MSG91 OTP Widget!
      const response = await OTPWidget.sendOTP(data);
      console.log('MSG91 OTPWidget response:', response);

      if (response && response.type === 'success') {
        setOtpSentPhone(validIdentifier);
        Alert.alert('OTP Sent', `OTP safely generated & sent to ${validIdentifier}`);
      } else {
        // Fallback or error catch
        console.warn('Widget response non-success:', response);
      }
    } catch (error: any) {
      console.error('Widget send error:', error);
      Alert.alert('Error', error.message || 'Failed to send OTP using widget');
    }
  };

  // ===== BBA LOGIC =====
  const biometricAnalysis = useBiometricAnalysis({
    userId: 'user_otp_verification',
    screenContext: 'OTPVerification',
    autoStart: true,
    riskThreshold: 60,
    onRiskDetected: (result: ComprehensiveAnalysisResult) => {
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
    hasPermission,
    requestPermission,
    clearCurrentOTP,
  } = useOTPDetection({
    autoStart: true,
    showFraudWarnings: false,
    onOTPDetected: () => {},
    onFraudDetected: () => {},
  });

  // ===== TIMER =====
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // ===== OTP VERIFY =====
  const handleOTPComplete = async (otp: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    biometricAnalysis.endInputTracking('otp_input');
    const bbaResult = biometricAnalysis.performAnalysis();

    if (bbaResult.blockTransaction) {
      setIsVerifying(false);
      Alert.alert('Blocked', 'Suspicious behaviour detected.');
      return;
    }

    try {
      const response = await apiService.verifyOTP(phoneNumber, otp);
      const isValid = response.success === true;

      if (isValid) {
        biometricAnalysis.addSampleToProfile();
        clearCurrentOTP();
        Alert.alert('Success', 'OTP verified successfully!', [
          { text: 'Continue', onPress: () => navigation.goBack() },
        ]);
      } else {
        setVerificationError('Invalid OTP.');
      }

    } catch (error: any) {
      setVerificationError(error.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // ===== RESEND =====
  const handleResendOTP = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(30);
    setVerificationError(null);

    if (canResend) {
      await sendRealOTP();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <Text style={styles.title}>Verification Code</Text>

          <OTPAutoFill
            length={6}
            onOTPComplete={handleOTPComplete}
            error={verificationError || undefined}
            disabled={isVerifying}
          />

          {isVerifying && (
            <ActivityIndicator size="small" color="#007AFF" />
          )}

          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.resendButton}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OTPVerificationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggleText: { fontSize: 14, fontWeight: '600' },
  resendContainer: { alignItems: 'center', marginTop: 20 },
  resendButton: { color: '#007AFF', fontWeight: '600' },
  timerText: { color: '#999' },
});