import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const SIM_SERIAL_KEY = 'secure_sim_serial_hash';
const SIM_REGISTERED_KEY = '@kavach_sim_registered';

interface SIMInfo {
  serialNumber: string | null;
  carrierId: string | null;
  countryIso: string | null;
  simSlotIndex: number;
}

interface SIMServiceResult {
  success: boolean;
  simInfo?: SIMInfo;
  error?: string;
}

class SIMService {
  private mockMode: boolean = false;
  private mockSerialNumber: string = 'MOCK_SIM_12345678';

  async requestPhoneStatePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('SIMService: iOS not supported for SIM detection');
      return false;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: 'Phone State Permission',
          message: 'KAVACH needs access to your phone state for SIM verification to protect your account.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('SIMService: Permission request failed:', err);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE
      );
      return result;
    } catch {
      return false;
    }
  }

  enableMockMode(mockSerial?: string): void {
    this.mockMode = true;
    if (mockSerial) {
      this.mockSerialNumber = mockSerial;
    }
    console.log('SIMService: Mock mode enabled with serial:', this.mockSerialNumber);
  }

  disableMockMode(): void {
    this.mockMode = false;
    console.log('SIMService: Mock mode disabled');
  }

  async getCurrentSIMInfo(): Promise<SIMServiceResult> {
    if (this.mockMode) {
      return {
        success: true,
        simInfo: {
          serialNumber: this.mockSerialNumber,
          carrierId: 'Mock Carrier',
          countryIso: 'IN',
          simSlotIndex: 0,
        },
      };
    }

    if (Platform.OS !== 'android') {
      return {
        success: false,
        error: 'SIM detection is only supported on Android',
      };
    }

    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        const granted = await this.requestPhoneStatePermission();
        if (!granted) {
          return {
            success: false,
            error: 'Phone state permission not granted',
          };
        }
      }

      // Try to get SIM info from native module
      const { SimModule } = NativeModules;

      if (SimModule && SimModule.getSimSerialNumber) {
        const simInfo = await SimModule.getSimSerialNumber();
        return {
          success: true,
          simInfo: {
            serialNumber: simInfo.serialNumber || simInfo.subscriberId || simInfo.simId,
            carrierId: simInfo.carrierName,
            countryIso: simInfo.countryIso,
            simSlotIndex: simInfo.slotIndex || 0,
          },
        };
      }

      // Fallback: Use device ID as a proxy if native module not available
      // This is less reliable but works without native code changes
      const { DeviceInfo } = NativeModules;
      if (DeviceInfo && DeviceInfo.getDeviceId) {
        const deviceId = await DeviceInfo.getDeviceId();
        return {
          success: true,
          simInfo: {
            serialNumber: deviceId,
            carrierId: null,
            countryIso: null,
            simSlotIndex: 0,
          },
        };
      }

      // If no native modules available, use mock mode for development
      console.warn('SIMService: Native modules not available, using development mode');
      this.enableMockMode();
      return this.getCurrentSIMInfo();

    } catch (error) {
      console.error('SIMService: Error getting SIM info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async registerSIM(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.getCurrentSIMInfo();

      if (!result.success || !result.simInfo?.serialNumber) {
        return {
          success: false,
          error: result.error || 'Could not retrieve SIM information',
        };
      }

      // Hash the SIM serial number for security
      const simHash = CryptoJS.SHA256(result.simInfo.serialNumber).toString();

      // Store securely
      await SecureStore.setItemAsync(SIM_SERIAL_KEY, simHash);
      await AsyncStorage.setItem(SIM_REGISTERED_KEY, 'true');

      console.log('SIMService: SIM registered successfully');
      return { success: true };
    } catch (error) {
      console.error('SIMService: Error registering SIM:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register SIM',
      };
    }
  }

  async isSIMRegistered(): Promise<boolean> {
    try {
      const registered = await AsyncStorage.getItem(SIM_REGISTERED_KEY);
      const simHash = await SecureStore.getItemAsync(SIM_SERIAL_KEY);
      return registered === 'true' && !!simHash;
    } catch {
      return false;
    }
  }

  async verifySIM(): Promise<{ valid: boolean; changed: boolean; error?: string }> {
    try {
      const isRegistered = await this.isSIMRegistered();

      if (!isRegistered) {
        // SIM not registered yet, consider it valid (for new users)
        return { valid: true, changed: false };
      }

      const storedHash = await SecureStore.getItemAsync(SIM_SERIAL_KEY);
      if (!storedHash) {
        return { valid: true, changed: false };
      }

      const result = await this.getCurrentSIMInfo();

      if (!result.success || !result.simInfo?.serialNumber) {
        return {
          valid: false,
          changed: false,
          error: result.error || 'Could not retrieve current SIM information',
        };
      }

      const currentHash = CryptoJS.SHA256(result.simInfo.serialNumber).toString();
      const isMatch = currentHash === storedHash;

      if (!isMatch) {
        console.warn('SIMService: SIM CHANGE DETECTED!');
      }

      return {
        valid: isMatch,
        changed: !isMatch,
      };
    } catch (error) {
      console.error('SIMService: Error verifying SIM:', error);
      return {
        valid: false,
        changed: false,
        error: error instanceof Error ? error.message : 'SIM verification failed',
      };
    }
  }

  async clearSIMData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SIM_SERIAL_KEY);
      await AsyncStorage.removeItem(SIM_REGISTERED_KEY);
      console.log('SIMService: SIM data cleared');
    } catch (error) {
      console.error('SIMService: Error clearing SIM data:', error);
    }
  }
}

export const simService = new SIMService();
export default simService;
