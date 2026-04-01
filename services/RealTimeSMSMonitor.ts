/**
 * Real-Time SMS Fraud Detection Monitor
 *
 * Flow:
 * 1. SMS ARRIVES → Android broadcasts SMS_RECEIVED
 * 2. Background service captures it (Foreground Service)
 * 3. Extract: {body, sender, timestamp}
 * 4. Run fraud detection (~500ms)
 * 5. Calculate risk score (0-100%)
 * 6. Decision tree based on score
 * 7. Store in local database
 * 8. Update dashboard statistics
 * 9. If link present → Register as click interceptor
 */

import { Platform, NativeModules, NativeEventEmitter, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

// Types
export interface IncomingSMS {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  simSlot?: number;
}

export interface FraudAnalysis {
  riskScore: number;
  riskLevel: 'safe' | 'warning' | 'danger';
  isFraud: boolean;
  reasons: string[];
  urlsFound: string[];
  otpDetected: boolean;
  amountMentioned: string | null;
  senderTrusted: boolean;
  recommendation: string;
  analysisTime: number;
}

export interface SMSFraudRecord {
  id: string;
  sms: IncomingSMS;
  analysis: FraudAnalysis;
  userAction: 'pending' | 'dismissed' | 'reported' | 'blocked';
  createdAt: number;
}

export interface DashboardStats {
  totalScanned: number;
  safeCount: number;
  warningCount: number;
  dangerCount: number;
  blockedUrls: number;
  lastScanTime: number | null;
  todayScanned: number;
  weeklyTrend: number[];
}

// Fraud Detection Patterns
const FRAUD_PATTERNS = {
  // CRITICAL - Instant high risk (80+ score)
  criticalKeywords: [
    'share otp', 'send otp', 'provide otp', 'enter otp', 'give otp',
    'share pin', 'send pin', 'provide pin', 'enter pin',
    'share password', 'send password', 'cvv', 'card details',
    'share cvv', 'enter cvv', 'card number', 'expiry date'
  ],

  // HIGH RISK - Major fraud indicators (20+ each)
  highRiskKeywords: [
    'urgent', 'immediately', 'suspended', 'blocked', 'expire',
    'verify immediately', 'click here', 'confirm now', 'update required',
    'verify account', 'account suspended', 'account blocked',
    'kyc pending', 'kyc expired', 'update kyc', 'reverify kyc',
    'complete kyc', 'kyc verification required', 'kyc failed'
  ],

  // MEDIUM RISK - Scam indicators (15 each)
  mediumRiskKeywords: [
    'congratulations', 'won', 'lottery', 'prize', 'reward', 'claim now',
    'selected winner', 'lucky draw', 'lucky winner', 'claim prize',
    'income tax', 'tax refund', 'government', 'police', 'court', 'arrest',
    'legal action', 'warrant', 'rbi', 'sebi', 'customs',
    'deactivate', 'terminate', 'penalty', 'fine', 'legal notice'
  ],

  // Urgency words (10 each)
  urgencyWords: [
    'immediately', 'urgent', 'within 24 hours', 'within 2 hours',
    'today only', 'last chance', 'expiring soon', 'act now',
    'limited time', 'hurry', 'quick', 'asap', 'right now'
  ],

  // Suspicious URL patterns
  suspiciousUrlPatterns: [
    'bit.ly', 'tinyurl', 'short.link', 'cutt.ly', 'goo.gl',
    'ow.ly', 't.co', 'is.gd', 'v.gd', 'rb.gy'
  ],

  // Legitimate bank sender patterns
  trustedSenderPatterns: [
    /^(VM|VD|VK|AD|AX|BZ|HP|JM|MD|TD)-[A-Z]{4,6}$/i,
    /^[A-Z]{2}-HDFC$/i,
    /^[A-Z]{2}-ICICI$/i,
    /^[A-Z]{2}-SBI$/i,
    /^[A-Z]{2}-AXIS$/i,
    /^[A-Z]{2}-PAYTM$/i,
    /^[A-Z]{2}-GPAY$/i,
    /^[A-Z]{2}-PHONEPE$/i
  ],

  // Transaction notification patterns (SAFE indicators)
  transactionPatterns: [
    /(debited|credited).*₹/i,
    /₹.*\d+.*(debited|credited)/i,
    /(debited|credited).*rs\.?\s*\d+/i,
    /rs\.?\s*\d+.*(debited|credited)/i,
    /balance.*₹/i,
    /avl.*bal/i,
    /payment.*successful/i,
    /transaction.*completed/i
  ]
};

// Storage keys
const STORAGE_KEYS = {
  FRAUD_RECORDS: '@kavach_fraud_records',
  DASHBOARD_STATS: '@kavach_dashboard_stats',
  BLOCKED_SENDERS: '@kavach_blocked_senders',
  TRUSTED_SENDERS: '@kavach_trusted_senders',
  SETTINGS: '@kavach_sms_settings'
};

class RealTimeSMSMonitor {
  private isMonitoring: boolean = false;
  private appState: AppStateStatus = 'active';
  private eventEmitter: NativeEventEmitter | null = null;
  private smsSubscription: any = null;
  private blockedSenders: Set<string> = new Set();
  private trustedSenders: Set<string> = new Set();

  // Callbacks
  private onSMSReceived: ((sms: IncomingSMS, analysis: FraudAnalysis) => void) | null = null;
  private onFraudDetected: ((record: SMSFraudRecord) => void) | null = null;
  private onStatsUpdated: ((stats: DashboardStats) => void) | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load blocked/trusted senders from storage
    await this.loadSenderLists();

    // Setup notification handler
    await this.setupNotifications();

    // Listen to app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    this.appState = nextState;
    console.log('[SMSMonitor] App state:', nextState);
  };

  private async loadSenderLists() {
    try {
      const blocked = await AsyncStorage.getItem(STORAGE_KEYS.BLOCKED_SENDERS);
      const trusted = await AsyncStorage.getItem(STORAGE_KEYS.TRUSTED_SENDERS);

      if (blocked) this.blockedSenders = new Set(JSON.parse(blocked));
      if (trusted) this.trustedSenders = new Set(JSON.parse(trusted));
    } catch (error) {
      console.error('[SMSMonitor] Error loading sender lists:', error);
    }
  }

  private async setupNotifications() {
    // Import and initialize notification service
    try {
      const { notificationService } = require('./NotificationService');
      await notificationService.initialize();
      console.log('[SMSMonitor] Notification service initialized');
    } catch (error) {
      console.error('[SMSMonitor] Error initializing notifications:', error);
    }
  }

  /**
   * MAIN ANALYSIS FUNCTION
   * Analyzes SMS and returns risk assessment in ~500ms
   */
  async analyzeSMS(sms: IncomingSMS): Promise<FraudAnalysis> {
    const startTime = Date.now();

    const normalizedBody = sms.body.toLowerCase();
    const normalizedSender = sms.sender.toLowerCase();

    let riskScore = 0;
    const reasons: string[] = [];
    const urlsFound: string[] = [];
    let otpDetected = false;
    let amountMentioned: string | null = null;

    // ============================================
    // STEP 1: Check if sender is blocked/trusted
    // ============================================
    if (this.blockedSenders.has(sms.sender)) {
      riskScore += 100;
      reasons.push('Sender is in your blocked list');
    }

    if (this.trustedSenders.has(sms.sender)) {
      riskScore -= 30;
      reasons.push('Sender is in your trusted list');
    }

    // ============================================
    // STEP 2: CRITICAL CHECK - OTP/Credential requests
    // ============================================
    for (const keyword of FRAUD_PATTERNS.criticalKeywords) {
      if (normalizedBody.includes(keyword)) {
        riskScore += 80;
        reasons.push(`CRITICAL: Asks for ${keyword.toUpperCase()} - NEVER share!`);
        break; // One critical is enough
      }
    }

    // ============================================
    // STEP 3: Sender verification
    // ============================================
    const isTrustedSender = FRAUD_PATTERNS.trustedSenderPatterns.some(
      pattern => pattern.test(sms.sender)
    );

    if (!isTrustedSender) {
      // Check for suspicious sender patterns
      if (/^\d{10,}$/.test(sms.sender)) {
        riskScore += 15;
        reasons.push('Sender is a plain phone number (not official)');
      } else if (/^[A-Z]{2}\d{3,}$/.test(sms.sender)) {
        riskScore += 20;
        reasons.push('Suspicious sender format detected');
      }
    }

    // ============================================
    // STEP 4: Keyword analysis
    // ============================================
    let highRiskCount = 0;
    for (const keyword of FRAUD_PATTERNS.highRiskKeywords) {
      if (normalizedBody.includes(keyword)) {
        highRiskCount++;
        if (highRiskCount <= 3) {
          reasons.push(`Contains high-risk keyword: "${keyword}"`);
        }
      }
    }
    riskScore += highRiskCount * 20;

    let mediumRiskCount = 0;
    for (const keyword of FRAUD_PATTERNS.mediumRiskKeywords) {
      if (normalizedBody.includes(keyword)) {
        mediumRiskCount++;
      }
    }
    riskScore += mediumRiskCount * 15;
    if (mediumRiskCount > 0) {
      reasons.push(`Contains ${mediumRiskCount} scam-related keywords`);
    }

    // ============================================
    // STEP 5: Urgency detection
    // ============================================
    let urgencyCount = 0;
    for (const word of FRAUD_PATTERNS.urgencyWords) {
      if (normalizedBody.includes(word)) {
        urgencyCount++;
      }
    }
    if (urgencyCount > 0) {
      riskScore += urgencyCount * 10;
      reasons.push('Uses urgency tactics to pressure action');
    }

    // ============================================
    // STEP 6: URL checking
    // ============================================
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = sms.body.match(urlRegex) || [];
    urlsFound.push(...urls);

    if (urls.length > 0) {
      riskScore += urls.length * 15;
      reasons.push(`Contains ${urls.length} link(s)`);

      // Check for shortened/suspicious URLs
      for (const url of urls) {
        for (const pattern of FRAUD_PATTERNS.suspiciousUrlPatterns) {
          if (url.toLowerCase().includes(pattern)) {
            riskScore += 25;
            reasons.push(`Contains suspicious shortened URL: ${pattern}`);
            break;
          }
        }
      }
    }

    // ============================================
    // STEP 7: OTP detection
    // ============================================
    const otpPatterns = [
      /\b\d{4,6}\b.*otp/i,
      /otp.*\b\d{4,6}\b/i,
      /one.?time.?password/i,
      /verification.?code/i
    ];

    for (const pattern of otpPatterns) {
      if (pattern.test(sms.body)) {
        otpDetected = true;
        break;
      }
    }

    // ============================================
    // STEP 8: Amount extraction
    // ============================================
    const amountPattern = /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi;
    const amountMatch = sms.body.match(amountPattern);
    if (amountMatch) {
      amountMentioned = amountMatch[0];
    }

    // ============================================
    // STEP 9: Safe transaction detection (REDUCE score)
    // ============================================
    const isTransaction = FRAUD_PATTERNS.transactionPatterns.some(
      pattern => pattern.test(sms.body)
    );

    if (isTransaction && isTrustedSender) {
      riskScore -= 40;
      reasons.push('Appears to be a legitimate transaction notification');
    }

    // ============================================
    // STEP 10: Sender-message consistency check
    // ============================================
    const claimedBanks = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'pnb', 'bob'];
    const messageClaimsBank = claimedBanks.some(bank => normalizedBody.includes(bank));
    const senderMatchesBank = claimedBanks.some(bank => normalizedSender.includes(bank));

    if (messageClaimsBank && !senderMatchesBank) {
      riskScore += 25;
      reasons.push('Message claims to be from a bank but sender does not match');
    }

    // ============================================
    // FINAL: Normalize score and determine risk level
    // ============================================
    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel: 'safe' | 'warning' | 'danger';
    let recommendation: string;

    if (riskScore < 40) {
      riskLevel = 'safe';
      recommendation = 'This message appears safe. No action needed.';
    } else if (riskScore <= 70) {
      riskLevel = 'warning';
      recommendation = 'Exercise caution. Verify with official channels before taking action.';
    } else {
      riskLevel = 'danger';
      recommendation = 'HIGH RISK! Do NOT click any links or share personal information.';
    }

    const analysisTime = Date.now() - startTime;

    return {
      riskScore,
      riskLevel,
      isFraud: riskLevel === 'danger',
      reasons: reasons.slice(0, 5), // Top 5 reasons
      urlsFound,
      otpDetected,
      amountMentioned,
      senderTrusted: isTrustedSender || this.trustedSenders.has(sms.sender),
      recommendation,
      analysisTime
    };
  }

  /**
   * Process incoming SMS - main entry point
   */
  async processIncomingSMS(sms: IncomingSMS): Promise<SMSFraudRecord> {
    console.log('[SMSMonitor] Processing SMS from:', sms.sender);

    // Run fraud analysis
    const analysis = await this.analyzeSMS(sms);

    // Create record
    const record: SMSFraudRecord = {
      id: `sms_${sms.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      sms,
      analysis,
      userAction: 'pending',
      createdAt: Date.now()
    };

    // Store record
    await this.storeFraudRecord(record);

    // Update statistics
    await this.updateStats(analysis.riskLevel);

    // Trigger callbacks
    if (this.onSMSReceived) {
      this.onSMSReceived(sms, analysis);
    }

    // Handle based on risk level
    if (analysis.riskLevel === 'danger') {
      await this.handleDangerousSMS(record);
      if (this.onFraudDetected) {
        this.onFraudDetected(record);
      }
    } else if (analysis.riskLevel === 'warning') {
      await this.handleWarningSMS(record);
    }

    // If URLs found and high risk, register link interceptor
    if (analysis.urlsFound.length > 0 && analysis.riskScore > 50) {
      await this.registerLinkInterceptor(analysis.urlsFound);
    }

    return record;
  }

  /**
   * Handle dangerous SMS (score > 70%)
   */
  private async handleDangerousSMS(record: SMSFraudRecord) {
    try {
      const { notificationService } = require('./NotificationService');
      // Show rich fraud alert with actions
      await notificationService.showRichFraudAlert(record);
    } catch (error) {
      console.error('[SMSMonitor] Error showing fraud alert:', error);
    }
  }

  /**
   * Handle warning SMS (score 40-70%)
   */
  private async handleWarningSMS(record: SMSFraudRecord) {
    try {
      const { notificationService } = require('./NotificationService');
      // Show warning notification
      await notificationService.showFraudAlert(record);
    } catch (error) {
      console.error('[SMSMonitor] Error showing warning:', error);
    }
  }

  /**
   * Register URLs for link interception
   */
  private async registerLinkInterceptor(urls: string[]) {
    try {
      const stored = await AsyncStorage.getItem('@kavach_blocked_urls');
      const blockedUrls: string[] = stored ? JSON.parse(stored) : [];

      for (const url of urls) {
        if (!blockedUrls.includes(url)) {
          blockedUrls.push(url);
        }
      }

      // Keep last 500 blocked URLs
      const trimmed = blockedUrls.slice(-500);
      await AsyncStorage.setItem('@kavach_blocked_urls', JSON.stringify(trimmed));

      console.log('[SMSMonitor] Registered blocked URLs:', urls.length);
    } catch (error) {
      console.error('[SMSMonitor] Error registering blocked URLs:', error);
    }
  }

  /**
   * Check if URL is blocked
   */
  async isUrlBlocked(url: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem('@kavach_blocked_urls');
      if (!stored) return false;

      const blockedUrls: string[] = JSON.parse(stored);
      return blockedUrls.some(blocked => url.includes(blocked) || blocked.includes(url));
    } catch {
      return false;
    }
  }

  /**
   * Store fraud record in local database
   */
  private async storeFraudRecord(record: SMSFraudRecord) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FRAUD_RECORDS);
      const records: SMSFraudRecord[] = stored ? JSON.parse(stored) : [];

      records.unshift(record); // Add to beginning

      // Keep last 500 records
      const trimmed = records.slice(0, 500);
      await AsyncStorage.setItem(STORAGE_KEYS.FRAUD_RECORDS, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[SMSMonitor] Error storing fraud record:', error);
    }
  }

  /**
   * Update dashboard statistics
   */
  private async updateStats(riskLevel: 'safe' | 'warning' | 'danger') {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DASHBOARD_STATS);
      const stats: DashboardStats = stored ? JSON.parse(stored) : {
        totalScanned: 0,
        safeCount: 0,
        warningCount: 0,
        dangerCount: 0,
        blockedUrls: 0,
        lastScanTime: null,
        todayScanned: 0,
        weeklyTrend: [0, 0, 0, 0, 0, 0, 0]
      };

      stats.totalScanned++;
      stats.lastScanTime = Date.now();

      if (riskLevel === 'safe') stats.safeCount++;
      else if (riskLevel === 'warning') stats.warningCount++;
      else if (riskLevel === 'danger') stats.dangerCount++;

      // Update today's count
      const today = new Date().toDateString();
      const lastDate = stats.lastScanTime ? new Date(stats.lastScanTime).toDateString() : null;
      if (today !== lastDate) {
        // New day, shift weekly trend
        stats.weeklyTrend.shift();
        stats.weeklyTrend.push(stats.todayScanned);
        stats.todayScanned = 1;
      } else {
        stats.todayScanned++;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.DASHBOARD_STATS, JSON.stringify(stats));

      if (this.onStatsUpdated) {
        this.onStatsUpdated(stats);
      }
    } catch (error) {
      console.error('[SMSMonitor] Error updating stats:', error);
    }
  }

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DASHBOARD_STATS);
      return stored ? JSON.parse(stored) : {
        totalScanned: 0,
        safeCount: 0,
        warningCount: 0,
        dangerCount: 0,
        blockedUrls: 0,
        lastScanTime: null,
        todayScanned: 0,
        weeklyTrend: [0, 0, 0, 0, 0, 0, 0]
      };
    } catch {
      return {
        totalScanned: 0,
        safeCount: 0,
        warningCount: 0,
        dangerCount: 0,
        blockedUrls: 0,
        lastScanTime: null,
        todayScanned: 0,
        weeklyTrend: [0, 0, 0, 0, 0, 0, 0]
      };
    }
  }

  /**
   * Get fraud records
   */
  async getRecords(limit: number = 50): Promise<SMSFraudRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FRAUD_RECORDS);
      const records: SMSFraudRecord[] = stored ? JSON.parse(stored) : [];
      return records.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Update record action
   */
  async updateRecordAction(
    recordId: string,
    action: 'dismissed' | 'reported' | 'blocked'
  ): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FRAUD_RECORDS);
      const records: SMSFraudRecord[] = stored ? JSON.parse(stored) : [];

      const index = records.findIndex(r => r.id === recordId);
      if (index === -1) return false;

      records[index].userAction = action;

      // If blocked, add sender to blocked list
      if (action === 'blocked') {
        await this.blockSender(records[index].sms.sender);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.FRAUD_RECORDS, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Block a sender
   */
  async blockSender(sender: string): Promise<void> {
    this.blockedSenders.add(sender);
    await AsyncStorage.setItem(
      STORAGE_KEYS.BLOCKED_SENDERS,
      JSON.stringify(Array.from(this.blockedSenders))
    );
  }

  /**
   * Unblock a sender
   */
  async unblockSender(sender: string): Promise<void> {
    this.blockedSenders.delete(sender);
    await AsyncStorage.setItem(
      STORAGE_KEYS.BLOCKED_SENDERS,
      JSON.stringify(Array.from(this.blockedSenders))
    );
  }

  /**
   * Trust a sender
   */
  async trustSender(sender: string): Promise<void> {
    this.trustedSenders.add(sender);
    this.blockedSenders.delete(sender); // Remove from blocked if present
    await AsyncStorage.setItem(
      STORAGE_KEYS.TRUSTED_SENDERS,
      JSON.stringify(Array.from(this.trustedSenders))
    );
  }

  /**
   * Get blocked senders list
   */
  getBlockedSenders(): string[] {
    return Array.from(this.blockedSenders);
  }

  /**
   * Get trusted senders list
   */
  getTrustedSenders(): string[] {
    return Array.from(this.trustedSenders);
  }

  // ============================================
  // Event Callbacks
  // ============================================

  setOnSMSReceived(callback: (sms: IncomingSMS, analysis: FraudAnalysis) => void) {
    this.onSMSReceived = callback;
  }

  setOnFraudDetected(callback: (record: SMSFraudRecord) => void) {
    this.onFraudDetected = callback;
  }

  setOnStatsUpdated(callback: (stats: DashboardStats) => void) {
    this.onStatsUpdated = callback;
  }

  // ============================================
  // Monitoring Control
  // ============================================

  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Start monitoring (called when native module sends SMS events)
   */
  startMonitoring() {
    this.isMonitoring = true;
    console.log('[SMSMonitor] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('[SMSMonitor] Monitoring stopped');
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.FRAUD_RECORDS,
      STORAGE_KEYS.DASHBOARD_STATS,
      STORAGE_KEYS.BLOCKED_SENDERS,
      STORAGE_KEYS.TRUSTED_SENDERS,
      '@kavach_blocked_urls'
    ]);

    this.blockedSenders.clear();
    this.trustedSenders.clear();
  }
}

// Export singleton instance
export const realTimeSMSMonitor = new RealTimeSMSMonitor();
export default realTimeSMSMonitor;
