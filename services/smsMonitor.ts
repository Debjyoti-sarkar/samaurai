/**
 * SMS Monitor Service for React Native
 * Monitors incoming SMS messages and checks for fraud
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'http://172.16.10.100:3001/api/sms';

// Types
export interface SMSMessage {
  id: string;
  address: string; // Sender
  body: string;
  date: number;
  read: boolean;
  type: string;
}

export interface SMSAnalysisResult {
  success: boolean;
  alertId?: string;
  analysis: {
    isFraud: boolean;
    fraudScore: number;
    riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    categories: Array<{ name: string; score: number }>;
    riskFactors: Array<{ category: string; description: string; weight: number }>;
    urlsFound: string[];
    phoneNumbersFound: string[];
    otpDetected: boolean;
    amountMentioned: string | null;
    senderTrusted: boolean;
    recommendation: string;
  };
  shouldShowAlert: boolean;
  alertType: 'danger' | 'warning' | 'caution' | 'info';
}

export interface SMSFraudAlert {
  alertId: string;
  sender: string;
  preview: string;
  fraudScore: number;
  riskLevel: string;
  isFraud: boolean;
  otpDetected: boolean;
  recommendation: string;
  userAction: string;
  createdAt: string;
}

// Event callback types
type SMSReceivedCallback = (message: SMSMessage, analysis: SMSAnalysisResult) => void;
type FraudDetectedCallback = (message: SMSMessage, analysis: SMSAnalysisResult) => void;

class SMSMonitorService {
  private userId: string | null = null;
  private isMonitoring: boolean = false;
  private onSMSReceived: SMSReceivedCallback | null = null;
  private onFraudDetected: FraudDetectedCallback | null = null;
  private processedMessages: Set<string> = new Set();
  private lastCheckTime: number = Date.now();

  constructor() {
    this.loadProcessedMessages();
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Register callback for SMS received
   */
  onSMSReceivedCallback(callback: SMSReceivedCallback): void {
    this.onSMSReceived = callback;
  }

  /**
   * Register callback for fraud detected
   */
  onFraudDetectedCallback(callback: FraudDetectedCallback): void {
    this.onFraudDetected = callback;
  }

  /**
   * Request SMS permissions (Android only)
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[SMSMonitor] SMS reading only available on Android');
      return false;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'KAVACH needs to read SMS to detect fraud messages and protect you from scams.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      const receiveSmsGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'Receive SMS Permission',
          message: 'KAVACH needs to receive SMS notifications to detect fraud in real-time.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return (
        granted === PermissionsAndroid.RESULTS.GRANTED &&
        receiveSmsGranted === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.error('[SMSMonitor] Permission error:', err);
      return false;
    }
  }

  /**
   * Check if SMS permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const readSms = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      const receiveSms = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      );
      return readSms && receiveSms;
    } catch {
      return false;
    }
  }

  /**
   * Analyze a single SMS message
   */
  async analyzeSMS(message: string, sender?: string): Promise<SMSAnalysisResult | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sender,
          userId: this.userId,
          saveAlert: true,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('[SMSMonitor] Analysis error:', error);
      return null;
    }
  }

  /**
   * Analyze multiple SMS messages
   */
  async analyzeBatch(messages: SMSMessage[]): Promise<{
    fraudMessages: Array<{ id: string; sender: string; preview: string; analysis: any }>;
  } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            id: m.id,
            message: m.body,
            sender: m.address,
          })),
          userId: this.userId,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('[SMSMonitor] Batch analysis error:', error);
      return null;
    }
  }

  /**
   * Process a newly received SMS
   */
  async processIncomingSMS(message: SMSMessage): Promise<SMSAnalysisResult | null> {
    // Skip if already processed
    if (this.processedMessages.has(message.id)) {
      return null;
    }

    // Analyze the message
    const analysis = await this.analyzeSMS(message.body, message.address);

    if (analysis) {
      // Mark as processed
      this.processedMessages.add(message.id);
      await this.saveProcessedMessages();

      // Trigger callbacks
      if (this.onSMSReceived) {
        this.onSMSReceived(message, analysis);
      }

      if (analysis.shouldShowAlert && this.onFraudDetected) {
        this.onFraudDetected(message, analysis);
      }

      return analysis;
    }

    return null;
  }

  /**
   * Get SMS fraud alerts for user
   */
  async getAlerts(limit: number = 50): Promise<SMSFraudAlert[] | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(
        `${API_BASE_URL}/alerts/${this.userId}?limit=${limit}`
      );

      const result = await response.json();
      return result.success ? result.alerts : null;
    } catch (error) {
      console.error('[SMSMonitor] Get alerts error:', error);
      return null;
    }
  }

  /**
   * Get detailed alert information
   */
  async getAlertDetails(alertId: string): Promise<any | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/alert/${alertId}`);
      const result = await response.json();
      return result.success ? result.alert : null;
    } catch (error) {
      console.error('[SMSMonitor] Get alert details error:', error);
      return null;
    }
  }

  /**
   * Report an SMS as spam/fraud
   */
  async reportSpam(message: string, sender?: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/report-spam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sender,
          userId: this.userId,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('[SMSMonitor] Report spam error:', error);
      return false;
    }
  }

  /**
   * Update action on an alert
   */
  async updateAlertAction(
    alertId: string,
    action: 'dismissed' | 'reported' | 'blocked_sender',
    feedback?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/alert/${alertId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('[SMSMonitor] Update action error:', error);
      return false;
    }
  }

  /**
   * Check sender reputation
   */
  async checkSender(sender: string): Promise<{
    isTrusted: boolean;
    reputation: string;
    fraudAlerts: number;
    userReports: number;
  } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/check-sender/${encodeURIComponent(sender)}`
      );

      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error('[SMSMonitor] Check sender error:', error);
      return null;
    }
  }

  /**
   * Get SMS fraud statistics
   */
  async getStatistics(days: number = 30): Promise<any | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(
        `${API_BASE_URL}/statistics/${this.userId}?days=${days}`
      );

      const result = await response.json();
      return result.success ? result.statistics : null;
    } catch (error) {
      console.error('[SMSMonitor] Get statistics error:', error);
      return null;
    }
  }

  /**
   * Load processed message IDs from storage
   */
  private async loadProcessedMessages(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@sms_processed');
      if (stored) {
        const data = JSON.parse(stored);
        this.processedMessages = new Set(data.ids || []);
        this.lastCheckTime = data.lastCheck || Date.now();
      }
    } catch (error) {
      console.error('[SMSMonitor] Load processed messages error:', error);
    }
  }

  /**
   * Save processed message IDs to storage
   */
  private async saveProcessedMessages(): Promise<void> {
    try {
      // Keep only last 1000 message IDs
      const ids = Array.from(this.processedMessages).slice(-1000);

      await AsyncStorage.setItem(
        '@sms_processed',
        JSON.stringify({
          ids,
          lastCheck: Date.now(),
        })
      );
    } catch (error) {
      console.error('[SMSMonitor] Save processed messages error:', error);
    }
  }

  /**
   * Clear processed messages cache
   */
  async clearCache(): Promise<void> {
    this.processedMessages.clear();
    await AsyncStorage.removeItem('@sms_processed');
  }
}

// Export singleton instance
export const smsMonitor = new SMSMonitorService();

// Export types and class
export { SMSMonitorService };
