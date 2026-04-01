/**
 * Security Context Provider
 * Provides unified security monitoring throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import { useSecurityMonitor, SecurityState, SecurityDashboardData } from '../hooks/useSecurityMonitor';
import { SMSAnalysisResult, SMSFraudAlert as SMSFraudAlertType } from '../services/smsMonitor';
import { TransactionAnalysisResult, ReauthCheckResult } from '../services/behaviorAnalysis';
import SMSFraudAlertComponent from '../components/SMSFraudAlert';
import ReauthModal from '../components/ReauthModal';

// Context types
interface SecurityContextType {
  // State
  securityState: SecurityState;
  isInitialized: boolean;

  // Transaction Security
  analyzeTransaction: (amount: number, recipientUpiId: string, recipientName?: string) => Promise<TransactionAnalysisResult | null>;
  checkReauthRequired: (amount: number, recipientUpiId?: string) => Promise<ReauthCheckResult | null>;
  trackEvent: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
  trackAuthEvent: (method: 'pin' | 'biometric', success: boolean) => Promise<void>;

  // SMS Security
  analyzeSms: (message: string, sender?: string) => Promise<SMSAnalysisResult | null>;
  reportSmsSpam: (message: string, sender?: string) => Promise<boolean>;
  requestSmsPermission: () => Promise<boolean>;
  getSmsAlerts: (limit?: number) => Promise<SMSFraudAlertType[] | null>;

  // Dashboard
  getSecurityDashboard: () => Promise<SecurityDashboardData>;
  refreshSecurityStatus: () => Promise<void>;

  // Re-auth handling
  showReauthModal: (alertId: string, riskScore: number, onSuccess: () => void, onCancel: () => void) => void;
  hideReauthModal: () => void;
}

// Create context
const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

// Provider props
interface SecurityProviderProps {
  children: ReactNode;
  userId: string;
  enableBehaviorTracking?: boolean;
  enableSmsMonitoring?: boolean;
  autoRequestSmsPermission?: boolean;
}

// Re-auth modal state
interface ReauthModalState {
  visible: boolean;
  alertId: string;
  riskScore: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SecurityProvider({
  children,
  userId,
  enableBehaviorTracking = true,
  enableSmsMonitoring = true,
  autoRequestSmsPermission = false,
}: SecurityProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [reauthModal, setReauthModal] = useState<ReauthModalState>({
    visible: false,
    alertId: '',
    riskScore: 0,
    onSuccess: () => {},
    onCancel: () => {},
  });

  // Fraud detected handler
  const handleFraudDetected = useCallback((type: 'behavior' | 'sms', data: any) => {
    console.log(`[SecurityProvider] ${type} fraud detected:`, data);

    if (type === 'behavior' && data.recommendation?.action === 'block') {
      Alert.alert(
        'Transaction Blocked',
        'This transaction has been blocked due to suspicious activity. Please contact support if you believe this is an error.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Re-auth required handler
  const handleReauthRequired = useCallback((alertId: string, riskScore: number) => {
    console.log(`[SecurityProvider] Re-auth required: ${alertId}, risk: ${riskScore}`);
  }, []);

  // Initialize security monitor
  const security = useSecurityMonitor({
    userId,
    enableBehaviorTracking,
    enableSmsMonitoring,
    autoRequestSmsPermission,
    onFraudDetected: handleFraudDetected,
    onReauthRequired: handleReauthRequired,
  });

  // Mark as initialized
  useEffect(() => {
    if (userId && security.state.behaviorInitialized) {
      setIsInitialized(true);
    }
  }, [userId, security.state.behaviorInitialized]);

  // Show re-auth modal
  const showReauthModal = useCallback((
    alertId: string,
    riskScore: number,
    onSuccess: () => void,
    onCancel: () => void
  ) => {
    setReauthModal({
      visible: true,
      alertId,
      riskScore,
      onSuccess,
      onCancel,
    });
  }, []);

  // Hide re-auth modal
  const hideReauthModal = useCallback(() => {
    setReauthModal(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle re-auth success
  const handleReauthSuccess = useCallback(async (method: 'pin' | 'biometric') => {
    await security.resolveBehaviorAlert(reauthModal.alertId, method, true);
    await security.trackAuthEvent(method, true);
    hideReauthModal();
    reauthModal.onSuccess();
  }, [reauthModal, security, hideReauthModal]);

  // Handle re-auth failure
  const handleReauthFailure = useCallback(async (method: 'pin' | 'biometric') => {
    await security.trackAuthEvent(method, false);
  }, [security]);

  // Handle re-auth cancel
  const handleReauthCancel = useCallback(() => {
    hideReauthModal();
    reauthModal.onCancel();
  }, [reauthModal, hideReauthModal]);

  // Handle SMS alert dismiss
  const handleSmsAlertDismiss = useCallback(() => {
    security.dismissSmsAlert();
  }, [security]);

  // Handle SMS report
  const handleSmsReport = useCallback(async () => {
    const { message } = security.state.currentSmsAlert;
    if (message) {
      await security.reportSmsSpam(message.body, message.address);
    }
  }, [security]);

  // Context value
  const contextValue: SecurityContextType = {
    securityState: security.state,
    isInitialized,
    analyzeTransaction: security.analyzeTransaction,
    checkReauthRequired: security.checkReauthRequired,
    trackEvent: security.trackEvent,
    trackAuthEvent: security.trackAuthEvent,
    analyzeSms: security.analyzeSms,
    reportSmsSpam: security.reportSmsSpam,
    requestSmsPermission: security.requestSmsPermission,
    getSmsAlerts: security.getSmsAlerts,
    getSecurityDashboard: security.getSecurityDashboard,
    refreshSecurityStatus: security.refreshSecurityStatus,
    showReauthModal,
    hideReauthModal,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}

      {/* SMS Fraud Alert Modal */}
      {security.state.currentSmsAlert.visible && security.state.currentSmsAlert.analysis && (
        <SMSFraudAlertComponent
          visible={security.state.currentSmsAlert.visible}
          onClose={handleSmsAlertDismiss}
          smsContent={security.state.currentSmsAlert.message?.body || ''}
          sender={security.state.currentSmsAlert.message?.address || 'Unknown'}
          analysis={security.state.currentSmsAlert.analysis.analysis}
          alertId={security.state.currentSmsAlert.analysis.alertId}
          onReport={handleSmsReport}
        />
      )}

      {/* Re-authentication Modal */}
      <ReauthModal
        visible={reauthModal.visible}
        riskScore={reauthModal.riskScore}
        onSuccess={handleReauthSuccess}
        onFailure={handleReauthFailure}
        onCancel={handleReauthCancel}
        allowBiometric={true}
        maxAttempts={3}
      />
    </SecurityContext.Provider>
  );
}

// Custom hook to use security context
export function useSecurity(): SecurityContextType {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

export default SecurityProvider;
