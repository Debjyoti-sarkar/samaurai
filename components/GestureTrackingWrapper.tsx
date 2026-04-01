/**
 * GestureTrackingWrapper Component
 * Wraps children with gesture/touch tracking capabilities for BBA
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
  PanResponder,
  ViewStyle,
  StyleProp
} from 'react-native';
import { useBiometricAnalysis, ComprehensiveAnalysisResult } from '../hooks/useBiometricAnalysis';

interface GestureTrackingWrapperProps {
  children: React.ReactNode;
  screenContext: string;
  userId?: string;
  enabled?: boolean;
  collectBaseline?: boolean;
  style?: StyleProp<ViewStyle>;
  onRiskDetected?: (result: ComprehensiveAnalysisResult) => void;
  onSessionStart?: () => void;
  onSessionEnd?: (result: ComprehensiveAnalysisResult) => void;
  riskThreshold?: number;
}

export function GestureTrackingWrapper({
  children,
  screenContext,
  userId = 'anonymous',
  enabled = true,
  collectBaseline = false,
  style,
  onRiskDetected,
  onSessionStart,
  onSessionEnd,
  riskThreshold = 60
}: GestureTrackingWrapperProps) {
  const biometricAnalysis = useBiometricAnalysis({
    userId,
    screenContext,
    autoStart: false,
    collectBaseline,
    onRiskDetected,
    riskThreshold
  });

  const isTracking = useRef(false);

  // Start tracking when component mounts
  useEffect(() => {
    if (enabled && !isTracking.current) {
      biometricAnalysis.startSession(screenContext);
      isTracking.current = true;
      onSessionStart?.();
    }

    return () => {
      if (isTracking.current) {
        const result = biometricAnalysis.endSession();
        isTracking.current = false;
        onSessionEnd?.(result);
      }
    };
  }, [enabled, screenContext]);

  // Create pan responder for gesture tracking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => enabled,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: (evt) => {
        if (!enabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pressure = (evt.nativeEvent as any).force;
        biometricAnalysis.trackTouch(locationX, locationY, pressure);
      },

      onPanResponderMove: (evt) => {
        if (!enabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pressure = (evt.nativeEvent as any).force;
        biometricAnalysis.trackTouch(locationX, locationY, pressure);
      },

      onPanResponderRelease: () => {
        // Touch ended
      },
    })
  ).current;

  // Handle touch events
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!enabled) return;
    const { locationX, locationY } = event.nativeEvent;
    const pressure = (event.nativeEvent as any).force;
    biometricAnalysis.trackTouch(locationX, locationY, pressure);
  }, [enabled, biometricAnalysis]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!enabled) return;
    const { locationX, locationY } = event.nativeEvent;
    const pressure = (event.nativeEvent as any).force;
    biometricAnalysis.trackTouch(locationX, locationY, pressure);
  }, [enabled, biometricAnalysis]);

  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      style={[styles.container, style]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

// Higher-order component version
export function withGestureTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenContext: string,
  options?: Partial<GestureTrackingWrapperProps>
) {
  return function WithGestureTracking(props: P) {
    return (
      <GestureTrackingWrapper screenContext={screenContext} {...options}>
        <WrappedComponent {...props} />
      </GestureTrackingWrapper>
    );
  };
}

// Context for child components to access biometric analysis
import { createContext, useContext } from 'react';

interface BiometricTrackingContextType {
  trackKeyPress: (key: string, position?: { x: number; y: number }) => void;
  trackKeyRelease: (key: string) => void;
  trackAction: (action: string) => void;
  startInputTracking: (fieldId: string, inputType: 'text' | 'number' | 'pin' | 'otp' | 'amount') => void;
  recordInputChange: (fieldId: string, value: string, isDelete?: boolean) => void;
  endInputTracking: (fieldId: string) => void;
  getQuickRiskScore: () => number;
  performAnalysis: () => ComprehensiveAnalysisResult;
  currentRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  hasProfile: boolean;
}

const BiometricTrackingContext = createContext<BiometricTrackingContextType | null>(null);

export function useBiometricTracking() {
  const context = useContext(BiometricTrackingContext);
  if (!context) {
    console.warn('[GestureTrackingWrapper] useBiometricTracking must be used within a GestureTrackingProvider');
    return null;
  }
  return context;
}

// Provider component with context
export function GestureTrackingProvider({
  children,
  screenContext,
  userId = 'anonymous',
  enabled = true,
  collectBaseline = false,
  style,
  onRiskDetected,
  onSessionStart,
  onSessionEnd,
  riskThreshold = 60
}: GestureTrackingWrapperProps) {
  const biometricAnalysis = useBiometricAnalysis({
    userId,
    screenContext,
    autoStart: false,
    collectBaseline,
    onRiskDetected,
    riskThreshold
  });

  const isTracking = useRef(false);

  useEffect(() => {
    if (enabled && !isTracking.current) {
      biometricAnalysis.startSession(screenContext);
      isTracking.current = true;
      onSessionStart?.();
    }

    return () => {
      if (isTracking.current) {
        const result = biometricAnalysis.endSession();
        isTracking.current = false;
        onSessionEnd?.(result);
      }
    };
  }, [enabled, screenContext]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => enabled,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (evt) => {
        if (!enabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pressure = (evt.nativeEvent as any).force;
        biometricAnalysis.trackTouch(locationX, locationY, pressure);
      },
      onPanResponderMove: (evt) => {
        if (!enabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pressure = (evt.nativeEvent as any).force;
        biometricAnalysis.trackTouch(locationX, locationY, pressure);
      },
    })
  ).current;

  const contextValue: BiometricTrackingContextType = {
    trackKeyPress: biometricAnalysis.trackKeyPress,
    trackKeyRelease: biometricAnalysis.trackKeyRelease,
    trackAction: biometricAnalysis.trackAction,
    startInputTracking: biometricAnalysis.startInputTracking,
    recordInputChange: biometricAnalysis.recordInputChange,
    endInputTracking: biometricAnalysis.endInputTracking,
    getQuickRiskScore: biometricAnalysis.getQuickRiskScore,
    performAnalysis: biometricAnalysis.performAnalysis,
    currentRiskLevel: biometricAnalysis.currentRiskLevel,
    hasProfile: biometricAnalysis.hasProfile
  };

  if (!enabled) {
    return (
      <BiometricTrackingContext.Provider value={contextValue}>
        <View style={style}>{children}</View>
      </BiometricTrackingContext.Provider>
    );
  }

  return (
    <BiometricTrackingContext.Provider value={contextValue}>
      <View
        style={[styles.container, style]}
        {...panResponder.panHandlers}
      >
        {children}
      </View>
    </BiometricTrackingContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

export default GestureTrackingWrapper;
