/**
 * OTP Service for Real-time OTP Detection
 * Handles SMS OTP extraction, validation, and auto-fill
 */

import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsMonitor, SMSAnalysisResult } from './smsMonitor';

// OTP Patterns for different banks and services
const OTP_PATTERNS = {
  // Generic OTP patterns
  generic: [
    /\b(\d{4,8})\b.*(?:OTP|otp|Otp)/i,
    /(?:OTP|otp|Otp).*\b(\d{4,8})\b/i,
    /\b(\d{6})\b\s*is\s*(?:your|the)\s*(?:OTP|verification\s*code)/i,
    /(?:verification|security)\s*code\s*(?:is|:)?\s*(\d{4,8})/i,
    /(?:one.?time\s*password|OTP)\s*(?:is|:)?\s*(\d{4,8})/i,
  ],
  // Bank-specific patterns
  banks: [
    /(?:SBI|HDFC|ICICI|AXIS|KOTAK|PNB|BOB|CANARA)\s*OTP\s*(?:is|:)?\s*(\d{4,8})/i,
    /(?:transaction|txn)\s*OTP\s*(?:is|:)?\s*(\d{4,8})/i,
    /\b(\d{6})\b\s*for\s*(?:INR|Rs\.?|₹)\s*[\d,]+/i,
  ],
  // UPI patterns
  upi: [
    /UPI\s*(?:PIN|OTP)\s*(?:is|:)?\s*(\d{4,6})/i,
    /(?:BHIM|GPay|PhonePe|Paytm)\s*OTP\s*(?:is|:)?\s*(\d{4,8})/i,
  ],
  // E-commerce patterns
  ecommerce: [
    /(?:Amazon|Flipkart|Myntra|Swiggy|Zomato)\s*OTP\s*(?:is|:)?\s*(\d{4,6})/i,
  ],
};

// Trusted OTP senders
const TRUSTED_OTP_SENDERS = [
  'SBIBNK', 'HDFCBK', 'ICICIB', 'AXISBK', 'KOTAKB',
  'PNBSMS', 'BOBSMS', 'CANARA', 'UNIONB', 'IDBIBK',
  'PAYTM', 'GPAY', 'PHONPE', 'AMAZON', 'FKRT',
  'SWIGGY', 'ZOMATO', 'UBER', 'OLA',
  'VK-', 'VM-', 'AD-', 'BZ-', 'DM-', 'JD-', 'LM-',
];

// OTP types
export type OTPType = 'bank' | 'upi' | 'ecommerce' | 'generic' | 'unknown';

// OTP data structure
export interface ExtractedOTP {
  otp: string;
  sender: string;
  message: string;
  type: OTPType;
  timestamp: number;
  expiresAt: number;
  isTrusted: boolean;
  bankName?: string;
  amount?: string;
  transactionRef?: string;
}

// OTP callback types
type OTPReceivedCallback = (otp: ExtractedOTP) => void;
type OTPExpiredCallback = (otp: ExtractedOTP) => void;

// OTP validity duration (in milliseconds)
const OTP_VALIDITY_DURATION = 5 * 60 * 1000; // 5 minutes

class OTPService {
  private onOTPReceived: OTPReceivedCallback | null = null;
  private onOTPExpired: OTPExpiredCallback | null = null;
  private currentOTP: ExtractedOTP | null = null;
  private otpHistory: ExtractedOTP[] = [];
  private expirationTimer: NodeJS.Timeout | null = null;
  private isListening: boolean = false;

  constructor() {
    this.loadOTPHistory();
  }

  /**
   * Register callback for when OTP is received
   */
  onOTPReceivedCallback(callback: OTPReceivedCallback): void {
    this.onOTPReceived = callback;
  }

  /**
   * Register callback for when OTP expires
   */
  onOTPExpiredCallback(callback: OTPExpiredCallback): void {
    this.onOTPExpired = callback;
  }

  /**
   * Start listening for OTP SMS
   */
  async startListening(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[OTPService] OTP listening only available on Android');
      return false;
    }

    // Check SMS permissions
    const hasPermission = await smsMonitor.hasPermissions();
    if (!hasPermission) {
      const granted = await smsMonitor.requestPermissions();
      if (!granted) {
        console.log('[OTPService] SMS permissions not granted');
        return false;
      }
    }

    // Register SMS callback to detect OTPs
    smsMonitor.onSMSReceivedCallback((message, analysis) => {
      this.processSMSForOTP(message.body, message.address, analysis);
    });

    this.isListening = true;
    console.log('[OTPService] Started listening for OTPs');
    return true;
  }

  /**
   * Stop listening for OTPs
   */
  stopListening(): void {
    this.isListening = false;
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
    console.log('[OTPService] Stopped listening for OTPs');
  }

  /**
   * Extract OTP from a message
   */
  extractOTP(message: string, sender: string): ExtractedOTP | null {
    let extractedOTP: string | null = null;
    let otpType: OTPType = 'unknown';

    // Try bank patterns first
    for (const pattern of OTP_PATTERNS.banks) {
      const match = message.match(pattern);
      if (match && match[1]) {
        extractedOTP = match[1];
        otpType = 'bank';
        break;
      }
    }

    // Try UPI patterns
    if (!extractedOTP) {
      for (const pattern of OTP_PATTERNS.upi) {
        const match = message.match(pattern);
        if (match && match[1]) {
          extractedOTP = match[1];
          otpType = 'upi';
          break;
        }
      }
    }

    // Try e-commerce patterns
    if (!extractedOTP) {
      for (const pattern of OTP_PATTERNS.ecommerce) {
        const match = message.match(pattern);
        if (match && match[1]) {
          extractedOTP = match[1];
          otpType = 'ecommerce';
          break;
        }
      }
    }

    // Try generic patterns
    if (!extractedOTP) {
      for (const pattern of OTP_PATTERNS.generic) {
        const match = message.match(pattern);
        if (match && match[1]) {
          extractedOTP = match[1];
          otpType = 'generic';
          break;
        }
      }
    }

    if (!extractedOTP) {
      return null;
    }

    // Extract additional info
    const amount = this.extractAmount(message);
    const bankName = this.extractBankName(message, sender);
    const transactionRef = this.extractTransactionRef(message);

    const now = Date.now();
    return {
      otp: extractedOTP,
      sender,
      message,
      type: otpType,
      timestamp: now,
      expiresAt: now + OTP_VALIDITY_DURATION,
      isTrusted: this.isTrustedSender(sender),
      bankName,
      amount,
      transactionRef,
    };
  }

  /**
   * Process SMS message to extract OTP
   */
  private processSMSForOTP(
    message: string,
    sender: string,
    analysis: SMSAnalysisResult | null
  ): void {
    // Check if this is likely an OTP message
    if (!this.isOTPMessage(message)) {
      return;
    }

    // Extract OTP
    const extractedOTP = this.extractOTP(message, sender);
    if (!extractedOTP) {
      return;
    }

    // Check for fraud
    if (analysis?.analysis?.isFraud && analysis.analysis.fraudScore > 70) {
      console.log('[OTPService] Suspicious OTP message detected, flagging...');
      extractedOTP.isTrusted = false;
    }

    // Store OTP
    this.currentOTP = extractedOTP;
    this.otpHistory.unshift(extractedOTP);
    this.saveOTPHistory();

    // Set expiration timer
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
    }
    this.expirationTimer = setTimeout(() => {
      if (this.currentOTP && this.currentOTP.otp === extractedOTP.otp) {
        if (this.onOTPExpired) {
          this.onOTPExpired(extractedOTP);
        }
        this.currentOTP = null;
      }
    }, OTP_VALIDITY_DURATION);

    // Trigger callback
    if (this.onOTPReceived) {
      this.onOTPReceived(extractedOTP);
    }

    console.log('[OTPService] OTP extracted:', extractedOTP.otp, 'Type:', extractedOTP.type);
  }

  /**
   * Check if message contains OTP
   */
  private isOTPMessage(message: string): boolean {
    const otpKeywords = [
      'otp', 'one time', 'verification code', 'security code',
      'pin', 'password', 'cvv', 'secret code', 'auth code',
    ];

    const lowerMessage = message.toLowerCase();
    return otpKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Check if sender is trusted
   */
  private isTrustedSender(sender: string): boolean {
    const upperSender = sender.toUpperCase();
    return TRUSTED_OTP_SENDERS.some(trusted =>
      upperSender.includes(trusted) || upperSender.startsWith(trusted)
    );
  }

  /**
   * Extract amount from message
   */
  private extractAmount(message: string): string | undefined {
    const amountPatterns = [
      /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{2})?)/i,
      /([\d,]+(?:\.\d{2})?)\s*(?:INR|Rs\.?|₹)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/,/g, '');
      }
    }
    return undefined;
  }

  /**
   * Extract bank name from message or sender
   */
  private extractBankName(message: string, sender: string): string | undefined {
    const banks = [
      { pattern: /SBI|State Bank/i, name: 'SBI' },
      { pattern: /HDFC/i, name: 'HDFC Bank' },
      { pattern: /ICICI/i, name: 'ICICI Bank' },
      { pattern: /AXIS/i, name: 'Axis Bank' },
      { pattern: /KOTAK/i, name: 'Kotak Bank' },
      { pattern: /PNB|Punjab National/i, name: 'PNB' },
      { pattern: /BOB|Bank of Baroda/i, name: 'Bank of Baroda' },
      { pattern: /CANARA/i, name: 'Canara Bank' },
      { pattern: /UNION/i, name: 'Union Bank' },
      { pattern: /IDBI/i, name: 'IDBI Bank' },
      { pattern: /YES/i, name: 'Yes Bank' },
      { pattern: /PAYTM/i, name: 'Paytm' },
      { pattern: /GPAY|Google Pay/i, name: 'Google Pay' },
      { pattern: /PHONEPE/i, name: 'PhonePe' },
    ];

    const combinedText = `${message} ${sender}`;
    for (const bank of banks) {
      if (bank.pattern.test(combinedText)) {
        return bank.name;
      }
    }
    return undefined;
  }

  /**
   * Extract transaction reference from message
   */
  private extractTransactionRef(message: string): string | undefined {
    const refPatterns = [
      /(?:Ref|Reference|Txn|Transaction)\s*(?:No\.?|ID|#)?\s*:?\s*([A-Z0-9]+)/i,
      /(?:UTR|IMPS|NEFT|RTGS)\s*(?:No\.?|ID|#)?\s*:?\s*([A-Z0-9]+)/i,
    ];

    for (const pattern of refPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Get current OTP if valid
   */
  getCurrentOTP(): ExtractedOTP | null {
    if (this.currentOTP && Date.now() < this.currentOTP.expiresAt) {
      return this.currentOTP;
    }
    return null;
  }

  /**
   * Get OTP history
   */
  getOTPHistory(): ExtractedOTP[] {
    return this.otpHistory;
  }

  /**
   * Clear current OTP (after use)
   */
  clearCurrentOTP(): void {
    this.currentOTP = null;
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  /**
   * Manually submit OTP for analysis
   */
  async analyzeOTPMessage(message: string, sender: string): Promise<{
    otp: ExtractedOTP | null;
    isFraud: boolean;
    fraudScore: number;
    recommendation: string;
  }> {
    // Analyze with SMS fraud detection
    const analysis = await smsMonitor.analyzeSMS(message, sender);

    // Extract OTP
    const otp = this.extractOTP(message, sender);

    return {
      otp,
      isFraud: analysis?.analysis?.isFraud || false,
      fraudScore: analysis?.analysis?.fraudScore || 0,
      recommendation: analysis?.analysis?.recommendation || 'Unable to analyze',
    };
  }

  /**
   * Load OTP history from storage
   */
  private async loadOTPHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@otp_history');
      if (stored) {
        const data = JSON.parse(stored);
        // Filter out expired OTPs older than 24 hours
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.otpHistory = data.filter((otp: ExtractedOTP) => otp.timestamp > dayAgo);
      }
    } catch (error) {
      console.error('[OTPService] Load history error:', error);
    }
  }

  /**
   * Save OTP history to storage
   */
  private async saveOTPHistory(): Promise<void> {
    try {
      // Keep only last 50 OTPs
      const toStore = this.otpHistory.slice(0, 50);
      await AsyncStorage.setItem('@otp_history', JSON.stringify(toStore));
    } catch (error) {
      console.error('[OTPService] Save history error:', error);
    }
  }

  /**
   * Clear all OTP history
   */
  async clearHistory(): Promise<void> {
    this.otpHistory = [];
    this.currentOTP = null;
    await AsyncStorage.removeItem('@otp_history');
  }
}

// Export singleton instance
export const otpService = new OTPService();

// Export types and class
export { OTPService };
