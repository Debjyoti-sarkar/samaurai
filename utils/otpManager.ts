// utils/otpManager.ts - DEMO MODE (No billing required)
import * as SecureStore from "expo-secure-store";
import CryptoJS from "crypto-js";

const OTP_STORAGE_KEY = "kavach_otp_data";

interface OTPData {
  phone: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
}

export async function sendOTP(phone: string): Promise<{ success: boolean; otp?: string; error?: string }> {
  try {
    if (!/^\d{10}$/.test(phone)) {
      return { success: false, error: "Invalid phone number format" };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = CryptoJS.SHA256(otp).toString();
    
    const otpData: OTPData = {
      phone,
      otpHash,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    };

    await SecureStore.setItemAsync(OTP_STORAGE_KEY, JSON.stringify(otpData));
    
    console.log(`🔐 DEMO OTP for ${phone}: ${otp}`);
    
    return { success: true, otp };
  } catch (error) {
    console.error("Send OTP Error:", error);
    return { success: false, error: "Failed to generate OTP" };
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const storedData = await SecureStore.getItemAsync(OTP_STORAGE_KEY);
    
    if (!storedData) {
      return { success: false, error: "No OTP found. Please request a new one." };
    }

    const otpData: OTPData = JSON.parse(storedData);

    if (otpData.phone !== phone) {
      return { success: false, error: "Phone number mismatch" };
    }

    if (Date.now() > otpData.expiresAt) {
      await SecureStore.deleteItemAsync(OTP_STORAGE_KEY);
      return { success: false, error: "OTP expired. Please request a new one." };
    }

    if (otpData.attempts >= 5) {
      await SecureStore.deleteItemAsync(OTP_STORAGE_KEY);
      return { success: false, error: "Too many attempts. Please request a new OTP." };
    }

    const otpHash = CryptoJS.SHA256(otp).toString();
    
    if (otpHash === otpData.otpHash) {
      await SecureStore.deleteItemAsync(OTP_STORAGE_KEY);
      return { success: true };
    } else {
      otpData.attempts += 1;
      await SecureStore.setItemAsync(OTP_STORAGE_KEY, JSON.stringify(otpData));
      return { success: false, error: `Invalid OTP. ${5 - otpData.attempts} attempts remaining.` };
    }
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return { success: false, error: "Verification failed" };
  }
}