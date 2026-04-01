/**
 * NexaSafe Context Provider
 * Provides fraud detection and behavioral analysis throughout the app
 * With real-time dashboard synchronization
 */

import React, { createContext, useContext, useEffect, useCallback, useState, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { nexaSafeTracker, SessionData, BehaviorLog } from '@/services/NexaSafeTrackerManager';
import ReauthModal from '@/components/ReauthModal';

const DASHBOARD_URL = process.env.EXPO_PUBLIC_DASHBOARD_URL?.trim();
const DASHBOARD_SYNC_ENABLED = Boolean(DASHBOARD_URL);

let dashboardSyncCooldownUntil = 0;
let lastDashboardSyncLogAt = 0;

// ============================================================
// Types
// ============================================================

interface NexaSafeContextValue {
  // Trust score
  trustScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';

  // Session management
  startSession: () => void;
  endSession: () => Promise<SessionData | null>;
  isSessionActive: boolean;

  // Tracking methods
  trackScreenVisit: (screenName: string) => void;
  trackTap: (screenName: string, x: number, y: number, zone?: string) => void;
  trackTapDuration: (screenName: string, durationMs: number) => void;
  trackSwipe: (startPos: number, endPos: number, durationMs: number) => void;

  // Transaction tracking
  trackTransactionStart: () => void;
  trackTransactionEnd: () => void;
  trackTransactionAmount: (amount: string) => void;
  trackLargeTransaction: (amount: number) => void;

  // Auth tracking
  trackFailedPin: () => void;
  trackFailedAuth: () => void;
  trackOtpSkip: () => void;

  // Feature tracking
  trackFDBroken: () => void;
  trackLoanViewed: () => void;
  trackAccountSwitch: () => void;
  trackImmediateTransaction: () => void;

  // Security
  setScreenRecordingDetected: (detected: boolean) => void;
  isScreenRecordingActive: boolean;

  // Analysis
  getBehaviorLogs: () => BehaviorLog[];
  getAppliedPenalties: () => number[];
  restoreTrust: () => void;

  // Callbacks
  setLogoutCallback: (callback: () => void) => void;

  // Reauthentication
  requiresReauth: boolean;
  reauthReason: string | null;
  reauthRiskLevel: 'medium' | 'high' | 'critical';
  showReauthModal: boolean;
  onReauthSuccess: () => void;
  onReauthFailure: () => void;
  onReauthClose: () => void;
  triggerReauth: (reason: string, riskLevel?: 'medium' | 'high' | 'critical') => void;
}

// ============================================================
// Context Creation
// ============================================================

const NexaSafeContext = createContext<NexaSafeContextValue | undefined>(undefined);

// ============================================================
// Provider Component
// ============================================================

interface NexaSafeProviderProps {
  children: ReactNode;
  onLogout?: () => void;
}

// Helper function to sync data to dashboard
const syncToDashboard = async (endpoint: string, data: any): Promise<void> => {
  if (!DASHBOARD_SYNC_ENABLED || !DASHBOARD_URL) {
    return;
  }

  if (Date.now() < dashboardSyncCooldownUntil) {
    return;
  }

  const url = `${DASHBOARD_URL}/api/nexasafe/${endpoint}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status >= 500) {
        dashboardSyncCooldownUntil = Date.now() + 30000;
      }

      const now = Date.now();
      if (now - lastDashboardSyncLogAt > 15000) {
        console.log(`❌ Dashboard sync failed: ${endpoint} - Status: ${response.status}`);
        lastDashboardSyncLogAt = now;
      }
    }
  } catch (error: any) {
    dashboardSyncCooldownUntil = Date.now() + 30000;

    const now = Date.now();
    if (now - lastDashboardSyncLogAt > 15000) {
      console.log(`❌ Dashboard sync error: ${endpoint} - ${error.message}`);
      lastDashboardSyncLogAt = now;
    }
  }
};

// Calculate risk level from trust score
const getRiskLevel = (score: number): 'safe' | 'caution' | 'warning' | 'danger' => {
  if (score >= 80) return 'safe';
  if (score >= 60) return 'caution';
  if (score >= 40) return 'warning';
  return 'danger';
};

export function NexaSafeProvider({ children, onLogout }: NexaSafeProviderProps) {
  const [trustScore, setTrustScore] = useState<number>(100);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isScreenRecordingActive, setIsScreenRecordingActive] = useState<boolean>(false);

  // Reauthentication state
  const [showReauthModal, setShowReauthModal] = useState<boolean>(false);
  const [reauthReason, setReauthReason] = useState<string | null>(null);
  const [reauthRiskLevel, setReauthRiskLevel] = useState<'medium' | 'high' | 'critical'>('medium');
  const [requiresReauth, setRequiresReauth] = useState<boolean>(false);
  const reauthTriggeredForScore = useRef<number | null>(null);

  // Track session data for dashboard
  const sessionStartTime = useRef<string | null>(null);
  const tapEvents = useRef<any[]>([]);
  const swipeEvents = useRef<any[]>([]);
  const screensVisited = useRef<any[]>([]);
  const screenDurations = useRef<Record<string, number>>({});
  const lastScreenTime = useRef<number>(Date.now());
  const currentScreen = useRef<string | null>(null);

  const riskLevel = getRiskLevel(trustScore);

  // Full sync to dashboard - sends complete session state
  const fullSyncToDashboard = useCallback(() => {
    if (!isSessionActive) return;

    const score = nexaSafeTracker.getTrustScore();
    const behaviorLogs = nexaSafeTracker.getBehaviorLogs();
    const appliedPenalties = nexaSafeTracker.getAppliedPenalties();

    syncToDashboard('sync', {
      trustScore: score,
      riskLevel: getRiskLevel(score),
      sessionActive: true,
      sessionStart: sessionStartTime.current,
      behaviorLogs,
      appliedPenalties,
      tapEvents: tapEvents.current,
      swipeEvents: swipeEvents.current,
      screensVisited: screensVisited.current,
      screenDurations: screenDurations.current,
      screenRecordingDetected: nexaSafeTracker.isScreenRecordingActive()
    });
  }, [isSessionActive]);

  // Update trust score periodically and sync to dashboard
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSessionActive) {
        const score = nexaSafeTracker.getTrustScore();
        setTrustScore(score);
        setIsScreenRecordingActive(nexaSafeTracker.isScreenRecordingActive());

        // Full sync to dashboard every second
        fullSyncToDashboard();

        // Auto-trigger reauthentication based on trust score thresholds
        // Thresholds: 70 = caution (medium), 50 = warning (high), 30 = danger (critical)
        if (score <= 70 && score > 50 && reauthTriggeredForScore.current !== 70 && !showReauthModal) {
          reauthTriggeredForScore.current = 70;
          console.log('🔐 Trust score dropped to caution level, triggering reauth');
          setReauthReason('Unusual activity pattern detected. Please verify your identity.');
          setReauthRiskLevel('medium');
          setRequiresReauth(true);
          setShowReauthModal(true);
        } else if (score <= 50 && score > 30 && reauthTriggeredForScore.current !== 50 && !showReauthModal) {
          reauthTriggeredForScore.current = 50;
          console.log('🔐 Trust score dropped to warning level, triggering reauth');
          setReauthReason('Suspicious activity detected! Identity verification required.');
          setReauthRiskLevel('high');
          setRequiresReauth(true);
          setShowReauthModal(true);
        } else if (score <= 30 && reauthTriggeredForScore.current !== 30 && !showReauthModal) {
          reauthTriggeredForScore.current = 30;
          console.log('🔐 Trust score dropped to danger level, triggering critical reauth');
          setReauthReason('High-risk activity detected! Immediate verification required.');
          setReauthRiskLevel('critical');
          setRequiresReauth(true);
          setShowReauthModal(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, fullSyncToDashboard, showReauthModal]);

  // Set logout callback
  useEffect(() => {
    if (onLogout) {
      nexaSafeTracker.setLogoutCallback(onLogout);
    }
  }, [onLogout]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isSessionActive) {
        setTrustScore(nexaSafeTracker.getTrustScore());
        fullSyncToDashboard();
      } else if (nextState === 'background' && isSessionActive) {
        console.log('📱 App moved to background during NexaSafe session');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isSessionActive, fullSyncToDashboard]);

  // ============================================================
  // Session Management
  // ============================================================

  const startSession = useCallback(() => {
    // Reset tracking arrays
    sessionStartTime.current = new Date().toISOString();
    tapEvents.current = [];
    swipeEvents.current = [];
    screensVisited.current = [];
    screenDurations.current = {};
    lastScreenTime.current = Date.now();
    currentScreen.current = null;

    nexaSafeTracker.startSession();
    setIsSessionActive(true);
    setTrustScore(100);
    console.log('🔒 NexaSafe session started via context');

    // Notify dashboard
    syncToDashboard('session/start', {
      sessionStart: sessionStartTime.current,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version
      }
    });
  }, []);

  const endSession = useCallback(async (): Promise<SessionData | null> => {
    // Update last screen duration
    if (currentScreen.current) {
      const duration = Math.floor((Date.now() - lastScreenTime.current) / 1000);
      screenDurations.current[currentScreen.current] =
        (screenDurations.current[currentScreen.current] || 0) + duration;
    }

    const sessionData = await nexaSafeTracker.endSession();
    setIsSessionActive(false);
    console.log('🔓 NexaSafe session ended via context');

    // Notify dashboard
    syncToDashboard('session/end', {});

    return sessionData;
  }, []);

  // ============================================================
  // Tracking Methods
  // ============================================================

  const trackScreenVisit = useCallback((screenName: string) => {
    if (isSessionActive) {
      // Update previous screen duration
      if (currentScreen.current) {
        const duration = Math.floor((Date.now() - lastScreenTime.current) / 1000);
        screenDurations.current[currentScreen.current] =
          (screenDurations.current[currentScreen.current] || 0) + duration;
      }

      // Track new screen
      currentScreen.current = screenName;
      lastScreenTime.current = Date.now();

      screensVisited.current.push({
        screen: screenName,
        timestamp: new Date().toISOString()
      });

      nexaSafeTracker.onScreenVisited(screenName);
      setTrustScore(nexaSafeTracker.getTrustScore());

      // Sync screen visit to dashboard immediately
      syncToDashboard('screen', {
        screen: screenName,
        duration: screenDurations.current[screenName] || 0
      });
    }
  }, [isSessionActive]);

  const trackTap = useCallback((screenName: string, x: number, y: number, zone: string = 'active') => {
    if (isSessionActive) {
      const tapEvent = {
        screen: screenName,
        position: { x, y },
        zone,
        timestamp: new Date().toISOString()
      };

      tapEvents.current.push(tapEvent);
      nexaSafeTracker.recordTapPosition(screenName, x, y, zone);
      setTrustScore(nexaSafeTracker.getTrustScore());

      // Sync tap to dashboard
      syncToDashboard('tap', tapEvent);
    }
  }, [isSessionActive]);

  const trackTapDuration = useCallback((screenName: string, durationMs: number) => {
    if (isSessionActive) {
      // Update the last tap event with duration
      if (tapEvents.current.length > 0) {
        tapEvents.current[tapEvents.current.length - 1].durationMs = durationMs;
      }

      nexaSafeTracker.recordTapDuration(screenName, durationMs);
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // If behavior was detected, sync immediately
      syncToDashboard('trust-score', {
        trustScore: newScore,
        behaviorLogs: nexaSafeTracker.getBehaviorLogs(),
        appliedPenalties: nexaSafeTracker.getAppliedPenalties()
      });
    }
  }, [isSessionActive]);

  const trackSwipe = useCallback((startPos: number, endPos: number, durationMs: number) => {
    if (isSessionActive) {
      const distance = Math.abs(endPos - startPos);
      const speed = durationMs > 0 ? distance / durationMs : 0;

      const swipeEvent = {
        startPos,
        endPos,
        distance,
        speed,
        durationMs,
        timestamp: new Date().toISOString()
      };

      swipeEvents.current.push(swipeEvent);
      nexaSafeTracker.onSwipeEnd(startPos, endPos, durationMs);
      setTrustScore(nexaSafeTracker.getTrustScore());

      // Sync swipe to dashboard
      syncToDashboard('swipe', swipeEvent);
    }
  }, [isSessionActive]);

  // ============================================================
  // Transaction Tracking
  // ============================================================

  const trackTransactionStart = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.markTransactionStart();
      nexaSafeTracker.trackImmediateTransaction();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // Sync behavior if detected
      syncToDashboard('behavior', {
        behaviorId: 1, // Immediate transaction
        extraData: { action: 'transaction_start' }
      });
    }
  }, [isSessionActive]);

  const trackTransactionEnd = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.markTransactionEnd();
    }
  }, [isSessionActive]);

  const trackTransactionAmount = useCallback((amount: string) => {
    if (isSessionActive) {
      nexaSafeTracker.recordTransferAmount(amount);
      setTrustScore(nexaSafeTracker.getTrustScore());
    }
  }, [isSessionActive]);

  const trackLargeTransaction = useCallback((amount: number) => {
    if (isSessionActive && amount >= 50000) {
      nexaSafeTracker.detectBehavior(50, amount);
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // Sync large transaction behavior
      syncToDashboard('behavior', {
        behaviorId: 50,
        extraData: { amount }
      });
    }
  }, [isSessionActive]);

  // ============================================================
  // Auth Tracking
  // ============================================================

  const trackFailedPin = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.trackFailedPinAttempt();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // Sync failed PIN behavior
      syncToDashboard('behavior', {
        behaviorId: 21,
        extraData: { action: 'failed_pin' }
      });
    }
  }, [isSessionActive]);

  const trackFailedAuth = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.trackFailedAuth();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // Sync failed auth behavior
      syncToDashboard('behavior', {
        behaviorId: 44,
        extraData: { action: 'failed_auth' }
      });
    }
  }, [isSessionActive]);

  const trackOtpSkip = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.trackOtpSkip();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      // Sync OTP skip behavior
      syncToDashboard('behavior', {
        behaviorId: 10,
        extraData: { action: 'otp_skip' }
      });
    }
  }, [isSessionActive]);

  // ============================================================
  // Feature Tracking
  // ============================================================

  const trackFDBroken = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.recordFDBroken();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      syncToDashboard('behavior', {
        behaviorId: 2,
        extraData: { action: 'fd_broken' }
      });
    }
  }, [isSessionActive]);

  const trackLoanViewed = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.recordLoanTaken();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      syncToDashboard('behavior', {
        behaviorId: 3,
        extraData: { action: 'loan_viewed' }
      });
    }
  }, [isSessionActive]);

  const trackAccountSwitch = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.trackAccountSwitch();
      const newScore = nexaSafeTracker.getTrustScore();
      setTrustScore(newScore);

      syncToDashboard('behavior', {
        behaviorId: 42,
        extraData: { action: 'account_switch' }
      });
    }
  }, [isSessionActive]);

  const trackImmediateTransaction = useCallback(() => {
    if (isSessionActive) {
      nexaSafeTracker.trackImmediateTransaction();
      setTrustScore(nexaSafeTracker.getTrustScore());
    }
  }, [isSessionActive]);

  // ============================================================
  // Security
  // ============================================================

  const setScreenRecordingDetected = useCallback((detected: boolean) => {
    nexaSafeTracker.setScreenRecordingDetected(detected);
    setIsScreenRecordingActive(detected);
    setTrustScore(nexaSafeTracker.getTrustScore());

    if (detected) {
      syncToDashboard('behavior', {
        behaviorId: 45,
        extraData: { action: 'screen_recording_detected' }
      });
    }
  }, []);

  // ============================================================
  // Analysis
  // ============================================================

  const getBehaviorLogs = useCallback(() => {
    return nexaSafeTracker.getBehaviorLogs();
  }, []);

  const getAppliedPenalties = useCallback(() => {
    return nexaSafeTracker.getAppliedPenalties();
  }, []);

  const restoreTrust = useCallback(() => {
    nexaSafeTracker.restoreTrust();
    setTrustScore(100);
    fullSyncToDashboard();
  }, [fullSyncToDashboard]);

  const setLogoutCallback = useCallback((callback: () => void) => {
    nexaSafeTracker.setLogoutCallback(callback);
  }, []);

  // ============================================================
  // Reauthentication Functions
  // ============================================================

  const triggerReauth = useCallback((reason: string, riskLevel: 'medium' | 'high' | 'critical' = 'medium') => {
    console.log(`🔐 Triggering reauthentication: ${reason} (Risk: ${riskLevel})`);
    setReauthReason(reason);
    setReauthRiskLevel(riskLevel);
    setRequiresReauth(true);
    setShowReauthModal(true);

    // Sync to dashboard
    syncToDashboard('behavior', {
      behaviorId: 99, // Custom ID for reauth trigger
      extraData: { reason, riskLevel, trustScore }
    });
  }, [trustScore]);

  const onReauthSuccess = useCallback(() => {
    console.log('✅ Reauthentication successful - restoring trust');
    setShowReauthModal(false);
    setRequiresReauth(false);
    setReauthReason(null);

    // Restore trust score after successful reauth
    nexaSafeTracker.restoreTrust();
    setTrustScore(100);
    reauthTriggeredForScore.current = null;

    // Sync success to dashboard
    syncToDashboard('sync', {
      trustScore: 100,
      riskLevel: 'safe',
      sessionActive: true,
      reauthSuccess: true
    });
  }, []);

  const onReauthFailure = useCallback(() => {
    console.log('❌ Reauthentication failed - logging out');
    setShowReauthModal(false);
    setRequiresReauth(false);
    setReauthReason(null);

    // End session and trigger logout
    nexaSafeTracker.endSession();
    setIsSessionActive(false);

    // Notify dashboard
    syncToDashboard('session/end', { reason: 'reauth_failed' });

    // Trigger logout callback
    if (onLogout) {
      onLogout();
    }
  }, [onLogout]);

  const onReauthClose = useCallback(() => {
    // Close without success = cancel transaction but don't logout
    setShowReauthModal(false);
    // Keep requiresReauth true so transactions are blocked
  }, []);

  // ============================================================
  // Context Value
  // ============================================================

  const value: NexaSafeContextValue = {
    trustScore,
    riskLevel,
    startSession,
    endSession,
    isSessionActive,
    trackScreenVisit,
    trackTap,
    trackTapDuration,
    trackSwipe,
    trackTransactionStart,
    trackTransactionEnd,
    trackTransactionAmount,
    trackLargeTransaction,
    trackFailedPin,
    trackFailedAuth,
    trackOtpSkip,
    trackFDBroken,
    trackLoanViewed,
    trackAccountSwitch,
    trackImmediateTransaction,
    setScreenRecordingDetected,
    isScreenRecordingActive,
    getBehaviorLogs,
    getAppliedPenalties,
    restoreTrust,
    setLogoutCallback,
    // Reauthentication
    requiresReauth,
    reauthReason,
    reauthRiskLevel,
    showReauthModal,
    onReauthSuccess,
    onReauthFailure,
    onReauthClose,
    triggerReauth,
  };

  return (
    <NexaSafeContext.Provider value={value}>
      {children}
      <ReauthModal
        visible={showReauthModal}
        onClose={onReauthClose}
        onSuccess={onReauthSuccess}
        onFailure={onReauthFailure}
        riskLevel={reauthRiskLevel}
        reason={reauthReason || undefined}
        suggestedMethod="biometric"
        maxAttempts={3}
      />
    </NexaSafeContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useNexaSafe(): NexaSafeContextValue {
  const context = useContext(NexaSafeContext);
  if (context === undefined) {
    throw new Error('useNexaSafe must be used within a NexaSafeProvider');
  }
  return context;
}

// ============================================================
// Helper Hook for Screen Tracking
// ============================================================

export function useNexaSafeScreen(screenName: string) {
  const { trackScreenVisit, trackTap, trackTapDuration, isSessionActive } = useNexaSafe();

  useEffect(() => {
    if (isSessionActive) {
      trackScreenVisit(screenName);
    }
  }, [screenName, isSessionActive, trackScreenVisit]);

  const handleTap = useCallback((x: number, y: number, zone?: string) => {
    trackTap(screenName, x, y, zone);
  }, [screenName, trackTap]);

  const handleTapDuration = useCallback((durationMs: number) => {
    trackTapDuration(screenName, durationMs);
  }, [screenName, trackTapDuration]);

  return {
    handleTap,
    handleTapDuration,
  };
}

export default NexaSafeContext;
