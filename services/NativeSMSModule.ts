/**
 * Native SMS Module Bridge
 *
 * This module bridges the native Android SMS functionality to React Native.
 * It handles:
 * - Permission management
 * - Reading SMS from device
 * - Listening for real-time SMS events
 * - Starting/stopping background monitoring
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import { realTimeSMSMonitor, IncomingSMS, FraudAnalysis } from './RealTimeSMSMonitor';

// Native module interface
interface NativeSMSModuleInterface {
  checkPermissions(): Promise<{
    readSms: boolean;
    receiveSms: boolean;
    allGranted: boolean;
  }>;
  getRecentSMS(count: number): Promise<Array<{
    id: string;
    sender: string;
    body: string;
    timestamp: number;
    read: boolean;
  }>>;
  startMonitoring(): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
}

// Get native module (will be null in Expo Go)
const NativeSMS: NativeSMSModuleInterface | null =
  Platform.OS === 'android' ? NativeModules.SMSModule : null;

// Event emitter for native events
let smsEventEmitter: NativeEventEmitter | null = null;
if (NativeSMS) {
  smsEventEmitter = new NativeEventEmitter(NativeModules.SMSModule);
}

// Callback types
type SMSCallback = (sms: IncomingSMS) => void;
type AnalysisCallback = (sms: IncomingSMS, analysis: FraudAnalysis) => void;

class NativeSMSModule {
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private useMockMode: boolean = false;
  private mockInterval: NodeJS.Timeout | null = null;

  private onSMSReceivedCallbacks: SMSCallback[] = [];
  private onAnalysisCompleteCallbacks: AnalysisCallback[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    // Check if native module is available
    if (!NativeSMS) {
      console.log('[NativeSMS] Native module not available, using mock mode');
      this.useMockMode = true;
    } else {
      console.log('[NativeSMS] Native module available');
      this.setupNativeEventListeners();
    }

    this.isInitialized = true;
  }

  private setupNativeEventListeners() {
    if (!smsEventEmitter) return;

    // Listen for incoming SMS
    smsEventEmitter.addListener('onSMSReceived', async (data: any) => {
      console.log('[NativeSMS] SMS received from native:', data.sender);

      const sms: IncomingSMS = {
        id: data.id,
        sender: data.sender,
        body: data.body,
        timestamp: data.timestamp
      };

      // Notify callbacks
      this.onSMSReceivedCallbacks.forEach(cb => cb(sms));

      // Process through fraud detection
      const record = await realTimeSMSMonitor.processIncomingSMS(sms);

      // Notify analysis callbacks
      this.onAnalysisCompleteCallbacks.forEach(cb => cb(sms, record.analysis));
    });

    // Listen for analysis complete (from background service)
    smsEventEmitter.addListener('onSMSAnalysisComplete', (data: any) => {
      console.log('[NativeSMS] Analysis complete from native:', data.riskLevel);

      const sms: IncomingSMS = {
        id: String(data.timestamp),
        sender: data.sender,
        body: data.body,
        timestamp: data.timestamp
      };

      const analysis: FraudAnalysis = {
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        isFraud: data.riskLevel === 'danger',
        reasons: [],
        urlsFound: [],
        otpDetected: data.otpDetected,
        amountMentioned: null,
        senderTrusted: false,
        recommendation: '',
        analysisTime: 0
      };

      this.onAnalysisCompleteCallbacks.forEach(cb => cb(sms, analysis));
    });
  }

  /**
   * Request SMS permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[NativeSMS] SMS only available on Android');
      return false;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      const readGranted = granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
      const receiveGranted = granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

      console.log('[NativeSMS] Permissions:', { readGranted, receiveGranted });

      return readGranted && receiveGranted;
    } catch (error) {
      console.error('[NativeSMS] Permission error:', error);
      return false;
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<{ readSms: boolean; receiveSms: boolean; allGranted: boolean }> {
    if (this.useMockMode) {
      return { readSms: true, receiveSms: true, allGranted: true };
    }

    if (!NativeSMS) {
      return { readSms: false, receiveSms: false, allGranted: false };
    }

    try {
      return await NativeSMS.checkPermissions();
    } catch (error) {
      console.error('[NativeSMS] Check permissions error:', error);
      return { readSms: false, receiveSms: false, allGranted: false };
    }
  }

  /**
   * Get recent SMS messages
   */
  async getRecentSMS(count: number = 50): Promise<IncomingSMS[]> {
    if (this.useMockMode) {
      return this.getMockSMS();
    }

    if (!NativeSMS) {
      console.log('[NativeSMS] Native module not available');
      return [];
    }

    try {
      const messages = await NativeSMS.getRecentSMS(count);
      return messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        body: msg.body,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      console.error('[NativeSMS] Get SMS error:', error);
      return [];
    }
  }

  /**
   * Start real-time monitoring
   */
  async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      console.log('[NativeSMS] Already monitoring');
      return true;
    }

    if (this.useMockMode) {
      console.log('[NativeSMS] Starting mock monitoring');
      this.startMockMonitoring();
      this.isMonitoring = true;
      realTimeSMSMonitor.startMonitoring();
      return true;
    }

    if (!NativeSMS) {
      return false;
    }

    try {
      const result = await NativeSMS.startMonitoring();
      this.isMonitoring = result;
      if (result) {
        realTimeSMSMonitor.startMonitoring();
      }
      return result;
    } catch (error) {
      console.error('[NativeSMS] Start monitoring error:', error);
      return false;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<boolean> {
    if (!this.isMonitoring) {
      return true;
    }

    if (this.useMockMode) {
      this.stopMockMonitoring();
      this.isMonitoring = false;
      realTimeSMSMonitor.stopMonitoring();
      return true;
    }

    if (!NativeSMS) {
      return false;
    }

    try {
      const result = await NativeSMS.stopMonitoring();
      this.isMonitoring = !result;
      realTimeSMSMonitor.stopMonitoring();
      return result;
    } catch (error) {
      console.error('[NativeSMS] Stop monitoring error:', error);
      return false;
    }
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Check if using mock mode
   */
  isMockMode(): boolean {
    return this.useMockMode;
  }

  /**
   * Register callback for SMS received
   */
  onSMSReceived(callback: SMSCallback): () => void {
    this.onSMSReceivedCallbacks.push(callback);
    return () => {
      const index = this.onSMSReceivedCallbacks.indexOf(callback);
      if (index > -1) {
        this.onSMSReceivedCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for analysis complete
   */
  onAnalysisComplete(callback: AnalysisCallback): () => void {
    this.onAnalysisCompleteCallbacks.push(callback);
    return () => {
      const index = this.onAnalysisCompleteCallbacks.indexOf(callback);
      if (index > -1) {
        this.onAnalysisCompleteCallbacks.splice(index, 1);
      }
    };
  }

  // ============================================
  // Mock Mode Functions
  // ============================================

  private getMockSMS(): IncomingSMS[] {
    const now = Date.now();
    return [
      {
        id: '1',
        sender: 'AD-SCAM',
        body: 'URGENT! Your HDFC Bank account will be blocked within 24 hours. Share OTP immediately: http://bit.ly/verify123 or face legal action.',
        timestamp: now - 3600000
      },
      {
        id: '2',
        sender: 'LOTTERY',
        body: 'Dear customer, your KYC has expired. Update immediately at http://bit.ly/kyc-update or your account will be suspended. Share OTP: 456789',
        timestamp: now - 7200000
      },
      {
        id: '3',
        sender: 'VM-HDFC',
        body: 'Rs. 500.00 debited from A/c XX1234 on 03-Dec-24 via UPI/GooglePay. Avl Bal: Rs. 12500.00 -HDFC Bank',
        timestamp: now - 21600000
      },
      {
        id: '4',
        sender: 'AX-ICICI',
        body: 'Rs. 2500.00 credited to A/c XX5678 on 03-Dec-24. Transaction: NEFT from John Doe. Available Balance: Rs. 25000.00 -ICICI Bank',
        timestamp: now - 25200000
      },
      {
        id: '5',
        sender: '9876543210',
        body: 'Congratulations! You are selected as lucky winner of Rs. 100000 lottery. Call now to claim your prize. Limited time offer!',
        timestamp: now - 14400000
      }
    ];
  }

  private startMockMonitoring() {
    // Simulate random incoming SMS every 30-60 seconds
    const mockMessages = [
      {
        sender: 'VK-FRAUD',
        body: 'Your account has been compromised! Click http://secure-bank.fake.com to verify. Enter OTP to continue.',
      },
      {
        sender: 'VM-PAYTM',
        body: 'Payment of Rs. 150 to Amazon successful via Paytm UPI. Balance: Rs. 4850.',
      },
      {
        sender: 'PRIZE-WIN',
        body: 'You won Rs 50,00,000! Claim now at bit.ly/prize. Share card details for verification.',
      },
      {
        sender: 'AD-AXIS',
        body: 'Rs. 1000.00 debited from A/c XX9876 for electricity bill. Avl Bal: Rs. 8500.00',
      },
      {
        sender: '+919999888777',
        body: 'URGENT: Your SBI account KYC expired. Update immediately at http://sbi-kyc.xyz or account will be blocked in 2 hours!',
      }
    ];

    const sendMockSMS = () => {
      const randomMsg = mockMessages[Math.floor(Math.random() * mockMessages.length)];
      const sms: IncomingSMS = {
        id: String(Date.now()),
        sender: randomMsg.sender,
        body: randomMsg.body,
        timestamp: Date.now()
      };

      console.log('[NativeSMS] Mock SMS received:', sms.sender);

      // Trigger callbacks
      this.onSMSReceivedCallbacks.forEach(cb => cb(sms));

      // Process through fraud detection
      realTimeSMSMonitor.processIncomingSMS(sms).then(record => {
        this.onAnalysisCompleteCallbacks.forEach(cb => cb(sms, record.analysis));
      });

      // Schedule next mock SMS
      const delay = 30000 + Math.random() * 30000; // 30-60 seconds
      this.mockInterval = setTimeout(sendMockSMS, delay);
    };

    // Start sending mock SMS after initial delay
    this.mockInterval = setTimeout(sendMockSMS, 10000);
  }

  private stopMockMonitoring() {
    if (this.mockInterval) {
      clearTimeout(this.mockInterval);
      this.mockInterval = null;
    }
  }
}

// Export singleton
export const nativeSMSModule = new NativeSMSModule();
export default nativeSMSModule;
