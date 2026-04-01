/**
 * OTP Detection Hook
 * React hook for real-time OTP detection and fraud analysis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { otpService, ExtractedOTP } from '../services/otpService';
import { smsMonitor } from '../services/smsMonitor';

interface UseOTPDetectionOptions {
  autoStart?: boolean;
  showFraudWarnings?: boolean;
  onOTPDetected?: (otp: ExtractedOTP) => void;
  onOTPExpired?: (otp: ExtractedOTP) => void;
  onFraudDetected?: (otp: ExtractedOTP, fraudScore: number) => void;
}

interface OTPDetectionState {
  isListening: boolean;
  hasPermission: boolean;
  currentOTP: ExtractedOTP | null;
  otpHistory: ExtractedOTP[];
  timeRemaining: number | null;
  error: string | null;
}

interface OTPDetectionActions {
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  requestPermission: () => Promise<boolean>;
  clearCurrentOTP: () => void;
  clearHistory: () => Promise<void>;
  analyzeMessage: (message: string, sender: string) => Promise<{
    otp: ExtractedOTP | null;
    isFraud: boolean;
    fraudScore: number;
  }>;
}

export function useOTPDetection(
  options: UseOTPDetectionOptions = {}
): OTPDetectionState & OTPDetectionActions {
  const {
    autoStart = true,
    showFraudWarnings = true,
    onOTPDetected,
    onOTPExpired,
    onFraudDetected,
  } = options;

  const [state, setState] = useState<OTPDetectionState>({
    isListening: false,
    hasPermission: false,
    currentOTP: null,
    otpHistory: [],
    timeRemaining: null,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Check permissions on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === 'android') {
        const hasPermission = await smsMonitor.hasPermissions();
        if (mountedRef.current) {
          setState(prev => ({ ...prev, hasPermission }));
        }

        if (hasPermission && autoStart) {
          startListening();
        }
      }
    };
    checkPermission();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoStart]);

  // Handle OTP detected
  const handleOTPDetected = useCallback((otp: ExtractedOTP) => {
    if (!mountedRef.current) return;

    // Check for fraud
    if (!otp.isTrusted && showFraudWarnings) {
      if (onFraudDetected) {
        onFraudDetected(otp, 50); // Default suspicion score for untrusted senders
      } else {
        Alert.alert(
          'Suspicious OTP',
          `OTP from ${otp.sender} may not be legitimate. Verify the sender before using.`,
          [{ text: 'OK' }]
        );
      }
    }

    setState(prev => ({
      ...prev,
      currentOTP: otp,
      otpHistory: [otp, ...prev.otpHistory].slice(0, 50),
    }));

    // Start timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, otp.expiresAt - Date.now());
      if (mountedRef.current) {
        setState(prev => ({ ...prev, timeRemaining: remaining }));
        if (remaining === 0) {
          handleOTPExpired(otp);
        }
      }
    }, 1000);

    if (onOTPDetected) {
      onOTPDetected(otp);
    }
  }, [showFraudWarnings, onOTPDetected, onFraudDetected]);

  // Handle OTP expired
  const handleOTPExpired = useCallback((otp: ExtractedOTP) => {
    if (!mountedRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      currentOTP: null,
      timeRemaining: null,
    }));

    if (onOTPExpired) {
      onOTPExpired(otp);
    }
  }, [onOTPExpired]);

  // Start listening for OTPs
  const startListening = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setState(prev => ({
        ...prev,
        error: 'OTP detection is only available on Android',
      }));
      return false;
    }

    try {
      const started = await otpService.startListening();

      if (started) {
        // Check for existing OTP
        const existingOTP = otpService.getCurrentOTP();
        if (existingOTP) {
          handleOTPDetected(existingOTP);
        }

        // Register callbacks
        otpService.onOTPReceivedCallback(handleOTPDetected);
        otpService.onOTPExpiredCallback(handleOTPExpired);

        setState(prev => ({
          ...prev,
          isListening: true,
          hasPermission: true,
          error: null,
        }));

        return true;
      } else {
        setState(prev => ({
          ...prev,
          isListening: false,
          error: 'Failed to start OTP detection',
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isListening: false,
        error: 'Error starting OTP detection',
      }));
      return false;
    }
  }, [handleOTPDetected, handleOTPExpired]);

  // Stop listening
  const stopListening = useCallback(() => {
    otpService.stopListening();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isListening: false,
    }));
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    const granted = await smsMonitor.requestPermissions();
    setState(prev => ({ ...prev, hasPermission: granted }));

    if (granted && autoStart) {
      return startListening();
    }

    return granted;
  }, [autoStart, startListening]);

  // Clear current OTP
  const clearCurrentOTP = useCallback(() => {
    otpService.clearCurrentOTP();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      currentOTP: null,
      timeRemaining: null,
    }));
  }, []);

  // Clear history
  const clearHistory = useCallback(async () => {
    await otpService.clearHistory();
    setState(prev => ({
      ...prev,
      otpHistory: [],
    }));
  }, []);

  // Analyze a message for OTP
  const analyzeMessage = useCallback(async (
    message: string,
    sender: string
  ): Promise<{ otp: ExtractedOTP | null; isFraud: boolean; fraudScore: number }> => {
    const result = await otpService.analyzeOTPMessage(message, sender);
    return {
      otp: result.otp,
      isFraud: result.isFraud,
      fraudScore: result.fraudScore,
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    requestPermission,
    clearCurrentOTP,
    clearHistory,
    analyzeMessage,
  };
}

export default useOTPDetection;
