/**
 * Aadhaar Verification Service - Frontend
 * Handles Aadhaar verification using backend Sandbox API integration
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBaseUrl) {
    const trimmed = envBaseUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  if (!__DEV__) return 'https://your-production-api.com/api';

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const ip = hostUri
    ? hostUri.split(':')[0]
    : Platform.OS === 'android'
      ? '10.0.2.2'
      : 'localhost';

  return `http://${ip}:5000/api`;
};

const API_BASE_URL = getBackendUrl();

export interface AadhaarOTPResponse {
  success: boolean;
  message: string;
  client_id?: string;
  reference_id?: string;
  message_code?: string;
  if_number?: boolean;
  valid_aadhaar?: boolean;
  error?: string;
}

export interface AadhaarVerificationResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    full_name: string;
    aadhaar_number: string;
    dob: string;
    gender: string;
    address: {
      house: string;
      street: string;
      landmark: string;
      locality: string;
      vtc: string;
      subdivision: string;
      district: string;
      state: string;
      country: string;
      pincode: string;
      full_address: string;
    };
    photo_link?: string;
    has_image: boolean;
    mobile_verified: boolean;
    reference_id: string;
  };
  error?: string;
}

class AadhaarVerificationService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Format Aadhaar number (remove spaces and dashes)
   */
  private formatAadhaarNumber(aadhaar: string): string {
    return aadhaar.replace(/[\s-]/g, '');
  }

  /**
   * Validate Aadhaar number format
   */
  validateAadhaarNumber(aadhaar: string): boolean {
    const clean = this.formatAadhaarNumber(aadhaar);
    return clean.length === 12 && /^\d{12}$/.test(clean);
  }

  /**
   * Generate OTP for Aadhaar verification
   * @param aadhaarNumber - 12-digit Aadhaar number
   * @returns Promise with OTP generation result
   */
  async generateOTP(aadhaarNumber: string): Promise<AadhaarOTPResponse> {
    try {
      const cleanAadhaar = this.formatAadhaarNumber(aadhaarNumber);

      if (!this.validateAadhaarNumber(cleanAadhaar)) {
        return {
          success: false,
          message: 'Invalid Aadhaar number. Must be 12 digits.',
        };
      }

      const response = await axios.post(`${this.baseURL}/aadhaar/generate-otp`, {
        aadhaarNumber: cleanAadhaar,
      });

      // Store client_id for verification step
      if (response.data.success && response.data.client_id) {
        await AsyncStorage.setItem('aadhaar_client_id', response.data.client_id);
        await AsyncStorage.setItem('aadhaar_number', cleanAadhaar);
        await AsyncStorage.setItem('aadhaar_otp_sent_time', Date.now().toString());
      }

      return response.data;
    } catch (error: any) {
      console.error('Error generating Aadhaar OTP:', error);

      if (error.response) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Failed to generate OTP. Please check your connection.',
        error: error.message,
      };
    }
  }

  /**
   * Verify Aadhaar OTP
   * @param otp - 6-digit OTP received on Aadhaar registered mobile
   * @param client_id - Optional: Client ID from OTP generation (auto-retrieved if not provided)
   * @returns Promise with verification result
   */
  async verifyOTP(otp: string, client_id?: string): Promise<AadhaarVerificationResponse> {
    try {
      // Get client_id from storage if not provided
      let clientId = client_id;
      if (!clientId) {
        const storedId = await AsyncStorage.getItem('aadhaar_client_id');
        clientId = storedId || undefined;
      }

      if (!clientId) {
        return {
          success: false,
          verified: false,
          message: 'Client ID not found. Please generate OTP first.',
        };
      }

      const cleanOTP = otp.replace(/\s/g, '');

      if (cleanOTP.length !== 6 || !/^\d{6}$/.test(cleanOTP)) {
        return {
          success: false,
          verified: false,
          message: 'Invalid OTP. Must be 6 digits.',
        };
      }

      const response = await axios.post(`${this.baseURL}/aadhaar/verify-otp`, {
        client_id: clientId,
        otp: cleanOTP,
      });

      // Clear stored data if verification successful
      if (response.data.success) {
        await this.clearStoredData();
      }

      return response.data;
    } catch (error: any) {
      console.error('Error verifying Aadhaar OTP:', error);

      if (error.response) {
        return error.response.data;
      }

      return {
        success: false,
        verified: false,
        message: 'Failed to verify OTP. Please try again.',
        error: error.message,
      };
    }
  }

  /**
   * Resend OTP (generates new OTP)
   * @returns Promise with OTP generation result
   */
  async resendOTP(): Promise<AadhaarOTPResponse> {
    try {
      const aadhaarNumber = await AsyncStorage.getItem('aadhaar_number');
      
      if (!aadhaarNumber) {
        return {
          success: false,
          message: 'Aadhaar number not found. Please start verification again.',
        };
      }

      return this.generateOTP(aadhaarNumber);
    } catch (error: any) {
      console.error('Error resending Aadhaar OTP:', error);
      
      return {
        success: false,
        message: 'Failed to resend OTP.',
        error: error.message,
      };
    }
  }

  /**
   * Get stored Aadhaar number (masked)
   */
  async getStoredAadhaarNumber(masked: boolean = true): Promise<string | null> {
    try {
      const aadhaar = await AsyncStorage.getItem('aadhaar_number');
      
      if (!aadhaar) return null;
      
      if (masked) {
        // Mask middle digits: XXXX-XXXX-1234
        return `XXXX-XXXX-${aadhaar.slice(-4)}`;
      }
      
      return aadhaar;
    } catch (error) {
      console.error('Error getting stored Aadhaar:', error);
      return null;
    }
  }

  /**
   * Get time since OTP was sent (in seconds)
   */
  async getTimeSinceOTPSent(): Promise<number | null> {
    try {
      const sentTime = await AsyncStorage.getItem('aadhaar_otp_sent_time');
      if (!sentTime) return null;

      const elapsed = Date.now() - parseInt(sentTime);
      return Math.floor(elapsed / 1000);
    } catch (error) {
      console.error('Error getting OTP sent time:', error);
      return null;
    }
  }

  /**
   * Clear stored Aadhaar verification data
   */
  async clearStoredData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        'aadhaar_client_id',
        'aadhaar_number',
        'aadhaar_otp_sent_time',
      ]);
    } catch (error) {
      console.error('Error clearing Aadhaar data:', error);
    }
  }

  /**
   * Test API configuration
   */
  async testAPIConnection(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/aadhaar/test`);
      return response.data;
    } catch (error: any) {
      console.error('Error testing Aadhaar API:', error);
      return {
        success: false,
        message: 'API connection test failed',
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const aadhaarService = new AadhaarVerificationService();

// Export class for custom instances
export default AadhaarVerificationService;
