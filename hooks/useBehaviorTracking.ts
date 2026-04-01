/**
 * Behavior Tracking Hook
 * React hook for easy integration of behavior tracking in screens
 */

import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  behaviorAnalysis,
  TransactionAnalysisResult,
  ReauthCheckResult,
  RiskAssessment
} from '../services/behaviorAnalysis';

interface UseBehaviorTrackingOptions {
  userId?: string;
  trackScreenViews?: boolean;
  trackAppState?: boolean;
}

interface BehaviorTrackingHook {
  // Core functions
  setUserId: (userId: string) => void;
  startSession: () => string;
  recordAction: () => void;

  // Event tracking
  trackEvent: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
  trackAuthEvent: (method: 'pin' | 'biometric', success: boolean) => Promise<void>;
  trackScreenView: (screenName: string) => Promise<void>;
  trackButtonClick: (buttonId: string, buttonLabel?: string) => Promise<void>;

  // Transaction analysis
  analyzeTransaction: (
    amount: number,
    recipientUpiId: string,
    recipientName?: string
  ) => Promise<TransactionAnalysisResult | null>;

  checkReauthRequired: (
    amount: number,
    recipientUpiId?: string
  ) => Promise<ReauthCheckResult | null>;

  trackTransaction: (
    transactionId: string,
    orderId: string,
    amount: number,
    status: string,
    recipient: { upiId: string; name?: string },
    riskAssessment?: RiskAssessment
  ) => Promise<void>;

  // Alert management
  resolveAlert: (
    alertId: string,
    reauthMethod: string,
    reauthSuccessful: boolean
  ) => Promise<{ success: boolean; canProceed: boolean } | null>;

  // Data retrieval
  getAlerts: (limit?: number) => Promise<any[] | null>;
  getStatistics: (days?: number) => Promise<any | null>;
  getProfile: () => Promise<any | null>;

  // Session info
  getSessionInfo: () => {
    sessionId: string;
    sessionDuration: number;
    actionsBeforeTransaction: number;
  };
}

export function useBehaviorTracking(
  options: UseBehaviorTrackingOptions = {}
): BehaviorTrackingHook {
  const { userId, trackScreenViews = true, trackAppState = true } = options;
  const navigation = useNavigation();
  const route = useRoute();
  const lastScreenRef = useRef<string>('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize user ID if provided
  useEffect(() => {
    if (userId) {
      behaviorAnalysis.setUserId(userId);
    }
  }, [userId]);

  // Track screen views automatically
  useEffect(() => {
    if (!trackScreenViews) return;

    const currentScreen = route.name;
    if (currentScreen !== lastScreenRef.current) {
      trackScreenView(currentScreen);
      lastScreenRef.current = currentScreen;
    }
  }, [route.name, trackScreenViews]);

  // Track app state changes
  useEffect(() => {
    if (!trackAppState) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground
        behaviorAnalysis.trackEvent('app_foreground');
      } else if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background
        behaviorAnalysis.trackEvent('app_background');
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [trackAppState]);

  // Core functions
  const setUserId = useCallback((id: string) => {
    behaviorAnalysis.setUserId(id);
  }, []);

  const startSession = useCallback(() => {
    return behaviorAnalysis.startSession();
  }, []);

  const recordAction = useCallback(() => {
    behaviorAnalysis.recordAction();
  }, []);

  // Event tracking
  const trackEvent = useCallback(
    async (eventType: string, eventData?: Record<string, any>) => {
      await behaviorAnalysis.trackEvent(eventType, eventData);
    },
    []
  );

  const trackAuthEvent = useCallback(
    async (method: 'pin' | 'biometric', success: boolean) => {
      await behaviorAnalysis.trackAuthEvent(method, success);
    },
    []
  );

  const trackScreenView = useCallback(async (screenName: string) => {
    await behaviorAnalysis.trackEvent('screen_view', { screenName });
  }, []);

  const trackButtonClick = useCallback(
    async (buttonId: string, buttonLabel?: string) => {
      await behaviorAnalysis.trackEvent('button_click', { buttonId, buttonLabel });
    },
    []
  );

  // Transaction analysis
  const analyzeTransaction = useCallback(
    async (
      amount: number,
      recipientUpiId: string,
      recipientName?: string
    ): Promise<TransactionAnalysisResult | null> => {
      return await behaviorAnalysis.analyzeTransaction(
        amount,
        recipientUpiId,
        recipientName
      );
    },
    []
  );

  const checkReauthRequired = useCallback(
    async (
      amount: number,
      recipientUpiId?: string
    ): Promise<ReauthCheckResult | null> => {
      return await behaviorAnalysis.checkReauthRequired(amount, recipientUpiId);
    },
    []
  );

  const trackTransaction = useCallback(
    async (
      transactionId: string,
      orderId: string,
      amount: number,
      status: string,
      recipient: { upiId: string; name?: string },
      riskAssessment?: RiskAssessment
    ) => {
      await behaviorAnalysis.trackTransaction(
        transactionId,
        orderId,
        amount,
        status,
        recipient,
        riskAssessment
      );
    },
    []
  );

  // Alert management
  const resolveAlert = useCallback(
    async (
      alertId: string,
      reauthMethod: string,
      reauthSuccessful: boolean
    ) => {
      return await behaviorAnalysis.resolveAlert(
        alertId,
        reauthMethod,
        reauthSuccessful
      );
    },
    []
  );

  // Data retrieval
  const getAlerts = useCallback(async (limit: number = 20) => {
    return await behaviorAnalysis.getAlerts(limit);
  }, []);

  const getStatistics = useCallback(async (days: number = 30) => {
    return await behaviorAnalysis.getStatistics(days);
  }, []);

  const getProfile = useCallback(async () => {
    return await behaviorAnalysis.getProfile();
  }, []);

  // Session info
  const getSessionInfo = useCallback(() => {
    return behaviorAnalysis.getSessionInfo();
  }, []);

  return {
    setUserId,
    startSession,
    recordAction,
    trackEvent,
    trackAuthEvent,
    trackScreenView,
    trackButtonClick,
    analyzeTransaction,
    checkReauthRequired,
    trackTransaction,
    resolveAlert,
    getAlerts,
    getStatistics,
    getProfile,
    getSessionInfo
  };
}

export default useBehaviorTracking;
