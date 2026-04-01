/**
 * useSMSMonitor Hook
 *
 * React hook for integrating real-time SMS fraud detection into components.
 *
 * Usage:
 * ```tsx
 * const { isMonitoring, stats, recentAlerts, startMonitoring, stopMonitoring } = useSMSMonitor();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { nativeSMSModule } from '@/services/NativeSMSModule';
import realTimeSMSMonitor, {
  IncomingSMS,
  FraudAnalysis,
  SMSFraudRecord,
  DashboardStats
} from '@/services/RealTimeSMSMonitor';

interface UseSMSMonitorOptions {
  autoStart?: boolean;
  onSMSReceived?: (sms: IncomingSMS, analysis: FraudAnalysis) => void;
  onFraudDetected?: (record: SMSFraudRecord) => void;
}

interface UseSMSMonitorReturn {
  // State
  isMonitoring: boolean;
  isMockMode: boolean;
  hasPermissions: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  stats: DashboardStats;
  recentAlerts: SMSFraudRecord[];
  blockedSenders: string[];
  trustedSenders: string[];

  // Actions
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  blockSender: (sender: string) => Promise<void>;
  unblockSender: (sender: string) => Promise<void>;
  trustSender: (sender: string) => Promise<void>;
  dismissAlert: (recordId: string) => Promise<void>;
  reportAlert: (recordId: string) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Manual analysis
  analyzeSMS: (body: string, sender: string) => Promise<FraudAnalysis>;
  scanAllSMS: () => Promise<SMSFraudRecord[]>;
}

const DEFAULT_STATS: DashboardStats = {
  totalScanned: 0,
  safeCount: 0,
  warningCount: 0,
  dangerCount: 0,
  blockedUrls: 0,
  lastScanTime: null,
  todayScanned: 0,
  weeklyTrend: [0, 0, 0, 0, 0, 0, 0]
};

export function useSMSMonitor(options: UseSMSMonitorOptions = {}): UseSMSMonitorReturn {
  const { autoStart = false, onSMSReceived, onFraudDetected } = options;

  // State
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [recentAlerts, setRecentAlerts] = useState<SMSFraudRecord[]>([]);
  const [blockedSenders, setBlockedSenders] = useState<string[]>([]);
  const [trustedSenders, setTrustedSenders] = useState<string[]>([]);

  // Refs for callbacks
  const onSMSReceivedRef = useRef(onSMSReceived);
  const onFraudDetectedRef = useRef(onFraudDetected);

  // Update refs when callbacks change
  useEffect(() => {
    onSMSReceivedRef.current = onSMSReceived;
    onFraudDetectedRef.current = onFraudDetected;
  }, [onSMSReceived, onFraudDetected]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        // Check mock mode
        setIsMockMode(nativeSMSModule.isMockMode());

        // Check permissions
        const perms = await nativeSMSModule.checkPermissions();
        setHasPermissions(perms.allGranted);

        // Load initial data
        await refreshStats();
        await refreshAlerts();
        await loadSenderLists();

        // Auto-start if requested and has permissions
        if (autoStart && perms.allGranted) {
          await startMonitoring();
        }
      } catch (err) {
        console.error('[useSMSMonitor] Init error:', err);
        setError('Failed to initialize SMS monitor');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Listen for SMS received
    const unsubscribeSMS = nativeSMSModule.onSMSReceived((sms) => {
      console.log('[useSMSMonitor] SMS received:', sms.sender);
    });

    // Listen for analysis complete
    const unsubscribeAnalysis = nativeSMSModule.onAnalysisComplete((sms, analysis) => {
      console.log('[useSMSMonitor] Analysis complete:', analysis.riskLevel);

      // Call user callback
      if (onSMSReceivedRef.current) {
        onSMSReceivedRef.current(sms, analysis);
      }

      // Refresh data
      refreshStats();
      refreshAlerts();
    });

    // Listen for fraud detection
    realTimeSMSMonitor.setOnFraudDetected((record) => {
      if (onFraudDetectedRef.current) {
        onFraudDetectedRef.current(record);
      }
    });

    // Listen for stats updates
    realTimeSMSMonitor.setOnStatsUpdated((newStats) => {
      setStats(newStats);
    });

    return () => {
      unsubscribeSMS();
      unsubscribeAnalysis();
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Refresh data when app becomes active
        refreshStats();
        refreshAlerts();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Actions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await nativeSMSModule.requestPermissions();
      setHasPermissions(granted);
      return granted;
    } catch (err) {
      console.error('[useSMSMonitor] Permission error:', err);
      setError('Failed to request permissions');
      return false;
    }
  }, []);

  const startMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      if (!hasPermissions && !nativeSMSModule.isMockMode()) {
        const granted = await requestPermissions();
        if (!granted) {
          setError('SMS permissions required');
          return false;
        }
      }

      const success = await nativeSMSModule.startMonitoring();
      setIsMonitoring(success);
      setError(null);
      return success;
    } catch (err) {
      console.error('[useSMSMonitor] Start error:', err);
      setError('Failed to start monitoring');
      return false;
    }
  }, [hasPermissions, requestPermissions]);

  const stopMonitoring = useCallback(async () => {
    try {
      await nativeSMSModule.stopMonitoring();
      setIsMonitoring(false);
    } catch (err) {
      console.error('[useSMSMonitor] Stop error:', err);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const newStats = await realTimeSMSMonitor.getStats();
      setStats(newStats);
    } catch (err) {
      console.error('[useSMSMonitor] Refresh stats error:', err);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const records = await realTimeSMSMonitor.getRecords(20);
      setRecentAlerts(records);
    } catch (err) {
      console.error('[useSMSMonitor] Refresh alerts error:', err);
    }
  }, []);

  const loadSenderLists = useCallback(async () => {
    setBlockedSenders(realTimeSMSMonitor.getBlockedSenders());
    setTrustedSenders(realTimeSMSMonitor.getTrustedSenders());
  }, []);

  const blockSender = useCallback(async (sender: string) => {
    await realTimeSMSMonitor.blockSender(sender);
    await loadSenderLists();
  }, [loadSenderLists]);

  const unblockSender = useCallback(async (sender: string) => {
    await realTimeSMSMonitor.unblockSender(sender);
    await loadSenderLists();
  }, [loadSenderLists]);

  const trustSender = useCallback(async (sender: string) => {
    await realTimeSMSMonitor.trustSender(sender);
    await loadSenderLists();
  }, [loadSenderLists]);

  const dismissAlert = useCallback(async (recordId: string) => {
    await realTimeSMSMonitor.updateRecordAction(recordId, 'dismissed');
    await refreshAlerts();
  }, [refreshAlerts]);

  const reportAlert = useCallback(async (recordId: string) => {
    await realTimeSMSMonitor.updateRecordAction(recordId, 'reported');
    await refreshAlerts();
  }, [refreshAlerts]);

  const clearAllData = useCallback(async () => {
    await realTimeSMSMonitor.clearAllData();
    setStats(DEFAULT_STATS);
    setRecentAlerts([]);
    setBlockedSenders([]);
    setTrustedSenders([]);
  }, []);

  const analyzeSMS = useCallback(async (body: string, sender: string): Promise<FraudAnalysis> => {
    const sms: IncomingSMS = {
      id: String(Date.now()),
      sender,
      body,
      timestamp: Date.now()
    };
    return realTimeSMSMonitor.analyzeSMS(sms);
  }, []);

  const scanAllSMS = useCallback(async (): Promise<SMSFraudRecord[]> => {
    try {
      const messages = await nativeSMSModule.getRecentSMS(50);
      const records: SMSFraudRecord[] = [];

      for (const msg of messages) {
        const record = await realTimeSMSMonitor.processIncomingSMS(msg);
        records.push(record);
      }

      await refreshStats();
      await refreshAlerts();

      return records;
    } catch (err) {
      console.error('[useSMSMonitor] Scan all error:', err);
      return [];
    }
  }, [refreshStats, refreshAlerts]);

  return {
    // State
    isMonitoring,
    isMockMode,
    hasPermissions,
    isLoading,
    error,

    // Data
    stats,
    recentAlerts,
    blockedSenders,
    trustedSenders,

    // Actions
    startMonitoring,
    stopMonitoring,
    requestPermissions,
    refreshStats,
    refreshAlerts,
    blockSender,
    unblockSender,
    trustSender,
    dismissAlert,
    reportAlert,
    clearAllData,

    // Manual analysis
    analyzeSMS,
    scanAllSMS
  };
}

export default useSMSMonitor;
