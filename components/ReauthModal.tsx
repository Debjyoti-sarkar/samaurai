/**
 * Re-authentication Modal Component
 * Triggered when behavior analysis detects unusual activity
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Vibration,
  ActivityIndicator
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { verifySecurePin } from '@/utils/secureManager';

interface ReauthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onFailure: () => void;
  riskLevel: 'medium' | 'high' | 'critical';
  reason?: string;
  suggestedMethod?: 'pin' | 'biometric' | 'otp';
  alertId?: string;
  maxAttempts?: number;
}

const ReauthModal: React.FC<ReauthModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onFailure,
  riskLevel,
  reason,
  suggestedMethod = 'pin',
  alertId,
  maxAttempts = 3
}) => {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMethod, setAuthMethod] = useState<'pin' | 'biometric'>(
    suggestedMethod === 'biometric' ? 'biometric' : 'pin'
  );
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const pinInputRef = useRef<TextInput>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  useEffect(() => {
    if (visible && authMethod === 'biometric') {
      handleBiometricAuth();
    }
  }, [visible, authMethod]);

  const checkBiometricAvailability = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const handleBiometricAuth = async () => {
    if (!biometricAvailable) {
      setAuthMethod('pin');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true
      });

      if (result.success) {
        await handleAuthSuccess('biometric');
      } else {
        setAttempts(prev => prev + 1);

        if (result.error === 'user_cancel') {
          setAuthMethod('pin');
        } else {
          setError('Biometric verification failed');
          if (attempts + 1 >= maxAttempts) {
            handleAuthFailure();
          }
        }
      }
    } catch (error) {
      setError('Biometric error. Please use PIN.');
      setAuthMethod('pin');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 6) {
      shakeError();
      setError('Please enter 6-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // In production, verify PIN against stored hash
      // For now, we'll simulate verification
      const isValid = await verifyPin(pin);

      if (isValid) {
        await handleAuthSuccess('pin');
      } else {
        setAttempts(prev => prev + 1);
        shakeError();
        setError('Incorrect PIN');
        setPin('');

        if (attempts + 1 >= maxAttempts) {
          handleAuthFailure();
        }
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPin = async (inputPin: string): Promise<boolean> => {
    // Verify against the stored secure PIN
    return await verifySecurePin(inputPin);
  };

  const handleAuthSuccess = async (method: 'pin' | 'biometric') => {
    console.log(`✅ Reauthentication successful via ${method}`);
    setPin('');
    setAttempts(0);
    setError('');
    onSuccess();
  };

  const handleAuthFailure = async () => {
    console.log('❌ Reauthentication failed - max attempts reached');
    setPin('');
    setAttempts(0);
    setError('');
    onFailure();
  };

  const shakeError = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true
      })
    ]).start();
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'critical':
        return '#FF3B30';
      case 'high':
        return '#FF9500';
      case 'medium':
      default:
        return '#FFCC00';
    }
  };

  const getRiskIcon = () => {
    switch (riskLevel) {
      case 'critical':
        return 'warning';
      case 'high':
        return 'alert-circle';
      case 'medium':
      default:
        return 'shield-checkmark';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateX: shakeAnimation }] }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: getRiskColor() }]}>
            <Ionicons name={getRiskIcon()} size={40} color="#fff" />
            <Text style={styles.headerTitle}>Security Verification</Text>
            <Text style={styles.headerSubtitle}>
              {reason || 'Additional verification required for your security'}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Risk Level Badge */}
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor() + '20' }]}>
              <Text style={[styles.riskText, { color: getRiskColor() }]}>
                {riskLevel.toUpperCase()} RISK DETECTED
              </Text>
            </View>

            {/* Attempts Remaining */}
            {attempts > 0 && (
              <Text style={styles.attemptsText}>
                {maxAttempts - attempts} attempts remaining
              </Text>
            )}

            {/* Auth Method Toggle */}
            {biometricAvailable && (
              <View style={styles.methodToggle}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    authMethod === 'pin' && styles.methodButtonActive
                  ]}
                  onPress={() => setAuthMethod('pin')}
                >
                  <Ionicons
                    name="keypad"
                    size={20}
                    color={authMethod === 'pin' ? '#007AFF' : '#666'}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      authMethod === 'pin' && styles.methodTextActive
                    ]}
                  >
                    PIN
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    authMethod === 'biometric' && styles.methodButtonActive
                  ]}
                  onPress={() => {
                    setAuthMethod('biometric');
                    handleBiometricAuth();
                  }}
                >
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color={authMethod === 'biometric' ? '#007AFF' : '#666'}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      authMethod === 'biometric' && styles.methodTextActive
                    ]}
                  >
                    Biometric
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PIN Input */}
            {authMethod === 'pin' && (
              <View style={styles.pinContainer}>
                <Text style={styles.pinLabel}>Enter your 6-digit PIN</Text>
                <TextInput
                  ref={pinInputRef}
                  style={styles.pinInput}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                  placeholder="••••••"
                  placeholderTextColor="#ccc"
                  autoFocus
                />

                {/* PIN Dots */}
                <View style={styles.pinDots}>
                  {[...Array(6)].map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pinDot,
                        index < pin.length && styles.pinDotFilled
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Biometric Prompt */}
            {authMethod === 'biometric' && (
              <View style={styles.biometricContainer}>
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricAuth}
                >
                  <Ionicons name="finger-print" size={60} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.biometricText}>
                  Touch the sensor to verify
                </Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              {authMethod === 'pin' && (
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    isLoading && styles.buttonDisabled
                  ]}
                  onPress={handlePinSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel Transaction</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden'
  },
  header: {
    padding: 24,
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
    textAlign: 'center'
  },
  content: {
    padding: 24
  },
  riskBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20
  },
  riskText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  attemptsText: {
    textAlign: 'center',
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10
  },
  methodButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  methodText: {
    marginLeft: 8,
    color: '#666',
    fontWeight: '500'
  },
  methodTextActive: {
    color: '#007AFF'
  },
  pinContainer: {
    alignItems: 'center'
  },
  pinLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16
  },
  pinInput: {
    fontSize: 24,
    letterSpacing: 10,
    textAlign: 'center',
    width: '100%',
    height: 0,
    opacity: 0
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent'
  },
  pinDotFilled: {
    backgroundColor: '#007AFF'
  },
  biometricContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  biometricButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center'
  },
  biometricText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B3010',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16
  },
  errorText: {
    color: '#FF3B30',
    marginLeft: 8,
    fontSize: 14
  },
  actions: {
    marginTop: 24
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  buttonDisabled: {
    opacity: 0.7
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500'
  }
});

export default ReauthModal;
