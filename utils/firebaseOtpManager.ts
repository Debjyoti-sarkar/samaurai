// utils/firebaseOtpManager.ts
import { auth } from "./firebaseConfig";
import {
  PhoneAuthProvider,
  signInWithCredential,
  ApplicationVerifier,
} from "firebase/auth";

let globalVerificationId: string | null = null;

/**
 * Send OTP to phone number using Firebase Phone Auth
 * @param phoneNumber - 10-digit Indian phone number (without country code)
 * @param recaptchaVerifier - Firebase RecaptchaVerifier from expo-firebase-recaptcha
 */
export async function sendFirebaseOTP(
  phoneNumber: string,
  recaptchaVerifier: ApplicationVerifier
): Promise<{ success: boolean; error?: string; verificationId?: string }> {
  try {
    // Format phone number with India country code
    const formattedPhone = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+91${phoneNumber.replace(/\D/g, "")}`;

    console.log("📱 Sending real SMS OTP to:", formattedPhone);

    const phoneProvider = new PhoneAuthProvider(auth);
    const verificationId = await phoneProvider.verifyPhoneNumber(
      formattedPhone,
      recaptchaVerifier
    );

    globalVerificationId = verificationId;
    console.log("✅ Real SMS OTP Sent Successfully!");

    return { success: true, verificationId };

  } catch (error: any) {
    console.error("❌ Error sending OTP:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);

    let errorMessage = "Failed to send OTP. Please try again.";

    switch (error.code) {
      case "auth/invalid-phone-number":
        errorMessage = "Invalid phone number format. Please enter a valid 10-digit number.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Too many OTP requests. Please wait 5 minutes and try again.";
        break;
      case "auth/quota-exceeded":
        errorMessage = "Daily SMS limit reached. Please try again tomorrow.";
        break;
      case "auth/captcha-check-failed":
        errorMessage = "Security verification failed. Please try again.";
        break;
      case "auth/missing-phone-number":
        errorMessage = "Please enter your phone number.";
        break;
      case "auth/user-disabled":
        errorMessage = "This phone number has been blocked. Contact support.";
        break;
      case "auth/operation-not-allowed":
        errorMessage = "Phone authentication is not enabled. Contact support.";
        break;
      default:
        errorMessage = error.message || "Failed to send OTP. Please try again.";
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Verify OTP code entered by user
 * @param otpCode - 6-digit OTP received via SMS
 * @param verificationId - Optional verification ID (uses stored one if not provided)
 */
export async function verifyFirebaseOTP(
  otpCode: string,
  verificationId?: string
): Promise<{ success: boolean; error?: string; userId?: string; phoneNumber?: string }> {
  try {
    const vidToUse = verificationId || globalVerificationId;

    if (!vidToUse) {
      return {
        success: false,
        error: "No verification in progress. Please request OTP first."
      };
    }

    console.log("🔍 Verifying OTP code...");

    const credential = PhoneAuthProvider.credential(vidToUse, otpCode);
    const userCredential = await signInWithCredential(auth, credential);

    console.log("✅ OTP Verified Successfully!");
    console.log("📞 Phone:", userCredential.user.phoneNumber);

    globalVerificationId = null;

    return {
      success: true,
      userId: userCredential.user.uid,
      phoneNumber: userCredential.user.phoneNumber || undefined
    };

  } catch (error: any) {
    console.error("❌ Error verifying OTP:", error);
    console.error("Error code:", error.code);

    let errorMessage = "Invalid OTP. Please try again.";

    switch (error.code) {
      case "auth/invalid-verification-code":
        errorMessage = "Incorrect OTP. Please check and try again.";
        break;
      case "auth/code-expired":
        errorMessage = "OTP has expired. Please request a new one.";
        break;
      case "auth/invalid-verification-id":
        errorMessage = "Session expired. Please request a new OTP.";
        break;
      case "auth/session-expired":
        errorMessage = "Verification session expired. Please start over.";
        break;
      default:
        errorMessage = error.message || "Verification failed. Please try again.";
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get current verification ID
 */
export function getVerificationId(): string | null {
  return globalVerificationId;
}

/**
 * Clear current verification session
 */
export function clearVerification() {
  globalVerificationId = null;
}

/**
 * Check if there's an active verification session
 */
export function hasActiveVerification(): boolean {
  return globalVerificationId !== null;
}