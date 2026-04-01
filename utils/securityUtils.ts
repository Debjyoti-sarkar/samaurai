/**
 * Security Utilities
 * - Screen recording/screenshot prevention
 * - Face authentication for high-value transactions
 */

import { Platform, NativeModules } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

// ==================== CONFIGURATION ====================
export const FACE_AUTH_THRESHOLD = 10000; // Amount above which face auth is required (₹10,000)
// ========================================================

/**
 * Check if face/biometric authentication is available on the device
 */
export async function isFaceAuthAvailable(): Promise<{
  available: boolean;
  hasFaceId: boolean;
  hasFingerprint: boolean;
  isEnrolled: boolean;
}> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const hasFaceId = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    );
    const hasFingerprint = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT
    );

    return {
      available: compatible && enrolled,
      hasFaceId,
      hasFingerprint,
      isEnrolled: enrolled,
    };
  } catch (error) {
    console.error('[SecurityUtils] Error checking face auth:', error);
    return {
      available: false,
      hasFaceId: false,
      hasFingerprint: false,
      isEnrolled: false,
    };
  }
}

/**
 * Authenticate user using face/biometric authentication
 */
export async function authenticateWithFace(
  reason: string = 'Verify your identity to proceed'
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { available } = await isFaceAuthAvailable();

    if (!available) {
      return {
        success: false,
        error: 'Biometric authentication not available on this device',
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    } else {
      let errorMessage = 'Authentication failed';

      switch (result.error) {
        case 'user_cancel':
          errorMessage = 'Authentication cancelled';
          break;
        case 'user_fallback':
          errorMessage = 'User chose fallback authentication';
          break;
        case 'system_cancel':
          errorMessage = 'Authentication cancelled by system';
          break;
        case 'not_enrolled':
          errorMessage = 'No biometrics enrolled on this device';
          break;
        case 'lockout':
          errorMessage = 'Too many failed attempts. Please try again later';
          break;
        case 'lockout_permanent':
          errorMessage = 'Biometric authentication is locked. Please use device passcode';
          break;
        default:
          errorMessage = result.error || 'Authentication failed';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error: any) {
    console.error('[SecurityUtils] Face auth error:', error);
    return {
      success: false,
      error: error.message || 'Authentication error occurred',
    };
  }
}

/**
 * Check if face authentication is required for a transaction
 */
export function requiresFaceAuth(amount: number): boolean {
  return amount >= FACE_AUTH_THRESHOLD;
}

/**
 * Authenticate for high-value transaction
 */
export async function authenticateHighValueTransaction(
  amount: number,
  recipient?: string
): Promise<{
  success: boolean;
  error?: string;
  skipped?: boolean;
}> {
  // Check if face auth is required
  if (!requiresFaceAuth(amount)) {
    return { success: true, skipped: true };
  }

  const formattedAmount = amount.toLocaleString('en-IN');
  const reason = recipient
    ? `Verify to send ₹${formattedAmount} to ${recipient}`
    : `Verify to proceed with ₹${formattedAmount} transaction`;

  return authenticateWithFace(reason);
}

/**
 * Screen security flag - used to enable FLAG_SECURE on Android
 * This prevents screenshots and screen recording
 */
export function enableScreenSecurity(): void {
  if (Platform.OS === 'android') {
    try {
      // This will be handled by a native module
      const { ScreenSecurityModule } = NativeModules;
      if (ScreenSecurityModule && ScreenSecurityModule.enableSecureFlag) {
        ScreenSecurityModule.enableSecureFlag();
        console.log('[SecurityUtils] Screen security enabled (FLAG_SECURE)');
      } else {
        console.warn('[SecurityUtils] ScreenSecurityModule not available - using JS fallback');
      }
    } catch (error) {
      console.warn('[SecurityUtils] Could not enable screen security:', error);
    }
  } else if (Platform.OS === 'ios') {
    // iOS handles this differently - need native implementation
    console.log('[SecurityUtils] iOS screen security requires native implementation');
  }
}

/**
 * Disable screen security (for non-sensitive screens)
 */
export function disableScreenSecurity(): void {
  if (Platform.OS === 'android') {
    try {
      const { ScreenSecurityModule } = NativeModules;
      if (ScreenSecurityModule && ScreenSecurityModule.disableSecureFlag) {
        ScreenSecurityModule.disableSecureFlag();
        console.log('[SecurityUtils] Screen security disabled');
      }
    } catch (error) {
      console.warn('[SecurityUtils] Could not disable screen security:', error);
    }
  }
}

export default {
  isFaceAuthAvailable,
  authenticateWithFace,
  requiresFaceAuth,
  authenticateHighValueTransaction,
  enableScreenSecurity,
  disableScreenSecurity,
  FACE_AUTH_THRESHOLD,
};
