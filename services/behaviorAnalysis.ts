/**
 * Behavior Analysis Service for React Native
 * Tracks user behavior and communicates with fraud detection API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { cursorAnalysis, CursorSession, CursorMetrics } from './cursorAnalysis';
import { bbaService, BBAComparisonResult } from './behavioralBiometricAnalysis';
import { cognitiveAnalysis, CognitiveAnalysisResult } from './cognitivePatternAnalysis';

// API Configuration
const API_BASE_URL = 'http://172.16.10.100:3001/api/fraud';

// Types
export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  isRooted?: boolean;
  isEmulator?: boolean;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  ipAddress?: string;
}

export interface SessionInfo {
  sessionId: string;
  sessionDuration: number;
  actionsBeforeTransaction: number;
  authMethodUsed?: string;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresReauth: boolean;
  requiresBlock: boolean;
  riskFactors: Array<{
    factor: string;
    score: number;
    description: string;
  }>;
  // BBA-enhanced fields
  bbaScore?: number;
  cognitiveScore?: number;
  cursorScore?: number;
  bbaAnalysis?: BBAComparisonResult;
  cognitiveAnalysis?: CognitiveAnalysisResult;
}

export interface TransactionAnalysisResult {
  success: boolean;
  transactionId: string;
  riskAssessment: RiskAssessment;
  recommendation: {
    action: 'proceed' | 'reauth' | 'block' | 'proceed_with_caution';
    message: string;
    displayType: 'success' | 'info' | 'warning' | 'error';
    reauthMethods?: string[];
  };
}

export interface ReauthCheckResult {
  success: boolean;
  requiresReauth: boolean;
  reason?: string;
  riskScore: number;
  riskLevel: string;
  suggestedMethod: 'pin' | 'biometric' | 'otp';
}

// Session Management
class SessionManager {
  private sessionId: string = '';
  private sessionStartTime: number = 0;
  private actionCount: number = 0;
  private lastActionTime: number = 0;

  constructor() {
    this.startNewSession();
  }

  startNewSession(): string {
    this.sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartTime = Date.now();
    this.actionCount = 0;
    this.lastActionTime = Date.now();
    return this.sessionId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  recordAction(): void {
    this.actionCount++;
    this.lastActionTime = Date.now();
  }

  getSessionDuration(): number {
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  getActionCount(): number {
    return this.actionCount;
  }

  getTimeSinceLastAction(): number {
    return Date.now() - this.lastActionTime;
  }

  getSessionInfo(): SessionInfo {
    return {
      sessionId: this.sessionId,
      sessionDuration: this.getSessionDuration(),
      actionsBeforeTransaction: this.actionCount
    };
  }
}

// Behavior Analysis Service
class BehaviorAnalysisService {
  private sessionManager: SessionManager;
  private deviceInfo: DeviceInfo | null = null;
  private locationInfo: LocationInfo | null = null;
  private userId: string | null = null;
  private eventQueue: any[] = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.sessionManager = new SessionManager();
    this.initializeDeviceInfo();
  }

  // Initialize device information
  private async initializeDeviceInfo(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem('@device_id');
      if (!deviceId) {
        deviceId = `DEV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('@device_id', deviceId);
      }

      this.deviceInfo = {
        deviceId,
        deviceModel: Device.modelName || 'Unknown',
        osName: Platform.OS,
        osVersion: Platform.Version?.toString() || 'Unknown',
        appVersion: '1.0.0',
        isRooted: false,
        isEmulator: !Device.isDevice
      };
    } catch (error) {
      console.error('[BehaviorAnalysis] Error initializing device info:', error);
    }
  }

  // Get current location
  async updateLocation(): Promise<LocationInfo | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      this.locationInfo = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined
      };

      // Try to get city name
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        if (address) {
          this.locationInfo.city = address.city || address.district || undefined;
        }
      } catch (e) {
        // Geocoding failed, continue without city
      }

      return this.locationInfo;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error getting location:', error);
      return null;
    }
  }

  // Set user ID
  setUserId(userId: string): void {
    this.userId = userId;
  }

  // Start new session
  startSession(): string {
    return this.sessionManager.startNewSession();
  }

  // Record user action
  recordAction(): void {
    this.sessionManager.recordAction();
  }

  // Get device info
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  // Get session info
  getSessionInfo(): SessionInfo {
    return this.sessionManager.getSessionInfo();
  }

  // ============================================================
  // API METHODS
  // ============================================================

  /**
   * Analyze a transaction for fraud risk before processing
   */
  async analyzeTransaction(
    amount: number,
    recipientUpiId: string,
    recipientName?: string
  ): Promise<TransactionAnalysisResult | null> {
    try {
      if (!this.userId) {
        console.error('[BehaviorAnalysis] User ID not set');
        return null;
      }

      // Update location before analysis
      await this.updateLocation();

      const response = await fetch(`${API_BASE_URL}/analyze-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          amount,
          recipientUpiId,
          recipientName,
          deviceInfo: this.deviceInfo,
          locationInfo: this.locationInfo,
          sessionInfo: this.sessionManager.getSessionInfo()
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error analyzing transaction:', error);
      return null;
    }
  }

  /**
   * Check if transaction requires re-authentication
   */
  async checkReauthRequired(
    amount: number,
    recipientUpiId?: string
  ): Promise<ReauthCheckResult | null> {
    try {
      if (!this.userId) {
        return null;
      }

      await this.updateLocation();

      const response = await fetch(`${API_BASE_URL}/check-reauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          amount,
          recipientUpiId,
          deviceInfo: this.deviceInfo,
          locationInfo: this.locationInfo
        })
      });

      return await response.json();
    } catch (error) {
      console.error('[BehaviorAnalysis] Error checking reauth:', error);
      return null;
    }
  }

  /**
   * Track a behavioral event
   */
  async trackEvent(
    eventType: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.userId) return;

      this.sessionManager.recordAction();

      // Add to queue for batch processing
      this.eventQueue.push({
        userId: this.userId,
        eventType,
        eventData,
        deviceInfo: this.deviceInfo,
        locationInfo: this.locationInfo,
        sessionId: this.sessionManager.getSessionId(),
        timestamp: new Date().toISOString()
      });

      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processEventQueue();
      }
    } catch (error) {
      console.error('[BehaviorAnalysis] Error tracking event:', error);
    }
  }

  /**
   * Process event queue (batch send)
   */
  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    // Take events from queue
    const eventsToSend = this.eventQueue.splice(0, 10);

    try {
      // Send events one by one (could be batched in production)
      for (const event of eventsToSend) {
        await fetch(`${API_BASE_URL}/track-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      }
    } catch (error) {
      console.error('[BehaviorAnalysis] Error sending events:', error);
      // Put failed events back in queue
      this.eventQueue.unshift(...eventsToSend);
    }

    // Continue processing if more events
    if (this.eventQueue.length > 0) {
      setTimeout(() => this.processEventQueue(), 1000);
    } else {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Track authentication event
   */
  async trackAuthEvent(
    authMethod: 'pin' | 'biometric',
    success: boolean
  ): Promise<void> {
    try {
      if (!this.userId) return;

      await fetch(`${API_BASE_URL}/update-auth-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          authMethod,
          success,
          deviceInfo: this.deviceInfo,
          sessionId: this.sessionManager.getSessionId()
        })
      });
    } catch (error) {
      console.error('[BehaviorAnalysis] Error tracking auth event:', error);
    }
  }

  /**
   * Track completed transaction
   */
  async trackTransaction(
    transactionId: string,
    orderId: string,
    amount: number,
    status: string,
    recipient: { upiId: string; name?: string },
    riskAssessment?: RiskAssessment
  ): Promise<void> {
    try {
      if (!this.userId) return;

      await fetch(`${API_BASE_URL}/track-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          transactionId,
          orderId,
          amount,
          status,
          recipient,
          deviceInfo: this.deviceInfo,
          locationInfo: this.locationInfo,
          sessionInfo: this.sessionManager.getSessionInfo(),
          riskAssessment
        })
      });
    } catch (error) {
      console.error('[BehaviorAnalysis] Error tracking transaction:', error);
    }
  }

  /**
   * Resolve a fraud alert after re-authentication
   */
  async resolveAlert(
    alertId: string,
    reauthMethod: string,
    reauthSuccessful: boolean
  ): Promise<{ success: boolean; canProceed: boolean } | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(`${API_BASE_URL}/resolve-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          userId: this.userId,
          reauthMethod,
          reauthSuccessful,
          sessionId: this.sessionManager.getSessionId()
        })
      });

      return await response.json();
    } catch (error) {
      console.error('[BehaviorAnalysis] Error resolving alert:', error);
      return null;
    }
  }

  /**
   * Get user's fraud alerts
   */
  async getAlerts(limit: number = 20): Promise<any[] | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(
        `${API_BASE_URL}/alerts/${this.userId}?limit=${limit}`
      );

      const result = await response.json();
      return result.success ? result.alerts : null;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error fetching alerts:', error);
      return null;
    }
  }

  /**
   * Get user statistics
   */
  async getStatistics(days: number = 30): Promise<any | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(
        `${API_BASE_URL}/statistics/${this.userId}?days=${days}`
      );

      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error fetching statistics:', error);
      return null;
    }
  }

  /**
   * Get user behavior profile
   */
  async getProfile(): Promise<any | null> {
    try {
      if (!this.userId) return null;

      const response = await fetch(
        `${API_BASE_URL}/user-profile/${this.userId}`
      );

      const result = await response.json();
      return result.success ? result.profile : null;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error fetching profile:', error);
      return null;
    }
  }

  // ============================================================
  // BBA INTEGRATION METHODS
  // ============================================================

  /**
   * Start BBA tracking session
   */
  startBBASession(screenContext: string): void {
    cursorAnalysis.startSession(screenContext);
    if (this.userId) {
      cognitiveAnalysis.startSession(this.userId);
    }
    console.log('[BehaviorAnalysis] BBA session started:', screenContext);
  }

  /**
   * End BBA tracking session and get analysis
   */
  endBBASession(): {
    cursorSession: CursorSession | null;
    bbaResult: BBAComparisonResult | null;
    cognitiveResult: CognitiveAnalysisResult | null;
  } {
    const cursorSession = cursorAnalysis.endSession();
    let bbaResult: BBAComparisonResult | null = null;
    let cognitiveResult: CognitiveAnalysisResult | null = null;

    if (cursorSession) {
      bbaResult = bbaService.compareWithProfile(cursorSession);
    }

    cognitiveResult = cognitiveAnalysis.performAnalysis();

    console.log('[BehaviorAnalysis] BBA session ended');
    return { cursorSession, bbaResult, cognitiveResult };
  }

  /**
   * Get combined BBA risk score
   */
  getBBARiskScore(): number {
    const cursorRisk = cursorAnalysis.getAnomalyRiskScore();
    const bbaRisk = bbaService.getQuickRiskScore();
    const cognitiveLoad = cognitiveAnalysis.analyzeCognitiveLoad();

    // Weighted combination
    const combinedRisk = (cursorRisk * 0.25) + (bbaRisk * 0.40) + (cognitiveLoad.overallCognitiveLoad * 0.35);
    return Math.min(100, combinedRisk);
  }

  /**
   * Analyze transaction with BBA enhancement
   */
  async analyzeTransactionWithBBA(
    amount: number,
    recipientUpiId: string,
    recipientName?: string
  ): Promise<TransactionAnalysisResult | null> {
    try {
      if (!this.userId) {
        console.error('[BehaviorAnalysis] User ID not set');
        return null;
      }

      // Get BBA analysis
      const { cursorSession, bbaResult, cognitiveResult } = this.endBBASession();

      // Calculate BBA-enhanced risk
      let bbaRiskScore = 0;
      const bbaRiskFactors: RiskAssessment['riskFactors'] = [];

      if (bbaResult) {
        bbaRiskScore = 100 - bbaResult.overallScore;
        if (bbaResult.anomalies.length > 0) {
          bbaRiskFactors.push({
            factor: 'behavioral_biometric_anomaly',
            score: bbaRiskScore,
            description: `BBA detected ${bbaResult.anomalies.length} anomalies: ${bbaResult.anomalies.join(', ')}`
          });
        }
      }

      if (cognitiveResult && cognitiveResult.riskScore > 30) {
        bbaRiskFactors.push({
          factor: 'cognitive_pattern_anomaly',
          score: cognitiveResult.riskScore,
          description: cognitiveResult.recommendation
        });
      }

      // Update location before analysis
      await this.updateLocation();

      const response = await fetch(`${API_BASE_URL}/analyze-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          amount,
          recipientUpiId,
          recipientName,
          deviceInfo: this.deviceInfo,
          locationInfo: this.locationInfo,
          sessionInfo: this.sessionManager.getSessionInfo(),
          // BBA data
          bbaData: {
            cursorMetrics: cursorSession?.metrics,
            bbaScore: bbaResult?.overallScore,
            bbaRiskLevel: bbaResult?.riskLevel,
            cognitiveScore: cognitiveResult?.riskScore,
            cognitiveLoad: cognitiveResult?.cognitiveLoad,
            anomalies: [
              ...(bbaResult?.anomalies || []),
              ...(cognitiveResult?.anomalies.map(a => a.description) || [])
            ]
          }
        })
      });

      const result = await response.json();

      // Enhance result with local BBA analysis
      if (result && result.riskAssessment) {
        result.riskAssessment.bbaScore = bbaResult?.overallScore;
        result.riskAssessment.cognitiveScore = cognitiveResult?.riskScore;
        result.riskAssessment.cursorScore = cursorAnalysis.getAnomalyRiskScore();
        result.riskAssessment.bbaAnalysis = bbaResult || undefined;
        result.riskAssessment.cognitiveAnalysis = cognitiveResult || undefined;

        // Add BBA risk factors
        result.riskAssessment.riskFactors = [
          ...result.riskAssessment.riskFactors,
          ...bbaRiskFactors
        ];

        // Adjust risk level based on BBA
        if (bbaResult?.riskLevel === 'critical' || cognitiveResult?.anomalies.some(a => a.type === 'coercion')) {
          result.riskAssessment.riskLevel = 'critical';
          result.riskAssessment.requiresBlock = true;
        } else if (bbaResult?.riskLevel === 'high' || (cognitiveResult?.riskScore || 0) > 70) {
          if (result.riskAssessment.riskLevel !== 'critical') {
            result.riskAssessment.riskLevel = 'high';
            result.riskAssessment.requiresReauth = true;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('[BehaviorAnalysis] Error analyzing transaction with BBA:', error);
      return null;
    }
  }

  /**
   * Track touch event for BBA
   */
  trackTouch(x: number, y: number, pressure?: number): void {
    cursorAnalysis.recordTouch(x, y, pressure);
  }

  /**
   * Track keystroke for BBA
   */
  trackKeystroke(key: string): void {
    bbaService.recordKeyPress(key);
    setTimeout(() => bbaService.recordKeyRelease(key), 100);
  }

  /**
   * Track screen navigation for cognitive analysis
   */
  trackScreenNavigation(screenName: string): void {
    cognitiveAnalysis.recordScreenNavigation(screenName);
  }

  /**
   * Check if user has a reliable BBA profile
   */
  hasBBAProfile(): boolean {
    return bbaService.hasReliableProfile();
  }

  /**
   * Get BBA profile confidence
   */
  getBBAProfileConfidence(): number {
    return bbaService.getProfileConfidence();
  }

  /**
   * Start collecting baseline for BBA profile
   */
  startBBABaselineCollection(): void {
    if (this.userId) {
      bbaService.startBaselineCollection(this.userId);
    }
  }

  /**
   * Add current session as sample to BBA profile
   */
  addBBASample(): void {
    const cursorSession = cursorAnalysis.getCurrentSession();
    if (cursorSession) {
      bbaService.addSampleToProfile(cursorSession);
      cognitiveAnalysis.updateProfile();
    }
  }
}

// Export singleton instance
export const behaviorAnalysis = new BehaviorAnalysisService();

// Export types and class for testing
export { BehaviorAnalysisService, SessionManager };
