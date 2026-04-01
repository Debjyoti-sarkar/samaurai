/**
 * useScreenSecurity Hook
 * Prevents screen recording and screenshots on sensitive screens
 * Uses expo-screen-capture for proper implementation
 */

import { useEffect, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Hook to enable/disable screen security when a screen is focused
 * @param enabled - Whether screen security should be enabled for this screen
 */
export function useScreenSecurity(enabled: boolean = true) {
  // Enable security when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (enabled) {
        preventScreenCapture();
      }

      return () => {
        if (enabled) {
          allowScreenCapture();
        }
      };
    }, [enabled])
  );

  // Also handle app state changes
  useEffect(() => {
    if (!enabled) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && enabled) {
        preventScreenCapture();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [enabled]);
}

/**
 * Prevent screen capture (screenshots and screen recording)
 */
async function preventScreenCapture() {
  try {
    await ScreenCapture.preventScreenCaptureAsync();
    console.log('[ScreenSecurity] Screen capture prevention enabled');
  } catch (error) {
    console.warn('[ScreenSecurity] Failed to prevent screen capture:', error);
  }
}

/**
 * Allow screen capture again
 */
async function allowScreenCapture() {
  try {
    await ScreenCapture.allowScreenCaptureAsync();
    console.log('[ScreenSecurity] Screen capture prevention disabled');
  } catch (error) {
    console.warn('[ScreenSecurity] Failed to allow screen capture:', error);
  }
}

/**
 * Hook to listen for screenshot events
 */
export function useScreenshotListener(onScreenshot: () => void) {
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      console.log('[ScreenSecurity] Screenshot detected!');
      onScreenshot();
    });

    return () => subscription.remove();
  }, [onScreenshot]);
}

/**
 * Check if screen capture is being prevented
 */
export async function isScreenCapturePreventedAsync(): Promise<boolean> {
  try {
    // This is a workaround since expo-screen-capture doesn't have a direct check
    // We can track it ourselves if needed
    return false;
  } catch {
    return false;
  }
}

export default useScreenSecurity;
