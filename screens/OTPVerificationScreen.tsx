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

  // ===== NEW STATES =====
  const [useRealOTP, setUseRealOTP] = useState(true);
  const [otpSentPhone, setOtpSentPhone] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [fraudAlertData, setFraudAlertData] = useState<any>(null);
  const [bbaRiskLevel, setBbaRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');

  const otpInputRef = useRef<string>('');

  // ===== SEND REAL OTP WHEN ENABLED =====
  useEffect(() => {
    if (useRealOTP) {
      sendRealOTP();
    }
  }, [useRealOTP]);

  const sendRealOTP = async () => {
    try {
      const response = await apiService.sendOTP(phoneNumber);
      if (response.success) {
        setOtpSentPhone(response.to || phoneNumber);
        Alert.alert('OTP Sent', `OTP sent to ${response.to || phoneNumber}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
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
      let isValid = false;

      if (useRealOTP) {
        const response = await apiService.verifyOTP(phoneNumber, otp);
        isValid = response.success === true;
      } else {
        await new Promise(res => setTimeout(res, 500));
        isValid = otp === '123456';
      }

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

    if (useRealOTP) {
      await sendRealOTP();
      Alert.alert('OTP Sent', `OTP sent to ${phoneNumber}`);
    } else {
      Alert.alert('Dummy Mode', 'Use OTP: 123456');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <Text style={styles.title}>Verification Code</Text>

          {/* TOGGLE - DEV ONLY */}
          {__DEV__ && (
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {useRealOTP ? 'Real OTP Mode' : 'Dummy OTP Mode'}
              </Text>
              <Switch
                value={useRealOTP}
                onValueChange={setUseRealOTP}
              />
            </View>
          )}

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