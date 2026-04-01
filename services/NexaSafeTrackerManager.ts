/**
 * NexaSafe Tracker Manager - Real-time behavioral fraud detection
 * Ported from Flutter/Dart BBA_MobileBanking to React Native/TypeScript
 *
 * Features:
 * - Trust score calculation with behavior penalties
 * - Screen recording detection
 * - Session baseline building
 * - Anomaly detection for suspicious behavior patterns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Paths, Directory, File } from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { behaviorAnalysis } from './behaviorAnalysis';
import { bbaService } from './behavioralBiometricAnalysis';

// ============================================================
// Types and Interfaces
// ============================================================

export interface TapEvent {
  screen: string;
  position: { dx: number; dy: number };
  zone: string;
  timestamp: string;
  durationMs?: number;
}

export interface SwipeEvent {
  startPos: number;
  endPos: number;
  speed: number;
  distance: number;
  durationMs: number;
  timestamp: string;
}

export interface ScreenVisit {
  screen: string;
  timestamp: string;
  durationSeconds?: number;
  tapEvents?: TapEvent[];
  swipeEvents?: SwipeEvent[];
}

export interface SessionData {
  session: {
    start: string;
    end: string;
    durationSeconds: number;
    trustScore?: number;
    penaltiesApplied: number[];
  };
  device: DeviceInfo;
  location?: { latitude: number; longitude: number };
  tapDurationsMs: Record<string, number>;
  tapEvents: TapEvent[];
  swipeEvents: SwipeEvent[];
  screensVisited: ScreenVisit[];
  screenDurations: Record<string, number>;
  screenRecordingDetected: boolean;
  sessionInput: {
    withinBankTransferAmount?: string;
    fdBroken: boolean;
    loanTaken: boolean;
    timeFromLoginToFd?: number;
    timeFromLoginToLoan?: number;
    timeFromLoginToTransaction?: number;
    timeForTransaction?: number;
  };
  behaviorAnalysis: BehaviorLog[];
}

export interface BehaviorLog {
  id: number;
  timestamp: string;
  penalty: number;
  description: string;
  extraData?: any;
}

export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  osName: string;
  osVersion: string;
  isEmulator: boolean;
}

export interface UserBaseline {
  avgTapMs: number;
  avgSwipeSpeed: number;
  createdAt: string;
  sessionsUsed: number;
  tapSamples: number;
  swipeSamples: number;
}

// ============================================================
// Behavior Penalties Configuration
// ============================================================

const BEHAVIOR_PENALTIES: Record<number, number> = {
  1: -15,  // Transaction immediately after login
  2: -15,  // FD broken
  3: -15,  // Loan application after login
  4: -10,  // Very short session
  5: -15,  // Multiple high-risk actions
  6: -6,   // Very fast tap
  7: -6,   // Very slow tap
  8: -10,  // Excessive scrolling / fast swipe
  9: -6,   // Repeated screen revisits
  10: -6,  // OTP skip
  11: -6,  // Rapid screen transition
  12: -6,  // Multiple failed PIN
  13: -6,  // Multiple loans viewed
  14: -5,  // Slow swipe deviation
  15: -4,  // Fast swipe deviation
  16: -4,  // Tap in inactive area
  17: -6,  // Rapid tap burst
  18: -4,  // Reserved
  19: -6,  // Rapid tap burst threshold
  20: -4,  // Reserved
  21: -10, // Failed PIN attempt
  22: -4,  // Inactive area tap threshold
  23: -6,  // Multiple loans without applying
  24: -5,  // Reserved
  25: -5,  // Reserved
  26: -4,  // Reserved
  27: -4,  // Reserved
  28: -4,  // Reserved
  29: -4,  // Reserved
  30: -4,  // Reserved
  33: -15, // Sudden transfer after inactivity
  34: -15, // FD created and quickly withdrawn
  42: -10, // Multiple account switches
  43: -15, // OTP bypass attempt
  44: -15, // Multiple failed authentications
  45: -20, // Screen recording detected
  50: -15, // Large transaction
};

// Behavior thresholds
const THRESHOLDS = {
  veryShortSession: 10,
  highRiskAction: 3,
  veryFastTap: 100,
  verySlowTap: 2000,
  excessiveScroll: 20,
  screenRevisit: 5,
  otpSkip: 2,
  rapidScreenTransition: 3,
  failedPin: 3,
  multipleLoans: 3,
  rapidTapBurst: 3,
  inactiveArea: 3,
  rapidAccountSwitch: 3,
  failedAuth: 3,
  largeTransaction: 50000,
};

// ============================================================
// NexaSafe Tracker Manager Class
// ============================================================

class NexaSafeTrackerManager {
  private static instance: NexaSafeTrackerManager;

  // Trust score
  private trustScore: number = 100;
  private appliedPenalties: number[] = [];
  private behaviorLogs: BehaviorLog[] = [];

  // Session tracking
  private sessionStartTime: Date | null = null;
  private sessionEndTime: Date | null = null;
  private currentScreen: string | null = null;
  private screenEnterTime: Date | null = null;

  // Counters
  private screenDurations: Record<string, number> = {};
  private screenVisitCounts: Record<string, number> = {};
  private highRiskActionCount: number = 0;
  private scrollCount: number = 0;
  private otpSkipCount: number = 0;
  private failedPinCount: number = 0;
  private loansViewedCount: number = 0;
  private inactiveAreaTapCount: number = 0;
  private accountSwitchCount: number = 0;
  private failedAuthCount: number = 0;
  private recentTaps: Date[] = [];

  // Events
  private tapEvents: TapEvent[] = [];
  private swipeEvents: SwipeEvent[] = [];
  private screenVisits: ScreenVisit[] = [];
  private tapDurations: Record<string, number> = {};

  // Session input tracking
  private transactionAmount: string | null = null;
  private fdBroken: boolean = false;
  private loanTaken: boolean = false;
  private loginTime: Date | null = null;
  private fdTime: Date | null = null;
  private loanTime: Date | null = null;
  private transactionStartTime: Date | null = null;
  private transactionEndTime: Date | null = null;

  // Flags
  private screenRecordingDetected: boolean = false;
  private authResetCount: number = 0;
  private maxAuthResets: number = 3;

  // Baseline
  private userBaseline: UserBaseline | null = null;

  // Callbacks
  private onLogoutCallback: (() => void) | null = null;
  private showAlertCallback: ((title: string, message: string, actions: any[]) => void) | null = null;

  private constructor() {
    this.loadUserBaseline();
  }

  static getInstance(): NexaSafeTrackerManager {
    if (!NexaSafeTrackerManager.instance) {
      NexaSafeTrackerManager.instance = new NexaSafeTrackerManager();
    }
    return NexaSafeTrackerManager.instance;
  }

  // ============================================================
  // Session Management
  // ============================================================

  startSession(): void {
    this.trustScore = 100;
    this.appliedPenalties = [];
    this.behaviorLogs = [];
    this.sessionStartTime = new Date();
    this.sessionEndTime = null;
    this.loginTime = new Date();

    this.resetCounters();
    this.screenRecordingDetected = false;
    this.authResetCount = 0;

    // Start behavior analysis tracking
    behaviorAnalysis.startSession();

    console.log('✅ NexaSafe session started');

    // Start screen recording detection
    this.startScreenRecordingDetection();

    // Check for baseline creation
    this.checkForBaselineCreation();
  }

  async endSession(): Promise<SessionData | null> {
    if (!this.sessionStartTime) {
      console.warn('⚠️ No active session to end');
      return null;
    }

    this.sessionEndTime = new Date();

    // Record final screen duration
    if (this.currentScreen && this.screenEnterTime) {
      const duration = Math.floor((Date.now() - this.screenEnterTime.getTime()) / 1000);
      this.screenDurations[this.currentScreen] = (this.screenDurations[this.currentScreen] || 0) + duration;
    }

    // Get device info
    const deviceInfo = await this.getDeviceInfo();

    // Get location
    let location: { latitude: number; longitude: number } | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch (e) {
      console.log('Location unavailable');
    }

    const sessionDuration = Math.floor(
      (this.sessionEndTime.getTime() - this.sessionStartTime.getTime()) / 1000
    );

    // Calculate final trust score with ML model integration
    const finalTrustScore = await this.calculateFinalTrustScore();

    const sessionData: SessionData = {
      session: {
        start: this.sessionStartTime.toISOString(),
        end: this.sessionEndTime.toISOString(),
        durationSeconds: sessionDuration,
        trustScore: finalTrustScore,
        penaltiesApplied: this.appliedPenalties,
      },
      device: deviceInfo,
      location,
      tapDurationsMs: this.tapDurations,
      tapEvents: this.tapEvents,
      swipeEvents: this.swipeEvents,
      screensVisited: this.screenVisits,
      screenDurations: this.screenDurations,
      screenRecordingDetected: this.screenRecordingDetected,
      sessionInput: {
        withinBankTransferAmount: this.transactionAmount || undefined,
        fdBroken: this.fdBroken,
        loanTaken: this.loanTaken,
        timeFromLoginToFd: this.fdTime && this.loginTime
          ? Math.floor((this.fdTime.getTime() - this.loginTime.getTime()) / 1000)
          : undefined,
        timeFromLoginToLoan: this.loanTime && this.loginTime
          ? Math.floor((this.loanTime.getTime() - this.loginTime.getTime()) / 1000)
          : undefined,
        timeFromLoginToTransaction: this.transactionStartTime && this.loginTime
          ? Math.floor((this.transactionStartTime.getTime() - this.loginTime.getTime()) / 1000)
          : undefined,
        timeForTransaction: this.transactionEndTime && this.transactionStartTime
          ? Math.floor((this.transactionEndTime.getTime() - this.transactionStartTime.getTime()) / 1000)
          : undefined,
      },
      behaviorAnalysis: this.behaviorLogs,
    };

    // Export session to file
    await this.exportSession(sessionData);

    console.log(`📁 Session exported. Final Trust Score: ${finalTrustScore.toFixed(2)}`);

    return sessionData;
  }

  // ============================================================
  // Tracking Methods
  // ============================================================

  onScreenVisited(screen: string): void {
    const now = new Date();

    // Record previous screen duration
    if (this.currentScreen && this.screenEnterTime) {
      const duration = Math.floor((now.getTime() - this.screenEnterTime.getTime()) / 1000);
      this.screenDurations[this.currentScreen] = (this.screenDurations[this.currentScreen] || 0) + duration;
    }

    this.currentScreen = screen;
    this.screenEnterTime = now;

    // Track screen visit
    this.screenVisits.push({
      screen,
      timestamp: now.toISOString(),
    });

    // Track visit count for revisit detection
    this.screenVisitCounts[screen] = (this.screenVisitCounts[screen] || 0) + 1;

    if (this.screenVisitCounts[screen] >= THRESHOLDS.screenRevisit) {
      this.detectBehavior(9); // Repeated screen revisits
    }

    // Track for cognitive analysis
    behaviorAnalysis.trackScreenNavigation(screen);

    console.log(`📱 Screen visited: ${screen}`);
  }

  recordTapPosition(screenName: string, x: number, y: number, zone: string): void {
    const tapEvent: TapEvent = {
      screen: screenName,
      position: { dx: x, dy: y },
      zone,
      timestamp: new Date().toISOString(),
    };

    this.tapEvents.push(tapEvent);

    // Track touch for BBA
    behaviorAnalysis.trackTouch(x, y);

    // Detect inactive area taps
    if (zone === 'inactive') {
      this.inactiveAreaTapCount++;
      if (this.inactiveAreaTapCount >= THRESHOLDS.inactiveArea) {
        this.detectBehavior(22);
      }
    }
  }

  recordTapDuration(screenName: string, durationMs: number): void {
    this.tapDurations[screenName] = (this.tapDurations[screenName] || 0) + durationMs;

    // Track recent taps for burst detection
    this.recentTaps.push(new Date());
    this.recentTaps = this.recentTaps.filter(
      tap => Date.now() - tap.getTime() < 5000
    );

    // Detect rapid tap bursts
    if (this.recentTaps.length >= THRESHOLDS.rapidTapBurst) {
      const timeDiff = this.recentTaps[this.recentTaps.length - 1].getTime() - this.recentTaps[0].getTime();
      if (timeDiff > 0) {
        const tapsPerSecond = (this.recentTaps.length / timeDiff) * 1000;
        if (tapsPerSecond > THRESHOLDS.rapidTapBurst) {
          this.detectBehavior(19);
        }
      }
    }

    // Check against baseline or thresholds
    if (this.userBaseline && this.userBaseline.avgTapMs > 0) {
      if (durationMs < this.userBaseline.avgTapMs * 0.5) {
        this.detectBehavior(6, durationMs); // Very fast tap
      } else if (durationMs > this.userBaseline.avgTapMs * 2.0) {
        this.detectBehavior(7, durationMs); // Very slow tap
      }
    } else {
      if (durationMs < THRESHOLDS.veryFastTap) {
        this.detectBehavior(6, durationMs);
      } else if (durationMs > THRESHOLDS.verySlowTap) {
        this.detectBehavior(7, durationMs);
      }
    }
  }

  onSwipeStart(pos: number): void {
    // Store start position - actual tracking happens on end
  }

  onSwipeEnd(startPos: number, endPos: number, durationMs: number): void {
    const distance = Math.abs(endPos - startPos);
    const speed = durationMs > 0 ? distance / durationMs : 0;

    const swipeEvent: SwipeEvent = {
      startPos,
      endPos,
      speed,
      distance,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    this.swipeEvents.push(swipeEvent);

    // Detect abnormal swipe speeds
    if (speed > 5.0) {
      this.detectBehavior(8, speed);
    }

    // Check against baseline
    if (this.userBaseline && this.userBaseline.avgSwipeSpeed > 0) {
      if (speed < this.userBaseline.avgSwipeSpeed * 0.5) {
        this.detectBehavior(14); // Slow swipe deviation
      } else if (speed > this.userBaseline.avgSwipeSpeed * 2.0) {
        this.detectBehavior(15); // Fast swipe deviation
      }
    }
  }

  recordSwipeMetrics(screenName: string, durationMs: number, distance: number, speed: number): void {
    this.onSwipeEnd(0, distance, durationMs);
  }

  // ============================================================
  // Transaction Tracking
  // ============================================================

  recordTransferAmount(amount: string): void {
    this.transactionAmount = amount;
    console.log(`💰 Transfer amount tracked: ${amount}`);

    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsedAmount) && parsedAmount >= THRESHOLDS.largeTransaction) {
      this.detectBehavior(50, parsedAmount);
    }
  }

  recordFDBroken(): void {
    this.fdBroken = true;
    this.fdTime = new Date();
    this.detectBehavior(2);
    console.log('🧨 FD broken marked');
  }

  recordLoanTaken(): void {
    this.loanTaken = true;
    this.loanTime = new Date();
    this.loansViewedCount++;

    if (this.loansViewedCount >= THRESHOLDS.multipleLoans) {
      this.detectBehavior(23);
    }

    console.log('📋 Loan application recorded');
  }

  markTransactionStart(): void {
    this.transactionStartTime = new Date();
    console.log('🏁 Transaction started');
  }

  markTransactionEnd(): void {
    this.transactionEndTime = new Date();
    console.log('✅ Transaction ended');
  }

  trackOtpSkip(): void {
    this.otpSkipCount++;
    if (this.otpSkipCount >= THRESHOLDS.otpSkip) {
      this.detectBehavior(10);
    }
    console.log(`⏭ OTP skip tracked (count: ${this.otpSkipCount})`);
  }

  trackFailedPinAttempt(): void {
    this.failedPinCount++;
    if (this.failedPinCount >= THRESHOLDS.failedPin) {
      this.detectBehavior(21);
    }
    console.log(`❌ Failed PIN attempt tracked (count: ${this.failedPinCount})`);
  }

  trackAccountSwitch(): void {
    this.accountSwitchCount++;
    if (this.accountSwitchCount >= THRESHOLDS.rapidAccountSwitch) {
      this.detectBehavior(42);
    }
    console.log(`🔄 Account switch tracked (count: ${this.accountSwitchCount})`);
  }

  trackFailedAuth(): void {
    this.failedAuthCount++;
    if (this.failedAuthCount >= THRESHOLDS.failedAuth) {
      this.detectBehavior(44);
    }
    console.log(`🔐 Failed auth tracked (count: ${this.failedAuthCount})`);
  }

  trackImmediateTransaction(): void {
    if (this.loginTime) {
      const timeSinceLogin = Date.now() - this.loginTime.getTime();
      if (timeSinceLogin < 30000) { // Less than 30 seconds
        this.detectBehavior(1);
      }
    }
  }

  // ============================================================
  // Behavior Detection
  // ============================================================

  detectBehavior(behaviorId: number, extraData?: any): void {
    const penalty = BEHAVIOR_PENALTIES[behaviorId];
    if (penalty === undefined) {
      console.warn(`⚠️ Unknown behavior ID: ${behaviorId}`);
      return;
    }

    this.behaviorLogs.push({
      id: behaviorId,
      timestamp: new Date().toISOString(),
      penalty,
      description: this.getBehaviorDescription(behaviorId),
      extraData,
    });

    this.applyBehavior(behaviorId);
  }

  private applyBehavior(behaviorId: number): void {
    const penalty = BEHAVIOR_PENALTIES[behaviorId] || 0;
    this.trustScore = Math.max(0, Math.min(100, this.trustScore + penalty));
    this.appliedPenalties.push(behaviorId);

    console.log(`⚠️ Behavior ${behaviorId} detected → Penalty ${penalty} → Trust: ${this.trustScore}`);

    this.checkAndShowPopup();
  }

  private getBehaviorDescription(id: number): string {
    const descriptions: Record<number, string> = {
      1: 'Immediate transaction after login',
      2: 'FD broken',
      3: 'Loan application after login',
      4: 'Very short session',
      5: 'Multiple high-risk actions',
      6: 'Very fast tap',
      7: 'Very slow tap',
      8: 'Excessive scrolling/fast swipe',
      9: 'Repeated screen revisits',
      10: 'OTP skip',
      21: 'Multiple failed PIN attempts',
      22: 'Tapping in inactive areas',
      23: 'Multiple loans viewed without applying',
      33: 'Sudden transfer after inactivity',
      34: 'FD created and quickly withdrawn',
      42: 'Multiple account switches',
      43: 'OTP bypass attempt',
      44: 'Multiple failed authentications',
      45: 'Screen recording detected',
      50: 'Large transaction',
    };
    return descriptions[id] || 'Unknown behavior';
  }

  // ============================================================
  // Trust Score Popup Logic
  // ============================================================

  private checkAndShowPopup(): void {
    if (this.authResetCount >= this.maxAuthResets) {
      console.log('⚠️ Max authentication resets reached');
      return;
    }

    const action = this.getCurrentAction();

    switch (action) {
      case 'logout':
        this.showLogoutAlert();
        break;
      case 'otp':
        this.showOtpAlert();
        break;
      case 'auth_question':
        this.showAuthQuestionAlert();
        break;
      case 'safe':
        console.log(`✅ Trust score is safe: ${this.trustScore}`);
        break;
    }
  }

  private getCurrentAction(): 'logout' | 'otp' | 'auth_question' | 'safe' {
    if (this.trustScore <= 20) return 'logout';
    if (this.trustScore <= 40) return 'otp';
    if (this.trustScore <= 70) return 'auth_question';
    return 'safe';
  }

  private showLogoutAlert(): void {
    Alert.alert(
      '⚠️ Security Alert',
      'You are being logged out due to suspicious activity.',
      [
        {
          text: 'OK',
          onPress: () => {
            this.performLogout();
          },
        },
      ],
      { cancelable: false }
    );
  }

  private showOtpAlert(): void {
    // In a real app, this would show a modal with OTP input
    // For now, we'll use Alert with a simplified flow
    Alert.alert(
      '🔐 OTP Required',
      'Please verify your identity with OTP to continue.',
      [
        {
          text: 'Verify',
          onPress: () => {
            // In production, this would navigate to OTP screen
            this.authResetCount++;
            this.restoreTrust();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            this.detectBehavior(10); // OTP skip
          },
        },
      ]
    );
  }

  private showAuthQuestionAlert(): void {
    Alert.alert(
      '🔐 Security Question',
      'Additional verification required. Please confirm your identity.',
      [
        {
          text: 'Verify',
          onPress: () => {
            this.authResetCount++;
            this.restoreTrust();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            this.detectBehavior(44); // Failed auth
          },
        },
      ]
    );
  }

  private performLogout(): void {
    this.resetCounters();
    this.trustScore = 100;
    this.endSession();

    if (this.onLogoutCallback) {
      this.onLogoutCallback();
    }

    console.log('🚪 User logged out due to suspicious activity');
  }

  restoreTrust(): void {
    this.trustScore = 100;
    this.resetCounters();
    console.log('✅ Trust score restored to 100');
  }

  // ============================================================
  // Screen Recording Detection
  // ============================================================

  private startScreenRecordingDetection(): void {
    // Note: React Native doesn't have direct screen recording detection
    // We use expo-screen-capture for prevention, but detection is limited
    // This is a placeholder for the detection logic

    // In the actual implementation, we rely on:
    // 1. expo-screen-capture.preventScreenCaptureAsync() to block screenshots
    // 2. Monitoring for suspicious behavior patterns that might indicate
    //    screen mirroring tools (e.g., unusual timing patterns, repeated pauses)

    console.log('🔍 Screen recording detection started (prevention mode)');
  }

  setScreenRecordingDetected(detected: boolean): void {
    if (detected && !this.screenRecordingDetected) {
      this.screenRecordingDetected = true;
      this.detectBehavior(45);

      Alert.alert(
        '⚠️ Security Warning',
        'Screen recording is active. Please disable it to protect your banking session.',
        [{ text: 'OK' }]
      );
    }
  }

  // ============================================================
  // Trust Score Calculation
  // ============================================================

  private async calculateFinalTrustScore(): Promise<number> {
    // Calculate behavioral score from penalties
    const totalPenalty = this.appliedPenalties
      .map(id => BEHAVIOR_PENALTIES[id] || 0)
      .reduce((a, b) => a + b, 0);
    const behavioralScore = Math.max(0, Math.min(100, 100 + totalPenalty));

    // Get BBA score if available
    const bbaScore = bbaService.hasReliableProfile()
      ? 100 - bbaService.getQuickRiskScore()
      : 100;

    // Get session count for baseline weighting
    const sessionFiles = await this.getSessionFiles();
    const sessionCount = sessionFiles.length;

    // If no baseline yet, use simpler formula
    if (!this.userBaseline || sessionCount < 5) {
      console.log('📊 No baseline yet. Using: 70% Behavior + 30% BBA');
      return (behavioralScore * 0.7) + (bbaScore * 0.3);
    }

    // With baseline, include profile comparison
    const profileScore = this.computeUserProfileScore();
    console.log('📊 Baseline ready. Using: 60% Profile + 30% BBA + 10% Behavior');

    return (profileScore * 0.6) + (bbaScore * 0.3) + (behavioralScore * 0.1);
  }

  private computeUserProfileScore(): number {
    if (!this.userBaseline) return 100;

    // Calculate tap deviation
    const currentAvgTap = Object.values(this.tapDurations).length > 0
      ? Object.values(this.tapDurations).reduce((a, b) => a + b, 0) / Object.values(this.tapDurations).length
      : this.userBaseline.avgTapMs;

    const tapDeviation = Math.abs(currentAvgTap - this.userBaseline.avgTapMs);
    const tapScore = 100 - Math.min(100, (tapDeviation / Math.max(this.userBaseline.avgTapMs, 1)) * 100);

    // Calculate swipe deviation
    const currentAvgSwipe = this.swipeEvents.length > 0
      ? this.swipeEvents.reduce((sum, s) => sum + s.speed, 0) / this.swipeEvents.length
      : this.userBaseline.avgSwipeSpeed;

    const swipeDeviation = Math.abs(currentAvgSwipe - this.userBaseline.avgSwipeSpeed);
    const swipeScore = 100 - Math.min(100, (swipeDeviation / Math.max(this.userBaseline.avgSwipeSpeed, 1)) * 100);

    // Weighted average based on sample sizes
    const totalSamples = this.userBaseline.tapSamples + this.userBaseline.swipeSamples;
    if (totalSamples > 0) {
      return (
        (tapScore * this.userBaseline.tapSamples + swipeScore * this.userBaseline.swipeSamples) /
        totalSamples
      );
    }

    return (tapScore + swipeScore) / 2;
  }

  // ============================================================
  // Baseline Management
  // ============================================================

  private async loadUserBaseline(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@nexasafe_baseline');
      if (stored) {
        this.userBaseline = JSON.parse(stored);
        console.log('📊 User baseline loaded');
      }
    } catch (e) {
      console.error('Failed to load baseline:', e);
    }
  }

  private async checkForBaselineCreation(): Promise<void> {
    try {
      const sessionFiles = await this.getSessionFiles();
      const isBuilt = this.userBaseline !== null;

      // Build baseline from first 5 sessions, or rebuild every 5 sessions
      if (!isBuilt || (sessionFiles.length >= 5 && sessionFiles.length % 5 === 0)) {
        console.log('📊 Building baseline from sessions...');
        await this.buildBaselineFromSessions(sessionFiles.slice(0, 5));
      }
    } catch (e) {
      console.error('Error checking baseline:', e);
    }
  }

  private async getSessionFiles(): Promise<string[]> {
    try {
      const sessionDir = new Directory(Paths.document, 'nexasafe');

      if (!sessionDir.exists) {
        sessionDir.create();
        return [];
      }

      const files = sessionDir.list();
      return files
        .filter((f): f is File => f instanceof File && f.name.startsWith('session_log'))
        .map(f => f.name)
        .sort();
    } catch (e) {
      console.error('Error getting session files:', e);
      return [];
    }
  }

  private async buildBaselineFromSessions(sessionFiles: string[]): Promise<void> {
    const sessionDir = new Directory(Paths.document, 'nexasafe');
    let totalTap = 0;
    let tapCount = 0;
    let totalSwipe = 0;
    let swipeCount = 0;

    for (const fileName of sessionFiles) {
      try {
        const sessionFile = new File(sessionDir, fileName);
        const content = await sessionFile.text();
        const session: SessionData = JSON.parse(content);

        // Process tap durations
        Object.values(session.tapDurationsMs).forEach(ms => {
          totalTap += ms;
          tapCount++;
        });

        // Process swipe events
        session.swipeEvents.forEach(swipe => {
          totalSwipe += swipe.speed;
          swipeCount++;
        });
      } catch (e) {
        console.error(`Error processing session file ${fileName}:`, e);
      }
    }

    const baseline: UserBaseline = {
      avgTapMs: tapCount > 0 ? totalTap / tapCount : 0,
      avgSwipeSpeed: swipeCount > 0 ? totalSwipe / swipeCount : 0,
      createdAt: new Date().toISOString(),
      sessionsUsed: sessionFiles.length,
      tapSamples: tapCount,
      swipeSamples: swipeCount,
    };

    this.userBaseline = baseline;
    await AsyncStorage.setItem('@nexasafe_baseline', JSON.stringify(baseline));

    console.log(`📊 Baseline built: avgTap=${baseline.avgTapMs.toFixed(2)}ms, avgSwipe=${baseline.avgSwipeSpeed.toFixed(3)}`);
  }

  // ============================================================
  // Session Export
  // ============================================================

  private async exportSession(sessionData: SessionData): Promise<void> {
    try {
      const sessionDir = new Directory(Paths.document, 'nexasafe');

      if (!sessionDir.exists) {
        sessionDir.create();
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `session_log_${timestamp}.json`;

      const file = new File(sessionDir, filename);
      file.write(JSON.stringify(sessionData, null, 2));

      console.log(`📁 Session exported to ${filename}`);
    } catch (e) {
      console.error('Failed to export session:', e);
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  private async getDeviceInfo(): Promise<DeviceInfo> {
    let deviceId = await AsyncStorage.getItem('@device_id');
    if (!deviceId) {
      deviceId = `DEV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@device_id', deviceId);
    }

    return {
      deviceId,
      deviceModel: Device.modelName || 'Unknown',
      osName: Platform.OS,
      osVersion: Platform.Version?.toString() || 'Unknown',
      isEmulator: !Device.isDevice,
    };
  }

  private resetCounters(): void {
    this.highRiskActionCount = 0;
    this.scrollCount = 0;
    this.screenVisitCounts = {};
    this.otpSkipCount = 0;
    this.failedPinCount = 0;
    this.loansViewedCount = 0;
    this.inactiveAreaTapCount = 0;
    this.accountSwitchCount = 0;
    this.failedAuthCount = 0;
    this.recentTaps = [];
    this.tapEvents = [];
    this.swipeEvents = [];
    this.screenVisits = [];
    this.tapDurations = {};
    this.screenDurations = {};
    this.transactionAmount = null;
    this.fdBroken = false;
    this.loanTaken = false;
    this.fdTime = null;
    this.loanTime = null;
    this.transactionStartTime = null;
    this.transactionEndTime = null;
  }

  // ============================================================
  // Public Getters
  // ============================================================

  getTrustScore(): number {
    return this.trustScore;
  }

  getAppliedPenalties(): number[] {
    return [...this.appliedPenalties];
  }

  getBehaviorLogs(): BehaviorLog[] {
    return [...this.behaviorLogs];
  }

  isScreenRecordingActive(): boolean {
    return this.screenRecordingDetected;
  }

  setLogoutCallback(callback: () => void): void {
    this.onLogoutCallback = callback;
  }

  // For debugging
  printDebugInfo(): void {
    console.log('=== NexaSafe Debug Info ===');
    console.log(`Trust Score: ${this.trustScore}`);
    console.log(`Penalties Applied: ${this.appliedPenalties.join(', ')}`);
    console.log(`Session Duration: ${this.sessionStartTime ? Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000) : 0}s`);
    console.log(`Screens Visited: ${Object.keys(this.screenVisitCounts).length}`);
    console.log(`Tap Events: ${this.tapEvents.length}`);
    console.log(`Swipe Events: ${this.swipeEvents.length}`);
    console.log('============================');
  }
}

// Export singleton instance
export const nexaSafeTracker = NexaSafeTrackerManager.getInstance();
export { NexaSafeTrackerManager };
