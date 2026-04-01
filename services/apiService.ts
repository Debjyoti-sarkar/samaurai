import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  if (!__DEV__) return 'https://your-production-api.com/api';

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  const ip = hostUri ? hostUri.split(':')[0] : (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${ip}:5000/api`;
};

const BASE_URL = getBackendUrl();
const ENABLE_OTP_BYPASS = false; // Re-enabled OTP verification for production use

export const apiService = {
  async sendOTP(phone: string) {
    if (ENABLE_OTP_BYPASS) {
      console.log("🛠️ [DEV] OTP sending bypassed for:", phone);
      return { success: true, message: "Bypassed OTP sending" };
    }

    const response = await fetch(`${BASE_URL}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send OTP');
    }

    return data;
  },

  async verifyOTP(phone: string, otp: string) {
    const isBypassCode = otp === '000000' || otp === '123456' || otp === '0000' || otp === '1111';
    if (ENABLE_OTP_BYPASS && isBypassCode && __DEV__) {
      console.log("🟢 [KAVACH BYPASS] OTP verification intercepted for:", phone, "with code:", otp);
      return { success: true, message: "Bypassed OTP verification" };
    }

    const response = await fetch(`${BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, code: otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Verification failed');
    }

    return data;
  },
};