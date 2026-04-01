/**
 * useCursorTracking Hook
 * Provides easy-to-use cursor/touch tracking functionality for React components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, PanResponderGestureState } from 'react-native';
import { cursorAnalysis, CursorSession, CursorMetrics, CursorAnomaly, TouchPoint } from '../services/cursorAnalysis';

interface UseCursorTrackingOptions {
  screenContext?: string;
  autoStart?: boolean;
  trackPressure?: boolean;
  onAnomalyDetected?: (anomaly: CursorAnomaly) => void;
  onSessionEnd?: (session: CursorSession) => void;
}

interface UseCursorTrackingReturn {
  // Session management
  startTracking: (screenContext?: string) => string;
  stopTracking: () => CursorSession | null;
  isTracking: boolean;
  sessionId: string | null;

  // Touch event handlers
  onTouchStart: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchEnd: (event: GestureResponderEvent) => void;

  // PanResponder for gesture tracking
  panResponder: ReturnType<typeof PanResponder.create>;

  // Data access
  getMetrics: () => CursorMetrics;
  getAnomalies: () => CursorAnomaly[];
  getRiskScore: () => number;
  getTouchHistory: () => TouchPoint[];

  // Dwell time tracking
  recordDwellTime: (elementId: string, elementType: string, duration: number) => void;

  // Reset
  reset: () => void;
}

export function useCursorTracking(options: UseCursorTrackingOptions = {}): UseCursorTrackingReturn {
  const {
    screenContext = 'default',
    autoStart = false,
    trackPressure = true,
    onAnomalyDetected,
    onSessionEnd
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const lastAnomalyCount = useRef(0);
  const dwellTimers = useRef<Map<string, { startTime: number; elementType: string }>>(new Map());

  // Start tracking session
  const startTracking = useCallback((context?: string) => {
    const id = cursorAnalysis.startSession(context || screenContext);
    setSessionId(id);
    setIsTracking(true);
    lastAnomalyCount.current = 0;
    console.log(`[useCursorTracking] Started tracking: ${id}`);
    return id;
  }, [screenContext]);

  // Stop tracking session
  const stopTracking = useCallback(() => {
    if (!isTracking) return null;

    const session = cursorAnalysis.endSession();
    setIsTracking(false);
    setSessionId(null);

    if (session && onSessionEnd) {
      onSessionEnd(session);
    }

    console.log('[useCursorTracking] Stopped tracking');
    return session;
  }, [isTracking, onSessionEnd]);

  // Handle touch start
  const onTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!isTracking) return;

    const { locationX, locationY } = event.nativeEvent;
    const pressure = trackPressure ? (event.nativeEvent as any).force : undefined;

    cursorAnalysis.recordTouchStart(locationX, locationY, pressure);
  }, [isTracking, trackPressure]);

  // Handle touch move
  const onTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!isTracking) return;

    const { locationX, locationY } = event.nativeEvent;
    const pressure = trackPressure ? (event.nativeEvent as any).force : undefined;

    cursorAnalysis.recordTouchMove(locationX, locationY, pressure);

    // Check for new anomalies
    const anomalies = cursorAnalysis.getAnomalies();
    if (anomalies.length > lastAnomalyCount.current && onAnomalyDetected) {
      const newAnomalies = anomalies.slice(lastAnomalyCount.current);
      newAnomalies.forEach(anomaly => onAnomalyDetected(anomaly));
      lastAnomalyCount.current = anomalies.length;
    }
  }, [isTracking, trackPressure, onAnomalyDetected]);

  // Handle touch end
  const onTouchEnd = useCallback((event: GestureResponderEvent) => {
    if (!isTracking) return;

    const { locationX, locationY } = event.nativeEvent;
    cursorAnalysis.recordTouchEnd(locationX, locationY);
  }, [isTracking]);

  // Create PanResponder for comprehensive gesture tracking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTracking,
      onMoveShouldSetPanResponder: () => isTracking,
      onPanResponderGrant: (evt, gestureState) => {
        if (!isTracking) return;
        const { x0, y0 } = gestureState;
        const pressure = (evt.nativeEvent as any).force;
        cursorAnalysis.recordTouchStart(x0, y0, pressure);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isTracking) return;
        const { moveX, moveY } = gestureState;
        const pressure = (evt.nativeEvent as any).force;
        cursorAnalysis.recordTouchMove(moveX, moveY, pressure);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!isTracking) return;
        const { moveX, moveY } = gestureState;
        cursorAnalysis.recordTouchEnd(moveX, moveY);
      },
      onPanResponderTerminate: (evt, gestureState) => {
        if (!isTracking) return;
        const { moveX, moveY } = gestureState;
        cursorAnalysis.recordTouchEnd(moveX, moveY);
      },
    })
  ).current;

  // Record dwell time on elements
  const recordDwellTime = useCallback((elementId: string, elementType: string, duration: number) => {
    if (!isTracking) return;
    cursorAnalysis.recordDwellTime(elementId, elementType, duration);
  }, [isTracking]);

  // Start dwell tracking for an element
  const startDwellTracking = useCallback((elementId: string, elementType: string) => {
    dwellTimers.current.set(elementId, { startTime: Date.now(), elementType });
  }, []);

  // End dwell tracking for an element
  const endDwellTracking = useCallback((elementId: string) => {
    const timer = dwellTimers.current.get(elementId);
    if (timer) {
      const duration = Date.now() - timer.startTime;
      recordDwellTime(elementId, timer.elementType, duration);
      dwellTimers.current.delete(elementId);
    }
  }, [recordDwellTime]);

  // Get current metrics
  const getMetrics = useCallback((): CursorMetrics => {
    const session = cursorAnalysis.getCurrentSession();
    return session?.metrics || {
      totalDistance: 0,
      averageVelocity: 0,
      maxVelocity: 0,
      minVelocity: 0,
      accelerationChanges: 0,
      smoothnessScore: 100,
      directnessRatio: 1,
      dwellTimes: [],
      hesitations: 0,
      overshoots: 0
    };
  }, []);

  // Get anomalies
  const getAnomalies = useCallback((): CursorAnomaly[] => {
    return cursorAnalysis.getAnomalies();
  }, []);

  // Get risk score
  const getRiskScore = useCallback((): number => {
    return cursorAnalysis.getAnomalyRiskScore();
  }, []);

  // Get touch history
  const getTouchHistory = useCallback((): TouchPoint[] => {
    return cursorAnalysis.getTouchHistory();
  }, []);

  // Reset tracking
  const reset = useCallback(() => {
    cursorAnalysis.clearAll();
    setIsTracking(false);
    setSessionId(null);
    lastAnomalyCount.current = 0;
    dwellTimers.current.clear();
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isTracking) {
      startTracking();
    }

    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [autoStart]);

  return {
    startTracking,
    stopTracking,
    isTracking,
    sessionId,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    panResponder,
    getMetrics,
    getAnomalies,
    getRiskScore,
    getTouchHistory,
    recordDwellTime,
    reset
  };
}

// Simplified hook for basic tracking
export function useSimpleCursorTracking(screenContext: string) {
  const tracking = useCursorTracking({ screenContext, autoStart: true });

  useEffect(() => {
    return () => {
      tracking.stopTracking();
    };
  }, []);

  return {
    onTouchStart: tracking.onTouchStart,
    onTouchMove: tracking.onTouchMove,
    onTouchEnd: tracking.onTouchEnd,
    getRiskScore: tracking.getRiskScore
  };
}

export default useCursorTracking;
