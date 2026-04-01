/**
 * Unified Security Monitor Hook
 * Combines behavior analysis and SMS fraud detection into a single hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { smsMonitor, SMSMessage, SMSAnalysisResult, SMSFraudAlert } from '../services/smsMonitor';
import { behaviorAnalysis, TransactionAnalysisResult, ReauthCheckResult } from '../services/behaviorAnalysis';

// Combined security state
export interface SecurityState {
  // Behavior Analysis
  behaviorInitialized: boolean;
  lastTransactionRisk: number | null;
  reauthRequired: boolean;
  behaviorAlerts: any[];

  // SMS Monitoring
  smsMonitoringActive: boolean;
  smsPermissionGranted: boolean;
  pendingSmsAlerts: SMSFraudAlert[];
  currentSmsAlert: {
    visible: boolean;
    message: SMSMessage | null;
    analysis: SMSAnalysisResult | null;
  };

  // Overall Security
  overallRiskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  securityScore: number;
  lastSecurityCheck: Date | null;
}

// Hook options
interface UseSecurityMonitorOptions {
  userId: string;
  enableBehaviorTracking?: boolean;
  enableSmsMonitoring?: boolean;
  autoRequestSmsPermission?: boolean;
  onFraudDetected?: (type: 'behavior' | 'sms', data: any) => void;
  onReauthRequired?: (alertId: string, riskScore: number) => void;
}

// Hook return type
interface SecurityMonitorHook {
  // State
  state: SecurityState;

  // Behavior Analysis
  analyzeTransaction: (amount: number, recipientUpiId: string, recipientName?: string) => Promise<TransactionAnalysisResult | null>;
  checkReauthRequired: (amount: number, recipientUpiId?: string) => Promise<ReauthCheckResult | null>;
  trackEvent: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
  trackAuthEvent: (method: 'pin' | 'biometric', success: boolean) => Promise<void>;
  resolveBehaviorAlert: (alertId: string, reauthMethod: string, success: boolean) => Promise<any>;

  // SMS Monitoring
  requestSmsPermission: () => Promise<boolean>;
  startSmsMonitoring: () => void;
  stopSmsMonitoring: () => void;
  analyzeSms: (message: string, sender?: string) => Promise<SMSAnalysisResult | null>;
  reportSmsSpam: (message: string, sender?: string) => Promise<boolean>;
  dismissSmsAlert: () => void;
  getSmsAlerts: (limit?: number) => Promise<SMSFraudAlert[] | null>;

  // Combined
  getSecurityDashboard: () => Promise<SecurityDashboardData>;
  refreshSecurityStatus: () => Promise<void>;
}

// Dashboard data structure
export interface SecurityDashboardData {
  overallScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';

  behaviorAnalysis: {
    transactionsAnalyzed: number;
    alertsTriggered: number;
    averageRiskScore: number;
    trustScore: number;
  };

  smsProtection: {
    messagesScanned: number;
    fraudDetected: number;
    lastScanTime: Date | null;
    topThreats: string[];
  };

  recentAlerts: Array<{
    id: string;
    type: 'behavior' | 'sms';
    riskLevel: string;
    timestamp: Date;
    description: string;
  }>;

  recommendations: string[];
}

export function useSecurityMonitor(options: UseSecurityMonitorOptions): SecurityMonitorHook {
  const {
    userId,
    enableBehaviorTracking = true,
    enableSmsMonitoring = true,
    autoRequestSmsPermission = false,
    onFraudDetected,
    onReauthRequired,
  } = options;

  // State
  const [state, setState] = useState<SecurityState>({
    behaviorInitialized: false,
    lastTransactionRisk: null,
    reauthRequired: false,
    behaviorAlerts: [],
    smsMonitoringActive: false,
    smsPermissionGranted: false,
    pendingSmsAlerts: [],
    currentSmsAlert: {
      visible: false,
      message: null,
      analysis: null,
    },
    overallRiskLevel: 'safe',
    securityScore: 100,
    lastSecurityCheck: null,
  });

  const monitoringRef = useRef(false);

  // Initialize services
  useEffect(() => {
    if (userId) {
      // Set user ID for both services
      behaviorAnalysis.setUserId(userId);
      smsMonitor.setUserId(userId);

      // Initialize behavior tracking
      if (enableBehaviorTracking) {
        behaviorAnalysis.startSession();
        setState(prev => ({ ...prev, behaviorInitialized: true }));
      }

      // Initialize SMS monitoring
      if (enableSmsMonitoring && Platform.OS === 'android') {
        initializeSmsMonitoring();
      }
    }

    return () => {
      monitoringRef.current = false;
    };
  }, [userId, enableBehaviorTracking, enableSmsMonitoring]);

  // Initialize SMS monitoring
  const initializeSmsMonitoring = async () => {
    const hasPermission = await smsMonitor.hasPermissions();

    setState(prev => ({ ...prev, smsPermissionGranted: hasPermission }));

    if (hasPermission) {
      setupSmsCallbacks();
      setState(prev => ({ ...prev, smsMonitoringActive: true }));
    } else if (autoRequestSmsPermission) {
      const granted = await smsMonitor.requestPermissions();
      if (granted) {
        setupSmsCallbacks();
        setState(prev => ({
          ...prev,
          smsPermissionGranted: true,
          smsMonitoringActive: true
        }));
      }
    }
  };

  // Setup SMS callbacks
  const setupSmsCallbacks = () => {
    smsMonitor.onSMSReceivedCallback((message, analysis) => {
      console.log('[SecurityMonitor] SMS received and analyzed:', message.address);
    });

    smsMonitor.onFraudDetectedCallback((message, analysis) => {
      console.log('[SecurityMonitor] Fraud detected in SMS:', message.address);

      // Show alert
      setState(prev => ({
        ...prev,
        currentSmsAlert: {
          visible: true,
          message,
          analysis,
        },
      }));

      // Call callback
      if (onFraudDetected) {
        onFraudDetected('sms', { message, analysis });
      }
    });

    monitoringRef.current = true;
  };

  // Request SMS permission
  const requestSmsPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    const granted = await smsMonitor.requestPermissions();
    setState(prev => ({ ...prev, smsPermissionGranted: granted }));

    if (granted && !monitoringRef.current) {
      setupSmsCallbacks();
      setState(prev => ({ ...prev, smsMonitoringActive: true }));
    }

    return granted;
  }, []);

  // Start SMS monitoring
  const startSmsMonitoring = useCallback(() => {
    if (state.smsPermissionGranted && !monitoringRef.current) {
      setupSmsCallbacks();
      setState(prev => ({ ...prev, smsMonitoringActive: true }));
    }
  }, [state.smsPermissionGranted]);

  // Stop SMS monitoring
  const stopSmsMonitoring = useCallback(() => {
    monitoringRef.current = false;
    setState(prev => ({ ...prev, smsMonitoringActive: false }));
  }, []);

  // Analyze SMS manually
  const analyzeSms = useCallback(async (
    message: string,
    sender?: string
  ): Promise<SMSAnalysisResult | null> => {
    const result = await smsMonitor.analyzeSMS(message, sender);

    if (result?.shouldShowAlert) {
      setState(prev => ({
        ...prev,
        currentSmsAlert: {
          visible: true,
          message: {
            id: Date.now().toString(),
            address: sender || 'Unknown',
            body: message,
            date: Date.now(),
            read: false,
            type: 'inbox',
          },
          analysis: result,
        },
      }));

      if (onFraudDetected) {
        onFraudDetected('sms', { message, sender, analysis: result });
      }
    }

    return result;
  }, [onFraudDetected]);

  // Report SMS as spam
  const reportSmsSpam = useCallback(async (
    message: string,
    sender?: string
  ): Promise<boolean> => {
    return await smsMonitor.reportSpam(message, sender);
  }, []);

  // Dismiss current SMS alert
  const dismissSmsAlert = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSmsAlert: {
        visible: false,
        message: null,
        analysis: null,
      },
    }));
  }, []);

  // Get SMS alerts
  const getSmsAlerts = useCallback(async (limit: number = 50): Promise<SMSFraudAlert[] | null> => {
    const alerts = await smsMonitor.getAlerts(limit);
    if (alerts) {
      setState(prev => ({ ...prev, pendingSmsAlerts: alerts }));
    }
    return alerts;
  }, []);

  // Analyze transaction
  const analyzeTransaction = useCallback(async (
    amount: number,
    recipientUpiId: string,
    recipientName?: string
  ): Promise<TransactionAnalysisResult | null> => {
    const result = await behaviorAnalysis.analyzeTransaction(
      amount,
      recipientUpiId,
      recipientName
    );

    if (result) {
      setState(prev => ({
        ...prev,
        lastTransactionRisk: result.riskAssessment.overallScore,
        reauthRequired: result.recommendation.action === 'reauth',
      }));

      if (result.recommendation.action === 'reauth' && onReauthRequired) {
        onReauthRequired(result.transactionId, result.riskAssessment.overallScore);
      }

      if (result.recommendation.action === 'block' && onFraudDetected) {
        onFraudDetected('behavior', result);
      }
    }

    return result;
  }, [onReauthRequired, onFraudDetected]);

  // Check if re-auth required
  const checkReauthRequired = useCallback(async (
    amount: number,
    recipientUpiId?: string
  ): Promise<ReauthCheckResult | null> => {
    const result = await behaviorAnalysis.checkReauthRequired(amount, recipientUpiId);

    if (result) {
      setState(prev => ({
        ...prev,
        reauthRequired: result.requiresReauth,
      }));

      if (result.requiresReauth && result.alertId && onReauthRequired) {
        onReauthRequired(result.alertId, result.riskScore);
      }
    }

    return result;
  }, [onReauthRequired]);

  // Track event
  const trackEvent = useCallback(async (
    eventType: string,
    eventData?: Record<string, any>
  ): Promise<void> => {
    await behaviorAnalysis.trackEvent(eventType, eventData);
  }, []);

  // Track auth event
  const trackAuthEvent = useCallback(async (
    method: 'pin' | 'biometric',
    success: boolean
  ): Promise<void> => {
    await behaviorAnalysis.trackAuthEvent(method, success);
  }, []);

  // Resolve behavior alert
  const resolveBehaviorAlert = useCallback(async (
    alertId: string,
    reauthMethod: string,
    success: boolean
  ): Promise<any> => {
    const result = await behaviorAnalysis.resolveAlert(alertId, reauthMethod, success);

    if (result?.success) {
      setState(prev => ({ ...prev, reauthRequired: false }));
    }

    return result;
  }, []);

  // Get security dashboard data
  const getSecurityDashboard = useCallback(async (): Promise<SecurityDashboardData> => {
    const [behaviorStats, smsAlerts, behaviorProfile] = await Promise.all([
      behaviorAnalysis.getStatistics(30),
      smsMonitor.getAlerts(50),
      behaviorAnalysis.getProfile(),
    ]);

    // Calculate overall score
    let overallScore = 100;
    let riskLevel: SecurityState['overallRiskLevel'] = 'safe';
    const recommendations: string[] = [];
    const recentAlerts: SecurityDashboardData['recentAlerts'] = [];

    // Factor in behavior analysis
    if (behaviorStats) {
      const behaviorRisk = behaviorStats.averageRiskScore || 0;
      overallScore -= behaviorRisk * 0.5;

      if (behaviorStats.blockedTransactions > 0) {
        recommendations.push('Review blocked transactions in your security history');
      }
    }

    // Factor in SMS threats
    if (smsAlerts && smsAlerts.length > 0) {
      const criticalAlerts = smsAlerts.filter(a => a.riskLevel === 'critical' || a.riskLevel === 'high');
      overallScore -= criticalAlerts.length * 5;

      smsAlerts.slice(0, 5).forEach(alert => {
        recentAlerts.push({
          id: alert.alertId,
          type: 'sms',
          riskLevel: alert.riskLevel,
          timestamp: new Date(alert.createdAt),
          description: `Suspicious SMS from ${alert.sender}`,
        });
      });

      if (criticalAlerts.length > 0) {
        recommendations.push(`${criticalAlerts.length} high-risk SMS detected - be cautious of scam messages`);
      }
    }

    // Determine risk level
    overallScore = Math.max(0, Math.min(100, overallScore));
    if (overallScore >= 80) riskLevel = 'safe';
    else if (overallScore >= 60) riskLevel = 'low';
    else if (overallScore >= 40) riskLevel = 'medium';
    else if (overallScore >= 20) riskLevel = 'high';
    else riskLevel = 'critical';

    // Add general recommendations
    if (!state.smsPermissionGranted && Platform.OS === 'android') {
      recommendations.push('Enable SMS monitoring for enhanced fraud protection');
    }

    return {
      overallScore,
      riskLevel,
      behaviorAnalysis: {
        transactionsAnalyzed: behaviorStats?.totalTransactions || 0,
        alertsTriggered: behaviorStats?.alertsTriggered || 0,
        averageRiskScore: behaviorStats?.averageRiskScore || 0,
        trustScore: behaviorProfile?.trustScore || 50,
      },
      smsProtection: {
        messagesScanned: smsAlerts?.length || 0,
        fraudDetected: smsAlerts?.filter(a => a.isFraud).length || 0,
        lastScanTime: smsAlerts?.[0] ? new Date(smsAlerts[0].createdAt) : null,
        topThreats: [...new Set(smsAlerts?.slice(0, 5).map(a => a.riskLevel) || [])],
      },
      recentAlerts,
      recommendations,
    };
  }, [state.smsPermissionGranted]);

  // Refresh security status
  const refreshSecurityStatus = useCallback(async () => {
    const dashboard = await getSecurityDashboard();

    setState(prev => ({
      ...prev,
      overallRiskLevel: dashboard.riskLevel,
      securityScore: dashboard.overallScore,
      lastSecurityCheck: new Date(),
    }));
  }, [getSecurityDashboard]);

  return {
    state,
    analyzeTransaction,
    checkReauthRequired,
    trackEvent,
    trackAuthEvent,
    resolveBehaviorAlert,
    requestSmsPermission,
    startSmsMonitoring,
    stopSmsMonitoring,
    analyzeSms,
    reportSmsSpam,
    dismissSmsAlert,
    getSmsAlerts,
    getSecurityDashboard,
    refreshSecurityStatus,
  };
}

export default useSecurityMonitor;
