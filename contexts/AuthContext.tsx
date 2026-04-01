import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import simService from "../services/SIMService";
import { wipeAllAppData } from "../utils/secureManager";

export type AuthStep =
  | "language_selection"
  | "phone_verification"
  | "bank_linking"
  | "security_setup"
  | "authenticated";

interface UserData {
  phoneNumber: string;
  bankName: string;
  bankAccountMasked: string;
  pin: string;
  biometricEnabled: boolean;
  customFaceEnabled: boolean;
  aadhaarLinked: boolean;
  name: string;
  upiId: string;
  email: string;
}

interface AuthContextType {
  authStep: AuthStep;
  userData: UserData | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;

  setAuthStep: (step: AuthStep) => void;
  setPhoneNumber: (phone: string) => Promise<void>;
  linkBank: (bankName: string, accountNumber: string) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  enableBiometric: (enabled: boolean) => Promise<void>;
  enableCustomFace: (enabled: boolean) => Promise<void>;
  linkAadhaar: () => Promise<void>;
  updateUserProfile: (name: string, upiId: string, email: string) => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  // NEW security model
  needsReauth: boolean;
  requireReauth: () => void;
  completeReauth: () => void;
  isExternalAuthFlowActive: boolean;
  shouldSkipNextForegroundReauth: boolean;
  foregroundReauthSuppressedUntil: number;
  beginExternalAuthFlow: () => void;
  endExternalAuthFlow: () => void;
  consumeForegroundReauthSkip: () => void;

  // SIM security
  registerSIM: () => Promise<{ success: boolean; error?: string }>;
  verifySIMAndWipeIfChanged: () => Promise<boolean>;
  simChangeDetected: boolean;

  // OLD dashboard features (kept for compatibility)
  voiceGuideEnabled: boolean;
  toggleVoiceGuide: () => void;
  isOnline: boolean;
  setOnlineStatus: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = "@kavach_auth";
const USER_KEY = "@kavach_user";
const ONBOARDING_KEY = "@kavach_onboarding";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authStep, setAuthStepState] = useState<AuthStep>("language_selection");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // security
  const [needsReauth, setNeedsReauth] = useState(false);
  const [simChangeDetected, setSimChangeDetected] = useState(false);
  const [isExternalAuthFlowActive, setIsExternalAuthFlowActive] = useState(false);
  const [shouldSkipNextForegroundReauth, setShouldSkipNextForegroundReauth] = useState(false);
  const [foregroundReauthSuppressedUntil, setForegroundReauthSuppressedUntil] = useState(0);

  // dashboard old features
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const savedAuth = await AsyncStorage.getItem(AUTH_KEY);
      const savedUser = await AsyncStorage.getItem(USER_KEY);
      const savedOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);

      const parsedUser = savedUser ? (JSON.parse(savedUser) as UserData) : null;
      const hasPhone = !!parsedUser?.phoneNumber;
      const hasPin = !!parsedUser?.pin;
      const hasValidUserData = hasPhone && hasPin;

      const onboardingComplete = savedOnboarding === "true";
      const isAuthenticated = savedAuth === "authenticated";

      if (onboardingComplete && isAuthenticated && hasValidUserData) {
        setHasCompletedOnboarding(true);
        setAuthStepState("authenticated");
        setNeedsReauth(true);
        setUserData(parsedUser);
      } else if (onboardingComplete && !isAuthenticated) {
        if (hasValidUserData) {
          setHasCompletedOnboarding(true);
          setAuthStepState("language_selection");
          setUserData(parsedUser);
        } else {
          await AsyncStorage.multiRemove([AUTH_KEY, USER_KEY, ONBOARDING_KEY]);
          setHasCompletedOnboarding(false);
          setAuthStepState("language_selection");
        }
      } else if (isAuthenticated && !onboardingComplete && hasValidUserData) {
        setHasCompletedOnboarding(true);
        setAuthStepState("authenticated");
        setNeedsReauth(true);
        setUserData(parsedUser);
      } else if (savedUser) {
        setUserData(parsedUser);

        // Recovery path: if user profile includes phone + PIN, treat as onboarded
        // even when flags are stale/missing so app lands on Login instead of onboarding.
        if (hasValidUserData) {
          setHasCompletedOnboarding(true);
          setAuthStepState("authenticated");
          setNeedsReauth(true);
        }
      }
    } catch (e) {
      console.log("AUTH LOAD ERROR:", e);
    }

    setIsLoading(false);
  };

  const setAuthStep = (step: AuthStep) => {
    setAuthStepState(step);
  };

  const setPhoneNumber = async (phone: string) => {
    const user: UserData = {
      phoneNumber: phone,
      bankName: "",
      bankAccountMasked: "",
      pin: "",
      biometricEnabled: false,
      customFaceEnabled: false,
      aadhaarLinked: false,
      name: "User",
      upiId: "",
      email: "",
    };
    setUserData(user);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const linkBank = async (bankName: string, accountNumber: string) => {
    if (!userData) return;
    const masked = "XXXX XXXX XXXX " + accountNumber.slice(-4);

    const newUser = { ...userData, bankName, bankAccountMasked: masked };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const setupPin = async (pin: string) => {
    if (!userData) return;
    const newUser = { ...userData, pin };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const enableBiometric = async (enabled: boolean) => {
    if (!userData) return;
    const newUser = { ...userData, biometricEnabled: enabled };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const enableCustomFace = async (enabled: boolean) => {
    if (!userData) return;
    const newUser = { ...userData, customFaceEnabled: enabled };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const linkAadhaar = async () => {
    if (!userData) return;
    const newUser = { ...userData, aadhaarLinked: true };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const updateUserProfile = async (name: string, upiId: string, email: string) => {
    if (!userData) return;
    const newUser = { ...userData, name, upiId, email };
    setUserData(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const login = async () => {
    await AsyncStorage.setItem(AUTH_KEY, "authenticated");
    setAuthStepState("authenticated");
    setNeedsReauth(false);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setNeedsReauth(true);
    setAuthStepState("language_selection");
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompletedOnboarding(true);

    await AsyncStorage.setItem(AUTH_KEY, "authenticated");
    setAuthStepState("authenticated");
  };

  const requireReauth = () => {
    if (hasCompletedOnboarding) {
      console.log("🔐 requireReauth called - forcing stop on voice recorder");
      (global as any).stopVoiceRecording?.();
      setNeedsReauth(true);
    }
  };

  const completeReauth = () => {
    setNeedsReauth(false);
  };

  const beginExternalAuthFlow = () => {
    setIsExternalAuthFlowActive(true);
    setForegroundReauthSuppressedUntil(Date.now() + 30000);
  };

  const endExternalAuthFlow = () => {
    setIsExternalAuthFlowActive(false);
    setShouldSkipNextForegroundReauth(true);
    setForegroundReauthSuppressedUntil(Date.now() + 10000);
  };

  const consumeForegroundReauthSkip = () => {
    setShouldSkipNextForegroundReauth(false);
  };

  // dashboard toggles
  const toggleVoiceGuide = () =>
    setVoiceGuideEnabled((prev) => !prev);

  const setOnlineStatus = (v: boolean) => setIsOnline(v);

  // SIM security functions
  const registerSIM = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await simService.registerSIM();
      if (result.success) {
        console.log("✅ SIM registered successfully during onboarding");
      }
      return result;
    } catch (error) {
      console.error("❌ Error registering SIM:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to register SIM",
      };
    }
  };

  const verifySIMAndWipeIfChanged = async (): Promise<boolean> => {
    try {
      const result = await simService.verifySIM();

      if (result.changed) {
        console.log("🚨 SIM CHANGE DETECTED - Wiping all data...");
        setSimChangeDetected(true);

        // Wipe all app data
        const wipeResult = await wipeAllAppData();

        if (wipeResult.success) {
          console.log("✅ Data wiped successfully after SIM change");

          // Reset auth state to force re-registration
          setUserData(null);
          setAuthStepState("language_selection");
          setHasCompletedOnboarding(false);
          setNeedsReauth(false);
        }

        return false; // SIM changed
      }

      return true; // SIM is valid
    } catch (error) {
      console.error("❌ Error verifying SIM:", error);
      return true; // Don't block on errors
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authStep,
        userData,
        isLoading,
        hasCompletedOnboarding,

        setAuthStep,
        setPhoneNumber,
        linkBank,
        setupPin,
        enableBiometric,
        enableCustomFace,
        linkAadhaar,
        updateUserProfile,
        login,
        logout,
        completeOnboarding,

        needsReauth,
        requireReauth,
        completeReauth,
        isExternalAuthFlowActive,
        shouldSkipNextForegroundReauth,
        foregroundReauthSuppressedUntil,
        beginExternalAuthFlow,
        endExternalAuthFlow,
        consumeForegroundReauthSkip,

        // SIM security
        registerSIM,
        verifySIMAndWipeIfChanged,
        simChangeDetected,

        voiceGuideEnabled,
        toggleVoiceGuide,
        isOnline,
        setOnlineStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
