/**
 * Real OTP Service - Frontend
 * Handles real OTP sending and verification using backend Twilio integration
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL for your backend API
// Update this with your actual backend URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

export interface OTPResponse {
  success: boolean;
  status?: string;
  to?: string;
  message: string;
  error?: string;
  valid?: boolean;
}

class RealOTPService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Send OTP to a phone number
   * @param phoneNumber - Phone number with or without country code
   * @returns Promise with OTP sending result
   */
  async sendOTP(phoneNumber: string): Promise<OTPResponse> {
    try {
      // Format phone number
      let formattedPhone = phoneNumber.trim();
      
      // If number doesn't start with +, add +91 for India
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
      }

      const response = await axios.post(`${this.baseURL}/otp/send`, {
        phoneNumber: formattedPhone,
      });

      // Store phone number for verification
      await AsyncStorage.setItem('otp_phone_number', formattedPhone);
      await AsyncStorage.setItem('otp_sent_time', Date.now().toString());

      return response.data;
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      
      if (error.response) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Failed to send OTP. Please check your network connection.',
        error: error.message,
      };
    }
  }

  /**
   * Verify OTP code
   * @param phoneNumber - Phone number
   * @param code - OTP code entered by user
   * @returns Promise with verification result
   */
  async verifyOTP(phoneNumber: string, code: string): Promise<OTPResponse> {
    try {
      // Format phone number
      let formattedPhone = phoneNumber.trim();
      
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
      }

      const response = await axios.post(`${this.baseURL}/otp/verify`, {
        phoneNumber: formattedPhone,
        code: code.trim(),
      });

      // Clear stored data if verification successful
      if (response.data.success) {
        await AsyncStorage.removeItem('otp_phone_number');
        await AsyncStorage.removeItem('otp_sent_time');
      }

      return response.data;
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      
      if (error.response) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.',
        error: error.message,
      };
    }
  }

  /**
   * Resend OTP to the same phone number
   * @param phoneNumber - Phone number
   * @returns Promise with OTP sending result
   */
  async resendOTP(phoneNumber: string): Promise<OTPResponse> {
    return this.sendOTP(phoneNumber);
  }

  /**
   * Get the phone number that OTP was sent to
   * @returns Stored phone number or null
   */
  async getStoredPhoneNumber(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('otp_phone_number');
    } catch (error) {
      console.error('Error getting stored phone number:', error);
      return null;
    }
  }

  /**
   * Get time since OTP was sent (in seconds)
   * @returns Time in seconds or null
   */
  async getTimeSinceOTPSent(): Promise<number | null> {
    try {
      const sentTime = await AsyncStorage.getItem('otp_sent_time');
      if (!sentTime) return null;
      
      const elapsed = Date.now() - parseInt(sentTime);
      return Math.floor(elapsed / 1000);
    } catch (error) {
      console.error('Error getting OTP sent time:', error);
      return null;
    }
  }

  /**
   * Clear stored OTP data
   */
  async clearOTPData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('otp_phone_number');
      await AsyncStorage.removeItem('otp_sent_time');
    } catch (error) {
      console.error('Error clearing OTP data:', error);
    }
  }
}

// Export singleton instance
export const realOTPService = new RealOTPService();

// Export class for custom instances
export default RealOTPService;
