/**
 * Aadhaar Verification Service
 * Handles REAL Aadhaar authentication via Sandbox.co.in OKYC API
 *
 * This service provides:
 * - OTP-based Aadhaar verification
 * - Real KYC data retrieval (name, DOB, address, photo)
 * - Secure verification status management
 *
 * API Provider: Sandbox.co.in (https://developer.sandbox.co.in/)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

// ==================== CONFIGURATION ====================
// Backend API URL for Aadhaar endpoints
const API_BASE_URL = BASE_URL.replace(':3000', ':3001'); // Server runs on port 3001

// Storage keys
const STORAGE_KEYS = {
  aadhaarData: '@kavach_aadhaar_data',
  verificationStatus: '@kavach_aadhaar_status',
  sessionId: '@kavach_aadhaar_session',
};
// ========================================================

export interface AadhaarAddress {
  full?: string;
  house: string;
  street: string;
  landmark?: string;
  locality: string;
  district: string;
  state: string;
  pincode: string;
  country?: string;
  postOffice?: string;
}

export interface AadhaarData {
  uid: string; // Masked UID (last 4 digits visible)
  name: string;
  gender: string;
  dob: string;
  yearOfBirth?: string;
  careOf?: string;
  address: AadhaarAddress;
  photo?: string; // Base64 encoded photo
  emailHash?: string;
  mobileHash?: string;
  shareCode?: string;
  verifiedAt: string;
  transactionId?: string;
  referenceId?: string | number;
}

export interface OTPRequestResult {
  success: boolean;
  sessionId?: string;
  referenceId?: number;
  message?: string;
  transactionId?: string;
  error?: string;
  setupRequired?: boolean;
}

export interface AadhaarVerificationResult {
  success: boolean;
  data?: AadhaarData;
  message?: string;
  error?: string;
}

export interface ConfigStatus {
  configured: boolean;
  provider: string;
  message: string;
}

class AadhaarService {
  private currentSessionId: string | null = null;

  constructor() {
    this.loadStoredSession();
  }

  /**
   * Load stored session from AsyncStorage
   */
  private async loadStoredSession(): Promise<void> {
    try {
      const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.sessionId);
      if (sessionId) {
        this.currentSessionId = sessionId;
      }
    } catch (error) {
      console.error('[Aadhaar] Failed to load stored session:', error);
    }
  }

  /**
   * Store session ID in AsyncStorage
   */
  private async storeSession(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
      this.currentSessionId = sessionId;
    } catch (error) {
      console.error('[Aadhaar] Failed to store session:', error);
    }
  }

  /**
   * Clear session from AsyncStorage
   */
  private async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.sessionId);
      this.currentSessionId = null;
    } catch (error) {
      console.error('[Aadhaar] Failed to clear session:', error);
    }
  }

  /**
   * Check if Aadhaar API is configured on the server
   */
  public async checkApiStatus(): Promise<ConfigStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/aadhaar/config-status`);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[Aadhaar] Config check error:', error);
      return {
        configured: false,
        provider: 'Unknown',
        message: 'Failed to check API status',
      };
    }
  }

  /**
   * Validate Aadhaar number format using Verhoeff algorithm
   */
  public validateAadhaarNumber(aadhaar: string): { valid: boolean; error?: string } {
    const cleanAadhaar = aadhaar.replace(/\s/g, '');

    // Check length
    if (cleanAadhaar.length !== 12) {
      return { valid: false, error: 'Aadhaar number must be 12 digits' };
    }

    // Check if all digits
    if (!/^\d+$/.test(cleanAadhaar)) {
      return { valid: false, error: 'Aadhaar number must contain only digits' };
    }

    // Verhoeff algorithm validation
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    ];

    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
    ];

    let c = 0;
    const reversedAadhaar = cleanAadhaar.split('').reverse().join('');

    for (let i = 0; i < reversedAadhaar.length; i++) {
      c = d[c][p[i % 8][parseInt(reversedAadhaar[i])]];
    }

    if (c !== 0) {
      return { valid: false, error: 'Invalid Aadhaar number' };
    }

    return { valid: true };
  }

  /**
   * Request OTP for Aadhaar verification
   * This sends an OTP to the mobile number linked with the Aadhaar
   */
  public async requestOTP(aadhaarNumber: string): Promise<OTPRequestResult> {
    if (__DEV__) {
      console.log("🛠️ [DEV] Aadhaar OTP request bypassed for:", aadhaarNumber);
      return { 
        success: true, 
        sessionId: "mock_session_" + Date.now(), 
        message: "CAPTCHA/OTP bypassed in DEV mode" 
      };
    }

    try {
      // Validate Aadhaar number first
      const validation = this.validateAadhaarNumber(aadhaarNumber);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const response = await fetch(`${API_BASE_URL}/api/aadhaar/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aadhaarNumber: aadhaarNumber.replace(/\s/g, ''),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store session ID for verification
        if (data.sessionId) {
          await this.storeSession(data.sessionId);
        }

        return {
          success: true,
          sessionId: data.sessionId,
          referenceId: data.referenceId,
          message: data.message || 'OTP sent to registered mobile number',
          transactionId: data.transactionId,
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to send OTP',
        setupRequired: data.setupRequired,
      };
    } catch (error: any) {
      console.error('[Aadhaar] Request OTP error:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Verify OTP and get Aadhaar data
   * Returns complete KYC data including name, DOB, address, and photo
   */
  public async verifyOTP(otp: string, sessionId?: string): Promise<AadhaarVerificationResult> {
    if (__DEV__ && (otp === '000000' || otp === '123456')) {
      console.log("🛠️ [DEV] Aadhaar OTP verification bypassed with code:", otp);
      const mockData: AadhaarData = {
        uid: "XXXX XXXX 1234",
        name: "DEBJYOTI SARKAR",
        gender: "MALE",
        dob: "01-01-1995",
        address: {
          house: "123",
          street: "Tech Lane",
          locality: "Silicon Valley",
          district: "Kolkata",
          state: "West Bengal",
          pincode: "700001"
        },
        verifiedAt: new Date().toISOString(),
        photo: "https://api.dicebear.com/7.x/avataaars/png?seed=Debjyoti"
      };

      // Store Aadhaar data
      await this.storeAadhaarData(mockData);
      // Update verification status
      await this.setVerificationStatus(true, mockData);

      return {
        success: true,
        data: mockData,
        message: "Aadhaar verified successfully (BYPASS MODE)"
      };
    }

    try {
      // Validate OTP format
      if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
        return { success: false, error: 'Invalid OTP. Must be 6 digits.' };
      }

      // Use provided sessionId or stored one
      const session = sessionId || this.currentSessionId;

      if (!session) {
        return {
          success: false,
          error: 'Session expired. Please request a new OTP.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/aadhaar/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session,
          otp,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Clear session after successful verification
        await this.clearSession();

        // Store Aadhaar data
        await this.storeAadhaarData(data.data);

        // Update verification status
        await this.setVerificationStatus(true, data.data);

        return {
          success: true,
          data: data.data,
          message: data.message || 'Aadhaar verified successfully',
        };
      }

      return {
        success: false,
        error: data.error || 'Verification failed',
      };
    } catch (error: any) {
      console.error('[Aadhaar] Verify OTP error:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Store Aadhaar data securely
   * Only stores masked/essential data for privacy
   */
  private async storeAadhaarData(data: AadhaarData): Promise<void> {
    try {
      // Store only essential masked data (no full Aadhaar number)
      const safeData = {
        uid: data.uid,
        name: data.name,
        gender: data.gender,
        dob: data.dob,
        address: {
          locality: data.address.locality,
          district: data.address.district,
          state: data.address.state,
          pincode: data.address.pincode,
        },
        photo: data.photo, // Base64 photo for profile
        verifiedAt: data.verifiedAt,
        transactionId: data.transactionId,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.aadhaarData, JSON.stringify(safeData));
    } catch (error) {
      console.error('[Aadhaar] Failed to store Aadhaar data:', error);
    }
  }

  /**
   * Get stored Aadhaar data
   */
  public async getStoredAadhaarData(): Promise<Partial<AadhaarData> | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.aadhaarData);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Aadhaar] Failed to get Aadhaar data:', error);
      return null;
    }
  }

  /**
   * Set verification status
   */
  public async setVerificationStatus(verified: boolean, data?: AadhaarData): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.verificationStatus,
        JSON.stringify({
          verified,
          verifiedAt: verified ? data?.verifiedAt || new Date().toISOString() : null,
          name: data?.name,
          maskedAadhaar: data?.uid,
        })
      );
    } catch (error) {
      console.error('[Aadhaar] Failed to set verification status:', error);
    }
  }

  /**
   * Get verification status
   */
  public async getVerificationStatus(): Promise<{
    verified: boolean;
    verifiedAt: string | null;
    name?: string;
    maskedAadhaar?: string;
  }> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.verificationStatus);
      if (data) {
        return JSON.parse(data);
      }
      return { verified: false, verifiedAt: null };
    } catch (error) {
      console.error('[Aadhaar] Failed to get verification status:', error);
      return { verified: false, verifiedAt: null };
    }
  }

  /**
   * Clear all Aadhaar data (for logout/unlink)
   */
  public async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.aadhaarData,
        STORAGE_KEYS.verificationStatus,
        STORAGE_KEYS.sessionId,
      ]);
      this.currentSessionId = null;
    } catch (error) {
      console.error('[Aadhaar] Failed to clear data:', error);
    }
  }

  /**
   * Format Aadhaar number with spaces for display
   */
  public formatAadhaarNumber(aadhaar: string): string {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length === 12) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
    }
    return aadhaar;
  }

  /**
   * Mask Aadhaar number (show only last 4 digits)
   */
  public maskAadhaarNumber(aadhaar: string): string {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) return 'XXXX XXXX XXXX';
    return `XXXX XXXX ${digits.slice(-4)}`;
  }
}

// Export singleton instance
export const aadhaarService = new AadhaarService();

// Also export as digilockerService for backward compatibility
export const digilockerService = aadhaarService;

export default aadhaarService;
