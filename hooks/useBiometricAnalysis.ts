/**
 * useBiometricAnalysis Hook
 * Combines cursor tracking, BBA, and cognitive analysis for comprehensive behavioral biometrics
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cursorAnalysis, CursorSession } from '../services/cursorAnalysis';
import { bbaService, BBAComparisonResult, BiometricProfile } from '../services/behavioralBiometricAnalysis';
import { cognitiveAnalysis, CognitiveAnalysisResult, CognitiveLoadIndicators } from '../services/cognitivePatternAnalysis';

// Combined analysis result
export interface ComprehensiveAnalysisResult {
  // Overall scores
  overallRiskScore: number;
  overallConfidence: number;
  isUserVerified: boolean;

  // Individual analysis results
  cursorRiskScore: number;
  bbaResult: BBAComparisonResult | null;
  cognitiveResult: CognitiveAnalysisResult | null;

  // Combined anomalies
  allAnomalies: {
    source: 'cursor' | 'bba' | 'cognitive';
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number;
  }[];

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  recommendation: string;

  // Action required
  requiresReauth: boolean;
  blockTransaction: boolean;
}

interface UseBiometricAnalysisOptions {
  userId?: string;
  screenContext?: string;
  autoStart?: boolean;
  collectBaseline?: boolean;
  onRiskDetected?: (result: ComprehensiveAnalysisResult) => void;
  onBaselineComplete?: () => void;
  riskThreshold?: number; // Default 60
}

interface UseBiometricAnalysisReturn {
  // Session management
  startSession: (screenContext?: string) => void;
  endSession: () => ComprehensiveAnalysisResult;
  isSessionActive: boolean;

  // Real-time tracking
  trackTouch: (x: number, y: number, pressure?: number) => void;
  trackKeyPress: (key: string, position?: { x: number; y: number }) => void;
  trackKeyRelease: (key: string) => void;
  trackScreenNavigation: (screenName: string) => void;
  trackAction: (action: string) => void;

  // Input field tracking
  startInputTracking: (fieldId: string, inputType: 'text' | 'number' | 'pin' | 'otp' | 'amount') => void;
  recordInputChange: (fieldId: string, value: string, isDelete?: boolean) => void;
  endInputTracking: (fieldId: string) => void;

  // Analysis
  performAnalysis: () => ComprehensiveAnalysisResult;
  getQuickRiskScore: () => number;
  getCognitiveLoad: () => CognitiveLoadIndicators;

  // Profile management
  hasProfile: boolean;
  profileConfidence: number;
  startBaselineCollection: () => void;
  addSampleToProfile: () => void;

  // State
  currentRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastAnalysisResult: ComprehensiveAnalysisResult | null;
}

// Risk level thresholds
const RISK_THRESHOLDS = {
  low: 30,
  medium: 50,
  high: 70,
  critical: 85
};

export function useBiometricAnalysis(options: UseBiometricAnalysisOptions = {}): UseBiometricAnalysisReturn {
  const {
    userId = 'anonymous',
    screenContext = 'default',
    autoStart = false,
    collectBaseline = false,
    onRiskDetected,
    onBaselineComplete,
    riskThreshold = 60
  } = options;

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileConfidence, setProfileConfidence] = useState(0);
  const [currentRiskLevel, setCurrentRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [lastAnalysisResult, setLastAnalysisResult] = useState<ComprehensiveAnalysisResult | null>(null);

  const cursorSessionRef = useRef<string | null>(null);
  const baselineSamplesRef = useRef(0);

  // Check profile on mount
  useEffect(() => {
    const profile = bbaService.getProfile();
    if (profile) {
      setHasProfile(true);
      setProfileConfidence(profile.confidenceScore);
    }
  }, []);

  // Start tracking session
  const startSession = useCallback((context?: string) => {
    const ctx = context || screenContext;

    // Start cursor tracking
    cursorSessionRef.current = cursorAnalysis.startSession(ctx);

    // Start cognitive tracking
    cognitiveAnalysis.startSession(userId);
    cognitiveAnalysis.recordScreenNavigation(ctx);

    setIsSessionActive(true);
    console.log(`[BiometricAnalysis] Session started: ${ctx}`);
  }, [userId, screenContext]);

  // End session and get final analysis
  const endSession = useCallback((): ComprehensiveAnalysisResult => {
    const result = performAnalysis();

    // End cursor session
    cursorAnalysis.endSession();
    cursorSessionRef.current = null;

    // Clear BBA events
    bbaService.clearCurrentEvents();

    setIsSessionActive(false);
    console.log('[BiometricAnalysis] Session ended');

    return result;
  }, []);

  // Track touch event
  const trackTouch = useCallback((x: number, y: number, pressure?: number) => {
    if (!isSessionActive) return;
    cursorAnalysis.recordTouch(x, y, pressure);
  }, [isSessionActive]);

  // Track key press
  const trackKeyPress = useCallback((key: string, position?: { x: number; y: number }) => {
    if (!isSessionActive) return;
    bbaService.recordKeyPress(key, position);
  }, [isSessionActive]);

  // Track key release
  const trackKeyRelease = useCallback((key: string) => {
    if (!isSessionActive) return;
    bbaService.recordKeyRelease(key);
  }, [isSessionActive]);

  // Track screen navigation
  const trackScreenNavigation = useCallback((screenName: string) => {
    if (!isSessionActive) return;
    cognitiveAnalysis.recordScreenNavigation(screenName);
  }, [isSessionActive]);

  // Track user action
  const trackAction = useCallback((action: string) => {
    if (!isSessionActive) return;
    const session = cursorAnalysis.getCurrentSession();
    cognitiveAnalysis.recordAction(action, session?.screenContext || 'unknown');
  }, [isSessionActive]);

  // Start input tracking
  const startInputTracking = useCallback((fieldId: string, inputType: 'text' | 'number' | 'pin' | 'otp' | 'amount') => {
    if (!isSessionActive) return;
    cognitiveAnalysis.startInputTracking(fieldId, inputType);
  }, [isSessionActive]);

  // Record input change
  const recordInputChange = useCallback((fieldId: string, value: string, isDelete: boolean = false) => {
    if (!isSessionActive) return;
    cognitiveAnalysis.recordInputChange(fieldId, value, isDelete);

    // Also track keystrokes for BBA
    if (value.length > 0) {
      const lastChar = value[value.length - 1];
      bbaService.recordKeyPress(lastChar);
      setTimeout(() => bbaService.recordKeyRelease(lastChar), 100);
    }
  }, [isSessionActive]);

  // End input tracking
  const endInputTracking = useCallback((fieldId: string) => {
    if (!isSessionActive) return;
    cognitiveAnalysis.endInputTracking(fieldId);
  }, [isSessionActive]);

  // Perform comprehensive analysis
  const performAnalysis = useCallback((): ComprehensiveAnalysisResult => {
    const cursorSession = cursorAnalysis.getCurrentSession();

    // Get cursor risk score
    const cursorRiskScore = cursorAnalysis.getAnomalyRiskScore();
    const cursorAnomalies = cursorAnalysis.getAnomalies();

    // Get BBA comparison result
    let bbaResult: BBAComparisonResult | null = null;
    if (cursorSession && hasProfile) {
      bbaResult = bbaService.compareWithProfile(cursorSession);
    }

    // Get cognitive analysis result
    const cognitiveResult = cognitiveAnalysis.performAnalysis();

    // Combine all anomalies
    const allAnomalies: ComprehensiveAnalysisResult['allAnomalies'] = [];

    // Add cursor anomalies
    cursorAnomalies.forEach(a => {
      allAnomalies.push({
        source: 'cursor',
        type: a.type,
        severity: a.severity,
        description: a.description,
        confidence: a.confidence
      });
    });

    // Add BBA anomalies
    if (bbaResult) {
      bbaResult.anomalies.forEach(a => {
        allAnomalies.push({
          source: 'bba',
          type: 'deviation',
          severity: bbaResult!.riskLevel === 'critical' ? 'critical' : bbaResult!.riskLevel,
          description: a,
          confidence: 0.8
        });
      });
    }

    // Add cognitive anomalies
    cognitiveResult.anomalies.forEach(a => {
      allAnomalies.push({
        source: 'cognitive',
        type: a.type,
        severity: a.severity,
        description: a.description,
        confidence: a.confidence
      });
    });

    // Calculate overall risk score (weighted average)
    const bbaRiskScore = bbaResult ? (100 - bbaResult.overallScore) : 0;
    const cognitiveRiskScore = cognitiveResult.riskScore;

    // Weights: Cursor 25%, BBA 40%, Cognitive 35%
    const overallRiskScore = hasProfile
      ? (cursorRiskScore * 0.25) + (bbaRiskScore * 0.40) + (cognitiveRiskScore * 0.35)
      : (cursorRiskScore * 0.35) + (cognitiveRiskScore * 0.65);

    // Calculate confidence
    const overallConfidence = hasProfile
      ? Math.min(profileConfidence, 100) * 0.6 + 40
      : 50;

    // Determine risk level
    let riskLevel: ComprehensiveAnalysisResult['riskLevel'];
    if (overallRiskScore >= RISK_THRESHOLDS.critical) riskLevel = 'critical';
    else if (overallRiskScore >= RISK_THRESHOLDS.high) riskLevel = 'high';
    else if (overallRiskScore >= RISK_THRESHOLDS.medium) riskLevel = 'medium';
    else riskLevel = 'low';

    // Collect risk factors
    const riskFactors: string[] = [];
    if (cursorRiskScore > 30) riskFactors.push('Unusual cursor/touch patterns');
    if (bbaRiskScore > 30) riskFactors.push('Behavioral biometric mismatch');
    if (cognitiveRiskScore > 30) riskFactors.push('Cognitive pattern anomalies');
    if (cognitiveResult.cognitiveLoad.stressIndicator > 70) riskFactors.push('High stress indicators');
    if (cognitiveResult.behaviorFlags.length > 0) {
      cognitiveResult.behaviorFlags.forEach(f => riskFactors.push(f.description));
    }

    // Determine if user is verified
    const isUserVerified = overallRiskScore < riskThreshold && riskLevel !== 'critical';

    // Determine actions required
    const requiresReauth = riskLevel === 'high' || riskLevel === 'critical';
    const blockTransaction = riskLevel === 'critical' ||
      allAnomalies.some(a => a.type === 'coercion' || a.type === 'automation');

    // Generate recommendation
    let recommendation: string;
    if (blockTransaction) {
      recommendation = 'BLOCK: Critical security risk detected. Transaction should be blocked and user identity verified.';
    } else if (requiresReauth) {
      recommendation = 'REAUTH: Significant behavioral anomalies detected. Require re-authentication before proceeding.';
    } else if (riskLevel === 'medium') {
      recommendation = 'CAUTION: Minor anomalies detected. Consider additional verification for high-value transactions.';
    } else {
      recommendation = 'PROCEED: Behavioral patterns are within normal range. Transaction can proceed.';
    }

    const result: ComprehensiveAnalysisResult = {
      overallRiskScore,
      overallConfidence,
      isUserVerified,
      cursorRiskScore,
      bbaResult,
      cognitiveResult,
      allAnomalies,
      riskLevel,
      riskFactors,
      recommendation,
      requiresReauth,
      blockTransaction
    };

    setCurrentRiskLevel(riskLevel);
    setLastAnalysisResult(result);

    // Trigger callback if risk detected
    if (onRiskDetected && overallRiskScore >= riskThreshold) {
      onRiskDetected(result);
    }

    console.log('[BiometricAnalysis] Analysis complete:', JSON.stringify({
      overallRiskScore,
      riskLevel,
      requiresReauth,
      blockTransaction
    }));

    return result;
  }, [hasProfile, profileConfidence, riskThreshold, onRiskDetected]);

  // Get quick risk score without full analysis
  const getQuickRiskScore = useCallback((): number => {
    const cursorRisk = cursorAnalysis.getAnomalyRiskScore();
    const bbaRisk = bbaService.getQuickRiskScore();

    return hasProfile
      ? (cursorRisk * 0.4) + (bbaRisk * 0.6)
      : cursorRisk;
  }, [hasProfile]);

  // Get current cognitive load
  const getCognitiveLoad = useCallback((): CognitiveLoadIndicators => {
    return cognitiveAnalysis.analyzeCognitiveLoad();
  }, []);

  // Start baseline collection
  const startBaselineCollection = useCallback(() => {
    bbaService.startBaselineCollection(userId);
    baselineSamplesRef.current = 0;
    console.log('[BiometricAnalysis] Started baseline collection');
  }, [userId]);

  // Add sample to profile
  const addSampleToProfile = useCallback(() => {
    const cursorSession = cursorAnalysis.getCurrentSession();
    if (!cursorSession) {
      console.warn('[BiometricAnalysis] No active cursor session');
      return;
    }

    bbaService.addSampleToProfile(cursorSession);
    cognitiveAnalysis.updateProfile();

    baselineSamplesRef.current++;

    const profile = bbaService.getProfile();
    if (profile) {
      setHasProfile(true);
      setProfileConfidence(profile.confidenceScore);

      if (profile.confidenceScore >= 80 && onBaselineComplete) {
        onBaselineComplete();
      }
    }

    console.log(`[BiometricAnalysis] Sample added. Total: ${baselineSamplesRef.current}`);
  }, [onBaselineComplete]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isSessionActive) {
      startSession();
    }

    return () => {
      if (isSessionActive) {
        endSession();
      }
    };
  }, [autoStart]);

  // Collect baseline if enabled
  useEffect(() => {
    if (collectBaseline && !hasProfile) {
      startBaselineCollection();
    }
  }, [collectBaseline, hasProfile]);

  return {
    startSession,
    endSession,
    isSessionActive,
    trackTouch,
    trackKeyPress,
    trackKeyRelease,
    trackScreenNavigation,
    trackAction,
    startInputTracking,
    recordInputChange,
    endInputTracking,
    performAnalysis,
    getQuickRiskScore,
    getCognitiveLoad,
    hasProfile,
    profileConfidence,
    startBaselineCollection,
    addSampleToProfile,
    currentRiskLevel,
    lastAnalysisResult
  };
}

export default useBiometricAnalysis;
