/**
 * SecureScreen Component
 * Wraps screens with security features:
 * - Prevents screenshots and screen recording
 * - Shows blur overlay when app goes to background (optional)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as ScreenCapture from 'expo-screen-capture';
import { useFocusEffect } from '@react-navigation/native';

interface SecureScreenProps {
  children: React.ReactNode;
  preventScreenCapture?: boolean;
  showBlurOnBackground?: boolean;
  onScreenshotAttempt?: () => void;
  warnOnScreenshot?: boolean;
}

export function SecureScreen({
  children,
  preventScreenCapture = false,
  showBlurOnBackground = true,
  onScreenshotAttempt,
  warnOnScreenshot = false,
}: SecureScreenProps) {
  const [isBackground, setIsBackground] = useState(false);

  // Handle screen capture prevention
  useFocusEffect(
    useCallback(() => {
      if (preventScreenCapture) {
        ScreenCapture.preventScreenCaptureAsync()
          .then(() => console.log('[SecureScreen] Screen capture blocked'))
          .catch((err) => console.warn('[SecureScreen] Failed to block capture:', err));
      }

      return () => {
        if (preventScreenCapture) {
          ScreenCapture.allowScreenCaptureAsync()
            .then(() => console.log('[SecureScreen] Screen capture allowed'))
            .catch((err) => console.warn('[SecureScreen] Failed to allow capture:', err));
        }
      };
    }, [preventScreenCapture])
  );

  // Listen for screenshot attempts
  useEffect(() => {
    if (!warnOnScreenshot && !onScreenshotAttempt) return;

    const subscription = ScreenCapture.addScreenshotListener(() => {
      console.log('[SecureScreen] Screenshot attempted!');

      if (onScreenshotAttempt) {
        onScreenshotAttempt();
      }

      if (warnOnScreenshot) {
        Alert.alert(
          'Security Notice',
          'Screenshots are not allowed on this screen for your security.',
          [{ text: 'OK' }]
        );
      }
    });

    return () => subscription.remove();
  }, [warnOnScreenshot, onScreenshotAttempt]);

  // Handle app state changes for blur overlay
  useEffect(() => {
    if (!showBlurOnBackground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setIsBackground(nextAppState !== 'active');
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [showBlurOnBackground]);

  return (
    <View style={styles.container}>
      {children}

      {/* Blur overlay when app is in background */}
      {showBlurOnBackground && isBackground && (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={100}
          tint="dark"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SecureScreen;
