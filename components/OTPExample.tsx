/**
 * OTP Example Component
 * Demonstrates how to send and verify real OTP using Twilio
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { realOTPService } from '../services/realOtpService';

const OTPExample = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  /**
   * Send OTP to the phone number
   */
  const handleSendOtp = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    // Validate phone number (10 digits for Indian numbers)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await realOTPService.sendOTP(phoneNumber);

      if (response.success) {
        Alert.alert('Success', 'OTP sent successfully! Check your SMS.');
        setOtpSent(true);
        setResendTimer(60); // 60 seconds before resend
      } else {
        Alert.alert('Error', response.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify the OTP code
   */
  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP code');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Error', 'OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await realOTPService.verifyOTP(phoneNumber, otp);

      if (response.success) {
        Alert.alert('Success', 'OTP verified successfully! ✓', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setPhoneNumber('');
              setOtp('');
              setOtpSent(false);
              setResendTimer(0);
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.message || 'Invalid or expired OTP');
        setOtp(''); // Clear invalid OTP
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend OTP
   */
  const handleResendOtp = async () => {
    if (resendTimer > 0) {
      Alert.alert('Wait', `Please wait ${resendTimer} seconds before resending`);
      return;
    }

    await handleSendOtp();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Real OTP Verification</Text>
      <Text style={styles.subtitle}>Powered by Twilio</Text>

      {!otpSent ? (
        // Phone number input
        <>
          <TextInput
            placeholder="Phone Number (10 digits)"
            value={phoneNumber}
            keyboardType="numeric"
            maxLength={10}
            style={styles.input}
            onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ''))}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        // OTP verification
        <>
          <Text style={styles.infoText}>
            OTP sent to +91{phoneNumber}
          </Text>

          <TextInput
            placeholder="Enter 6-digit OTP"
            value={otp}
            keyboardType="numeric"
            maxLength={6}
            style={styles.input}
            onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
            editable={!loading}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendButton,
              resendTimer > 0 && styles.resendButtonDisabled,
            ]}
            onPress={handleResendOtp}
            disabled={resendTimer > 0 || loading}
          >
            <Text
              style={[
                styles.resendText,
                resendTimer > 0 && styles.resendTextDisabled,
              ]}
            >
              {resendTimer > 0
                ? `Resend OTP in ${resendTimer}s`
                : 'Resend OTP'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeNumberButton}
            onPress={() => {
              setOtpSent(false);
              setOtp('');
              setResendTimer(0);
            }}
            disabled={loading}
          >
            <Text style={styles.changeNumberText}>Change Number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#999',
  },
  changeNumberButton: {
    padding: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  changeNumberText: {
    color: '#666',
    fontSize: 14,
  },
});

export default OTPExample;
