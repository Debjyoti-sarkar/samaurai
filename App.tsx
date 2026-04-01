import React, { useEffect, useRef, useCallback, useState } from "react";
import { StyleSheet, View, ActivityIndicator, AppState, Alert } from "react-native";
import { NavigationContainer, NavigationState } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as ScreenCapture from "expo-screen-capture";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NexaSafeProvider, useNexaSafe } from "@/contexts/NexaSafeContext";
import { SecurityIntelligenceProvider } from "@/contexts/SecurityIntelligenceContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/hooks/useTheme";
import { KAVACHColors } from "@/constants/theme";
import simService from "@/services/SIMService";
import { wipeAllAppData, isSIMRegistered } from "@/utils/secureManager";
import { useSIMMonitor } from "@/hooks/useSIMMonitor";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Initialize i18n for multi-language support
import "@/services/i18n";

// Helper to get current route name from navigation state
function getActiveRouteName(state: NavigationState | undefined): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state as NavigationState);
  }
  return route.name;
}

// ----------------------------------------------------
// Internal Component - Your main app content
// ----------------------------------------------------
function AppContent() {
  const {
    isLoading,
    requireReauth,
    logout,
    hasCompletedOnboarding,
    isExternalAuthFlowActive,
    shouldSkipNextForegroundReauth,
    foregroundReauthSuppressedUntil,
    consumeForegroundReauthSkip,
  } = useAuth();
  const { theme, isDark } = useTheme();
  const {
    startSession,
    endSession,
    setScreenRecordingDetected,
    setLogoutCallback,
    isSessionActive,
    trackScreenVisit,
  } = useNexaSafe();

  // Track previous route for NexaSafe screen tracking
  const routeNameRef = useRef<string | undefined>(undefined);

  // SIM SECURITY: Stable callbacks for SIM monitor
  const handleSIMChangeCallback = useCallback(() => {
    console.log("SIM Change callback triggered - forcing logout");
    logout();
  }, [logout]);

  const handleDataWipedCallback = useCallback(() => {
    console.log("Data wiped callback triggered - app reset to initial state");
    // Force app to restart from language selection
    // The wipeAllAppData already clears all storage, so on next load
    // the app will show language selection screen
  }, []);

  // SIM SECURITY: Monitor SIM changes and wipe data if SIM swapped
  const { simValid, isChecking: isCheckingSIM } = useSIMMonitor({
    enabled: hasCompletedOnboarding, // Only monitor after onboarding complete
    onSIMChange: handleSIMChangeCallback,
    onDataWiped: handleDataWipedCallback,
  });

  // Handle navigation state changes for NexaSafe tracking
  const handleNavigationStateChange = useCallback((state: NavigationState | undefined) => {
    const currentRouteName = getActiveRouteName(state);
    const previousRouteName = routeNameRef.current;

    if (currentRouteName && currentRouteName !== previousRouteName && isSessionActive) {
      trackScreenVisit(currentRouteName);
      console.log(`NexaSafe tracking screen: ${currentRouteName}`);
    }

    routeNameRef.current = currentRouteName;
  }, [isSessionActive, trackScreenVisit]);

  // SECURITY: Block screen recording and screenshots globally
  useEffect(() => {
    const enableScreenSecurity = async () => {
      try {
        // await ScreenCapture.preventScreenCaptureAsync();
        console.log("Screen capture prevention enabled (commented out for dev)");
      } catch (error) {
        console.warn("Failed to enable screen capture prevention:", error);
        // If prevention fails, mark as potential screen recording
        // setScreenRecordingDetected(true);
      }
    };

    enableScreenSecurity();

    // Keep it enabled throughout the app lifecycle
    return () => {
      // Don't disable on unmount - keep protection active
    };
  }, [setScreenRecordingDetected]);

  // NexaSafe: Set logout callback
  useEffect(() => {
    setLogoutCallback(() => {
      console.log("NexaSafe triggered logout due to suspicious activity");
      logout();
    });
  }, [setLogoutCallback, logout]);

  // NexaSafe: Start session when user is authenticated
  useEffect(() => {
    if (hasCompletedOnboarding && !isLoading && !isSessionActive) {
      startSession();
      console.log("NexaSafe session started for authenticated user");
    }
  }, [hasCompletedOnboarding, isLoading, isSessionActive, startSession]);

  // CRUCIAL: Ask for PIN every time the app comes to foreground,
  // except while returning from trusted external flows like image cropper.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const isForegroundReauthSuppressed =
          isExternalAuthFlowActive ||
          shouldSkipNextForegroundReauth ||
          Date.now() < foregroundReauthSuppressedUntil;

        if (isForegroundReauthSuppressed) {
          if (shouldSkipNextForegroundReauth) {
            consumeForegroundReauthSkip();
          }
          console.log("Skipping reauth after trusted external flow");
          return;
        }

        console.log("App returned to foreground, reauth required");
        requireReauth();

        // Re-enable screen capture prevention when app becomes active
        // ScreenCapture.preventScreenCaptureAsync().catch(console.warn);
      }
    });

    return () => sub.remove();
  }, [
    consumeForegroundReauthSkip,
    foregroundReauthSuppressedUntil,
    isExternalAuthFlowActive,
    requireReauth,
    shouldSkipNextForegroundReauth,
  ]);

  if (isLoading || isCheckingSIM) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={KAVACHColors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer onStateChange={handleNavigationStateChange}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

// ----------------------------------------------------
// Main App Component
// ----------------------------------------------------
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AuthProvider>
                  <NexaSafeProvider>
                    <SecurityIntelligenceProvider>
                      <AppContent />
                    </SecurityIntelligenceProvider>
                  </NexaSafeProvider>
                </AuthProvider>
              </LanguageProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ----------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
