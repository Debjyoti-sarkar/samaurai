import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

/*------------------------------------------------------------------
  SECURE PIN
------------------------------------------------------------------*/
const PIN_KEY = "secure_pin_hash";

export async function saveSecurePin(pin: string) {
  const hash = CryptoJS.SHA256(pin).toString();
  await SecureStore.setItemAsync(PIN_KEY, hash);
}

export async function verifySecurePin(pin: string) {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  return CryptoJS.SHA256(pin).toString() === stored;
}

/*------------------------------------------------------------------
  SECURE BIOMETRIC FLAG
------------------------------------------------------------------*/
const BIO_KEY = "secure_biometric_flag";

export async function saveBiometricFlag(enabled: boolean) {
  await SecureStore.setItemAsync(BIO_KEY, enabled ? "1" : "0");
}

export async function isBiometricEnabledSecure() {
  const v = await SecureStore.getItemAsync(BIO_KEY);
  return v === "1";
}

/*------------------------------------------------------------------
  SECURE CUSTOM FACE FLAG
------------------------------------------------------------------*/
const CUSTOM_FACE_KEY = "secure_custom_face_flag";
const CUSTOM_FACE_ENROLLED_KEY = "secure_custom_face_enrolled_flag";

export async function saveCustomFaceFlag(enabled: boolean) {
  await SecureStore.setItemAsync(CUSTOM_FACE_KEY, enabled ? "1" : "0");
}

export async function isCustomFaceEnabledSecure() {
  const v = await SecureStore.getItemAsync(CUSTOM_FACE_KEY);
  return v === "1";
}

export async function saveCustomFaceEnrolledFlag(enrolled: boolean) {
  await SecureStore.setItemAsync(
    CUSTOM_FACE_ENROLLED_KEY,
    enrolled ? "1" : "0",
  );
}

export async function isCustomFaceEnrolledSecure() {
  const v = await SecureStore.getItemAsync(CUSTOM_FACE_ENROLLED_KEY);
  return v === "1";
}

/*------------------------------------------------------------------
  SECURE AADHAAR TOKEN
------------------------------------------------------------------*/
const AADHAAR_KEY = "aadhaar_token_secure";

export async function saveAadhaar(aadhaar: string) {
  const token = CryptoJS.SHA256(aadhaar).toString();
  await SecureStore.setItemAsync(AADHAAR_KEY, token);
}

export async function isAadhaarLinkedSecure() {
  const token = await SecureStore.getItemAsync(AADHAAR_KEY);
  return !!token;
}

/*------------------------------------------------------------------
  SECURE SIM SERIAL
------------------------------------------------------------------*/
const SIM_SERIAL_KEY = "secure_sim_serial_hash";
const SIM_REGISTERED_KEY = "@kavach_sim_registered";

export async function saveSIMSerial(serialNumber: string) {
  const hash = CryptoJS.SHA256(serialNumber).toString();
  await SecureStore.setItemAsync(SIM_SERIAL_KEY, hash);
  await AsyncStorage.setItem(SIM_REGISTERED_KEY, "true");
}

export async function getSIMSerialHash() {
  return await SecureStore.getItemAsync(SIM_SERIAL_KEY);
}

export async function isSIMRegistered() {
  const registered = await AsyncStorage.getItem(SIM_REGISTERED_KEY);
  const hash = await SecureStore.getItemAsync(SIM_SERIAL_KEY);
  return registered === "true" && !!hash;
}

export async function verifySIMSerial(currentSerial: string) {
  const storedHash = await SecureStore.getItemAsync(SIM_SERIAL_KEY);
  if (!storedHash) return true; // Not registered yet
  const currentHash = CryptoJS.SHA256(currentSerial).toString();
  return currentHash === storedHash;
}

/*------------------------------------------------------------------
  WIPE ALL APP DATA (Called on SIM change detection)
------------------------------------------------------------------*/
const ALL_SECURE_KEYS = [
  PIN_KEY,
  BIO_KEY,
  CUSTOM_FACE_KEY,
  CUSTOM_FACE_ENROLLED_KEY,
  AADHAAR_KEY,
  SIM_SERIAL_KEY,
];

const ALL_ASYNC_STORAGE_KEYS = [
  "@kavach_auth",
  "@kavach_user",
  "@kavach_onboarding",
  SIM_REGISTERED_KEY,
  "@kavach_session",
  "@kavach_fraud_records",
  "@kavach_dashboard_stats",
  "@kavach_behavior_logs",
];

export async function wipeAllAppData(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log("🚨 WIPING ALL APP DATA DUE TO SIM CHANGE...");

    // Clear all SecureStore items
    for (const key of ALL_SECURE_KEYS) {
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`✓ Cleared SecureStore key: ${key}`);
      } catch (e) {
        console.warn(`Failed to clear SecureStore key ${key}:`, e);
      }
    }

    // Clear all AsyncStorage items
    for (const key of ALL_ASYNC_STORAGE_KEYS) {
      try {
        await AsyncStorage.removeItem(key);
        console.log(`✓ Cleared AsyncStorage key: ${key}`);
      } catch (e) {
        console.warn(`Failed to clear AsyncStorage key ${key}:`, e);
      }
    }

    // Also clear all AsyncStorage (nuclear option for any remaining data)
    try {
      await AsyncStorage.clear();
      console.log("✓ Cleared all AsyncStorage");
    } catch (e) {
      console.warn("Failed to clear all AsyncStorage:", e);
    }

    console.log("✅ ALL APP DATA WIPED SUCCESSFULLY");
    return { success: true };
  } catch (error) {
    console.error("❌ Error wiping app data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to wipe app data",
    };
  }
}
