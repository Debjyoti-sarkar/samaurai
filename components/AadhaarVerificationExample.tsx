/**
 * Aadhaar Verification Example
 * Complete flow for verifying Aadhaar with OTP
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
  ScrollView,
} from 'react-native';
import { aadhaarService } from '../services/aadhaarVerificationService';

const AadhaarVerificationExample = () => {
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [clientId, setClientId] = useState('');
  const [verifiedData, setVerifiedData] = useState<any>(null);
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
   * Format Aadhaar for display (XXXX-XXXX-XXXX)
   */
  const formatAadhaarDisplay = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/(\d{0,4})(\d{0,4})(\d{0,4})/);
    if (match) {
      return [match[1], match[2], match[3]].filter((x) => x).join('-');
    }
    return text;
  };

  /**
   * Generate OTP for Aadhaar
   */
  const handleGenerateOTP = async () => {
    if (!aadhaarNumber) {
      Alert.alert('Error', 'Please enter Aadhaar number');
      return;
    }

    const cleanNumber = aadhaarNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 12) {
      Alert.alert('Error', 'Aadhaar number must be 12 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await aadhaarService.generateOTP(cleanNumber);

      if (response.success) {
        Alert.alert(
          'OTP Sent',
          'OTP has been sent to your Aadhaar registered mobile number'
        );
        setOtpSent(true);
        setClientId(response.client_id || '');
        setResendTimer(120); // 2 minutes before resend
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
   * Verify OTP
   */
  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter OTP');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Error', 'OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await aadhaarService.verifyOTP(otp, clientId);

      if (response.success && response.verified) {
        setVerifiedData(response.data);
        Alert.alert('Success', 'Aadhaar verified successfully! ✓');
      } else {
        Alert.alert('Error', response.message || 'Invalid or expired OTP');
        setOtp('');
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
  const handleResendOTP = async () => {
    if (resendTimer > 0) {
      Alert.alert('Wait', `Please wait ${resendTimer} seconds before resending`);
      return;
    }

    await handleGenerateOTP();
  };

  /**
   * Reset form
   */
  const handleReset = () => {
    setAadhaarNumber('');
    setOtp('');
    setOtpSent(false);
    setClientId('');
    setVerifiedData(null);
    setResendTimer(0);
    aadhaarService.clearStoredData();
  };

  // If verified, show details
  if (verifiedData) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Aadhaar Verified</Text>
          
          <View style={styles.detailsCard}>
            <DetailRow label="Name" value={verifiedData.full_name} />
            <DetailRow
              label="Aadhaar"
              value={`XXXX-XXXX-${verifiedData.aadhaar_number?.slice(-4)}`}
            />
            <DetailRow label="DOB" value={verifiedData.dob} />
            <DetailRow label="Gender" value={verifiedData.gender} />
            
            <Text style={styles.addressTitle}>Address</Text>
            <Text style={styles.addressText}>
              {verifiedData.address?.full_address}
            </Text>
            
            <DetailRow label="State" value={verifiedData.address?.state} />
            <DetailRow label="Pincode" value={verifiedData.address?.pincode} />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleReset}>
            <Text style={styles.buttonText}>Verify Another</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aadhaar Verification</Text>
      <Text style={styles.subtitle}>Sandbox API Integration</Text>

      {!otpSent ? (
        // Aadhaar input
        <>
          <Text style={styles.label}>Enter Aadhaar Number</Text>
          <TextInput
            placeholder="XXXX-XXXX-XXXX"
            value={formatAadhaarDisplay(aadhaarNumber)}
            keyboardType="numeric"
            maxLength={14} // 12 digits + 2 dashes
            style={styles.input}
            onChangeText={(text) => setAadhaarNumber(text.replace(/\D/g,''))}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleGenerateOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Generate OTP</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.infoText}>
            OTP will be sent to your Aadhaar registered mobile number
          </Text>
        </>
      ) : (
        // OTP verification
        <>
          <Text style={styles.infoText}>
            OTP sent to Aadhaar registered mobile
          </Text>
          <Text style={styles.aadhaarDisplay}>
            {formatAadhaarDisplay(aadhaarNumber)}
          </Text>

          <Text style={styles.label}>Enter OTP</Text>
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
            onPress={handleVerifyOTP}
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
            onPress={handleResendOTP}
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
            style={styles.changeButton}
            onPress={handleReset}
            disabled={loading}
          >
            <Text style={styles.changeText}>Change Aadhaar Number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// Detail row component
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
    fontWeight: '500',
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
  infoText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
    lineHeight: 18,
  },
  aadhaarDisplay: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    letterSpacing: 2,
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
  changeButton: {
    padding: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  changeText: {
    color: '#666',
    fontSize: 14,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  successIcon: {
    fontSize: 60,
    color: '#4CAF50',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 30,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
});

export default AadhaarVerificationExample;
