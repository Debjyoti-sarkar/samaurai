./**
 * OTP Auto-Fill Component
 * Displays real-time OTP with auto-fill capability
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Vibration,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { otpService, ExtractedOTP } from '../services/otpService';
import { smsMonitor } from '../services/smsMonitor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OTPAutoFillProps {
  length?: number;
  onOTPComplete: (otp: string) => void;
  onOTPChange?: (otp: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  showAutoDetect?: boolean;
}

const OTPAutoFill: React.FC<OTPAutoFillProps> = ({
  length = 6,
  onOTPComplete,
  onOTPChange,
  autoFocus = true,
  disabled = false,
  error,
  label = 'Enter OTP',
  showAutoDetect = true,
}) => {
  const [otp, setOTP] = useState<string[]>(Array(length).fill(''));
  const [activeIndex, setActiveIndex] = useState(0);
  const [detectedOTP, setDetectedOTP] = useState<ExtractedOTP | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showDetectedBanner, setShowDetectedBanner] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize OTP listening
  useEffect(() => {
    if (showAutoDetect && Platform.OS === 'android') {
      initializeOTPListener();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [showAutoDetect]);

  // Pulse animation for listening indicator
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isListening]);

  // Timer countdown
  useEffect(() => {
    if (detectedOTP) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, detectedOTP.expiresAt - Date.now());
        setTimeRemaining(remaining);
        if (remaining === 0) {
          setDetectedOTP(null);
          setShowDetectedBanner(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [detectedOTP]);

  const initializeOTPListener = async () => {
    const started = await otpService.startListening();
    setIsListening(started);

    if (started) {
      // Check for existing OTP
      const existingOTP = otpService.getCurrentOTP();
      if (existingOTP) {
        handleOTPDetected(existingOTP);
      }

      // Register for new OTPs
      otpService.onOTPReceivedCallback((newOTP) => {
        handleOTPDetected(newOTP);
      });

      otpService.onOTPExpiredCallback(() => {
        setDetectedOTP(null);
        setShowDetectedBanner(false);
      });
    }
  };

  const handleOTPDetected = (newOTP: ExtractedOTP) => {
    setDetectedOTP(newOTP);
    setShowDetectedBanner(true);
    Vibration.vibrate(200);

    // Animate banner slide in
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleAutoFill = () => {
    if (detectedOTP) {
      const otpDigits = detectedOTP.otp.slice(0, length).split('');
      const newOTP = [...Array(length).fill('')];
      otpDigits.forEach((digit, index) => {
        if (index < length) {
          newOTP[index] = digit;
        }
      });
      setOTP(newOTP);
      setActiveIndex(length - 1);

      // Hide banner
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowDetectedBanner(false));

      // Clear the OTP after use
      otpService.clearCurrentOTP();
      setDetectedOTP(null);

      // Trigger completion
      const completeOTP = newOTP.join('');
      if (completeOTP.length === length) {
        onOTPComplete(completeOTP);
      }
      if (onOTPChange) {
        onOTPChange(completeOTP);
      }
    }
  };

  const handleInputChange = (text: string, index: number) => {
    if (disabled) return;

    // Handle paste
    if (text.length > 1) {
      const pastedDigits = text.replace(/\D/g, '').slice(0, length).split('');
      const newOTP = [...Array(length).fill('')];
      pastedDigits.forEach((digit, i) => {
        if (i < length) {
          newOTP[i] = digit;
        }
      });
      setOTP(newOTP);
      const lastFilledIndex = Math.min(pastedDigits.length - 1, length - 1);
      setActiveIndex(lastFilledIndex);
      inputRefs.current[lastFilledIndex]?.focus();

      const completeOTP = newOTP.join('');
      if (completeOTP.length === length) {
        onOTPComplete(completeOTP);
      }
      if (onOTPChange) {
        onOTPChange(completeOTP);
      }
      return;
    }

    // Handle single digit
    const digit = text.replace(/\D/g, '');
    const newOTP = [...otp];
    newOTP[index] = digit;
    setOTP(newOTP);

    if (onOTPChange) {
      onOTPChange(newOTP.join(''));
    }

    // Move to next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }

    // Check if complete
    const completeOTP = newOTP.join('');
    if (completeOTP.length === length && !completeOTP.includes('')) {
      onOTPComplete(completeOTP);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveIndex(index - 1);
      const newOTP = [...otp];
      newOTP[index - 1] = '';
      setOTP(newOTP);
      if (onOTPChange) {
        onOTPChange(newOTP.join(''));
      }
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getOTPTypeIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return 'card-outline';
      case 'upi':
        return 'phone-portrait-outline';
      case 'ecommerce':
        return 'cart-outline';
      default:
        return 'key-outline';
    }
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Auto-detect indicator */}
      {showAutoDetect && Platform.OS === 'android' && (
        <View style={styles.autoDetectRow}>
          <Animated.View
            style={[
              styles.listeningIndicator,
              { transform: [{ scale: pulseAnim }] },
              { backgroundColor: isListening ? '#34C759' : '#999' },
            ]}
          />
          <Text style={styles.autoDetectText}>
            {isListening ? 'Auto-detecting OTP...' : 'SMS detection unavailable'}
          </Text>
        </View>
      )}

      {/* Detected OTP Banner */}
      {showDetectedBanner && detectedOTP && (
        <Animated.View
          style={[
            styles.detectedBanner,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.detectedHeader}>
            <View style={styles.detectedInfo}>
              <Ionicons
                name={getOTPTypeIcon(detectedOTP.type)}
                size={20}
                color="#007AFF"
              />
              <View style={styles.detectedTextContainer}>
                <Text style={styles.detectedTitle}>
                  OTP Detected {detectedOTP.bankName ? `from ${detectedOTP.bankName}` : ''}
                </Text>
                <Text style={styles.detectedOTP}>{detectedOTP.otp}</Text>
              </View>
            </View>
            {timeRemaining !== null && (
              <View style={styles.timerContainer}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
            )}
          </View>

          {detectedOTP.amount && (
            <Text style={styles.detectedAmount}>
              Transaction: ₹{parseInt(detectedOTP.amount).toLocaleString()}
            </Text>
          )}

          {!detectedOTP.isTrusted && (
            <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={14} color="#FF9500" />
              <Text style={styles.warningText}>Verify sender before using</Text>
            </View>
          )}

          <TouchableOpacity style={styles.autoFillButton} onPress={handleAutoFill}>
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={styles.autoFillButtonText}>Auto-fill OTP</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* OTP Input Fields */}
      <View style={styles.inputContainer}>
        {Array(length)
          .fill(0)
          .map((_, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.input,
                activeIndex === index && styles.inputActive,
                otp[index] && styles.inputFilled,
                error && styles.inputError,
                disabled && styles.inputDisabled,
              ]}
              value={otp[index]}
              onChangeText={(text) => handleInputChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setActiveIndex(index)}
              keyboardType="number-pad"
              maxLength={length} // Allow paste
              selectTextOnFocus
              autoFocus={autoFocus && index === 0}
              editable={!disabled}
              caretHidden
            />
          ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Sender info if OTP detected */}
      {detectedOTP && (
        <View style={styles.senderInfo}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#666" />
          <Text style={styles.senderText}>From: {detectedOTP.sender}</Text>
        </View>
      )}
    </View>
  );
};

// OTP Input Hook for custom implementations
export const useOTPAutoDetect = () => {
  const [detectedOTP, setDetectedOTP] = useState<ExtractedOTP | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const start = async () => {
        const started = await otpService.startListening();
        setIsListening(started);

        if (started) {
          const existing = otpService.getCurrentOTP();
          if (existing) {
            setDetectedOTP(existing);
          }

          otpService.onOTPReceivedCallback(setDetectedOTP);
          otpService.onOTPExpiredCallback(() => setDetectedOTP(null));
        }
      };
      start();

      return () => {
        otpService.stopListening();
      };
    }
  }, []);

  const clearOTP = useCallback(() => {
    otpService.clearCurrentOTP();
    setDetectedOTP(null);
  }, []);

  return {
    detectedOTP,
    isListening,
    clearOTP,
  };
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  autoDetectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listeningIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  autoDetectText: {
    fontSize: 12,
    color: '#666',
  },
  detectedBanner: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF30',
  },
  detectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detectedTextContainer: {
    marginLeft: 10,
  },
  detectedTitle: {
    fontSize: 12,
    color: '#666',
  },
  detectedOTP: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 4,
    marginTop: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  detectedAmount: {
    fontSize: 12,
    color: '#333',
    marginBottom: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950015',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 6,
  },
  autoFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
  },
  autoFillButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  input: {
    width: (SCREEN_WIDTH - 80) / 6,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  inputActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  inputFilled: {
    borderColor: '#34C759',
    backgroundColor: '#F0FFF4',
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF0F0',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginLeft: 6,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
});

export default OTPAutoFill;
