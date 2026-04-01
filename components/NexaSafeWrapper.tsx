/**
 * NexaSafe Gesture Wrapper Component
 * Wraps screens to automatically track user interactions
 */

import React, { useCallback, useRef, ReactNode } from 'react';
import { View, StyleSheet, GestureResponderEvent, PanResponder, Pressable } from 'react-native';
import { useNexaSafe, useNexaSafeScreen } from '@/contexts/NexaSafeContext';

interface NexaSafeWrapperProps {
  children: ReactNode;
  screenName: string;
  trackTaps?: boolean;
  trackSwipes?: boolean;
  style?: any;
}

export function NexaSafeWrapper({
  children,
  screenName,
  trackTaps = true,
  trackSwipes = true,
  style,
}: NexaSafeWrapperProps) {
  const { trackSwipe, isSessionActive } = useNexaSafe();
  const { handleTap, handleTapDuration } = useNexaSafeScreen(screenName);

  // Track tap timing
  const tapStartTime = useRef<number>(0);
  const lastTapPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track swipe
  const swipeStartPos = useRef<number>(0);
  const swipeStartTime = useRef<number>(0);

  // Determine zone from position
  const getZoneFromPosition = (x: number, y: number, width: number, height: number): string => {
    // Simple 3x3 grid zone detection
    const zoneX = x < width / 3 ? 'left' : x < (width * 2) / 3 ? 'center' : 'right';
    const zoneY = y < height / 3 ? 'top' : y < (height * 2) / 3 ? 'middle' : 'bottom';
    return `${zoneY}-${zoneX}`;
  };

  // Handle touch start
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!isSessionActive) return;

    const { pageX, pageY } = event.nativeEvent;
    tapStartTime.current = Date.now();
    lastTapPosition.current = { x: pageX, y: pageY };
    swipeStartPos.current = pageY;
    swipeStartTime.current = Date.now();
  }, [isSessionActive]);

  // Handle touch end
  const handleTouchEnd = useCallback((event: GestureResponderEvent) => {
    if (!isSessionActive) return;

    const { pageX, pageY } = event.nativeEvent;
    const duration = Date.now() - tapStartTime.current;

    // Calculate distance moved
    const distance = Math.sqrt(
      Math.pow(pageX - lastTapPosition.current.x, 2) +
      Math.pow(pageY - lastTapPosition.current.y, 2)
    );

    // If distance is small, it's a tap
    if (trackTaps && distance < 20) {
      // Get parent dimensions for zone calculation (approximate)
      const zone = getZoneFromPosition(pageX, pageY, 400, 800);
      handleTap(pageX, pageY, zone);
      handleTapDuration(duration);
    }

    // If distance is large, it's a swipe
    if (trackSwipes && distance >= 20) {
      const swipeDuration = Date.now() - swipeStartTime.current;
      trackSwipe(swipeStartPos.current, pageY, swipeDuration);
    }
  }, [isSessionActive, trackTaps, trackSwipes, handleTap, handleTapDuration, trackSwipe]);

  // PanResponder for gesture detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
    })
  ).current;

  return (
    <View
      style={[styles.container, style]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

// ============================================================
// Trust Score Badge Component
// ============================================================

interface TrustScoreBadgeProps {
  style?: any;
  showLabel?: boolean;
}

export function TrustScoreBadge({ style, showLabel = true }: TrustScoreBadgeProps) {
  const { trustScore, riskLevel } = useNexaSafe();

  const getColor = () => {
    switch (riskLevel) {
      case 'safe': return '#22c55e';
      case 'caution': return '#eab308';
      case 'warning': return '#f97316';
      case 'danger': return '#ef4444';
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getColor() }, style]}>
      {showLabel && (
        <View style={styles.badgeContent}>
          <View style={styles.trustIcon}>
            <View style={[styles.trustIconInner, { backgroundColor: '#fff' }]} />
          </View>
          <View>
            <View style={styles.trustScoreText}>
              <View style={styles.trustNumber}>
                {/* Text would be rendered here - using placeholder */}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Tracked Pressable Component
// ============================================================

interface TrackedPressableProps {
  children: ReactNode;
  screenName: string;
  zone?: string;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}

export function TrackedPressable({
  children,
  screenName,
  zone = 'active',
  onPress,
  style,
  disabled,
}: TrackedPressableProps) {
  const { trackTap, trackTapDuration, isSessionActive } = useNexaSafe();
  const pressStartTime = useRef<number>(0);

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressStartTime.current = Date.now();
  }, []);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    if (isSessionActive) {
      const { pageX, pageY } = event.nativeEvent;
      const duration = Date.now() - pressStartTime.current;

      trackTap(screenName, pageX, pageY, zone);
      trackTapDuration(screenName, duration);
    }

    if (onPress) {
      onPress();
    }
  }, [isSessionActive, screenName, zone, trackTap, trackTapDuration, onPress]);

  return (
    <Pressable
      style={style}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPress={handlePress}
    >
      {children}
    </Pressable>
  );
}

// ============================================================
// Navigation Tracker HOC
// ============================================================

export function withNexaSafeTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) {
  return function NexaSafeTrackedScreen(props: P) {
    return (
      <NexaSafeWrapper screenName={screenName}>
        <WrappedComponent {...props} />
      </NexaSafeWrapper>
    );
  };
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustIconInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trustScoreText: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  trustNumber: {
    // Text styling placeholder
  },
});

export default NexaSafeWrapper;
