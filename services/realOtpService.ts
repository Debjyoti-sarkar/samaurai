/**
 * Real OTP Service - Frontend
 * Handles real OTP sending and verification using backend OTP integration
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const normalizeApiBaseUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const resolveApiBaseUrl = (): string => {
  const envBaseUrl =
    process.env.EXPO_PUBLIC_OTP_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL;

  if (envBaseUrl) {
    return normalizeApiBaseUrl(envBaseUrl);
  }

  const fallbackBaseUrl = __DEV__
    ? 'http://localhost:5000'
    : 'https://your-production-api.com';

  return normalizeApiBaseUrl(fallbackBaseUrl);
};

const API_BASE_URL = resolveApiBaseUrl();

const getCandidateApiBaseUrls = (): string[] => {
  const envOtpBase = process.env.EXPO_PUBLIC_OTP_API_BASE_URL;
  const envApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;

  const candidates = [
    envOtpBase,
    envApiBase,
    __DEV__ ? 'http://10.0.2.2:5000' : undefined,
    __DEV__ ? 'http://localhost:5000' : undefined,
    __DEV__ ? 'http://127.0.0.1:5000' : undefined,
    __DEV__ ? undefined : 'https://your-production-api.com',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeApiBaseUrl(value));

  return [...new Set(candidates)];
};

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

  private async postWithFallback(endpoint: '/otp/send' | '/otp/verify', payload: Record<string, string>) {
    const candidateBaseUrls = getCandidateApiBaseUrls();
    const attemptedUrls: string[] = [];
    let lastError: any;

    const prioritizedBaseUrls = [this.baseURL, ...candidateBaseUrls].filter(
      (url, index, array) => array.indexOf(url) === index
    );

    for (const baseUrl of prioritizedBaseUrls) {
      const url = `${baseUrl}${endpoint}`;
      attemptedUrls.push(url);
      try {
        const response = await axios.post(url, payload, { timeout: 15000 });
        this.baseURL = baseUrl;
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (error?.response) {
          throw error;
        }
      }
    }

    const message = `Unable to connect OTP server. Tried: ${attemptedUrls.join(' | ')}`;
    const finalError = new Error(message) as Error & { originalError?: any };
    finalError.originalError = lastError;
    throw finalError;
  }

  /**
   * Send OTP to a phone number
   * @param phoneNumber - Phone number with or without country code
   * @returns Promise with OTP sending result
   */
  async sendOTP(phoneNumber: string): Promise<OTPResponse> {
    try {
      let formattedPhone = phoneNumber.trim();

      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
      }

      const response = await this.postWithFallback('/otp/send', {
        phoneNumber: formattedPhone,
      });

      // Store phone number for verification
      await AsyncStorage.setItem('otp_phone_number', formattedPhone);
      await AsyncStorage.setItem('otp_sent_time', Date.now().toString());

      return response;
    } catch (error: any) {
      console.error('Error sending OTP:', error);

      if (error.response) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Failed to send OTP. Backend may be unreachable. Start backend and use a reachable API URL.',
        error: error.message || 'Network Error',
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
      let formattedPhone = phoneNumber.trim();

      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
      }

      const response = await this.postWithFallback('/otp/verify', {
        phoneNumber: formattedPhone,
        code: code.trim(),
      });

      if (response.success) {
        await AsyncStorage.removeItem('otp_phone_number');
        await AsyncStorage.removeItem('otp_sent_time');
      }

      return response;
    } catch (error: any) {
      console.error('Error verifying OTP:', error);

      if (error.response) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Failed to verify OTP. Backend may be unreachable. Start backend and use a reachable API URL.',
        error: error.message || 'Network Error',
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
