import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

import LanguageSelectionScreen from "@/screens/LanguageSelectionScreen";
import PhoneVerificationScreen from "@/screens/PhoneVerificationScreen";
import BankLinkingScreen from "@/screens/BankLinkingScreen";
import SecuritySetupScreen from "@/screens/SecuritySetupScreen";
import FaceSetupScreen from "@/screens/FaceSetupScreen";
import LoginScreen from "@/screens/LoginScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import SendMoneyScreen from "@/screens/SendMoneyScreen";
import QRScannerScreen from "@/screens/QRScannerScreen";
import FraudScanScreen from "@/screens/FraudScanScreen";
import BalanceScreen from "@/screens/BalanceScreen";
import TransactionHistoryScreen from "@/screens/TransactionHistoryScreen";
import OfflineOtpScreen from "@/screens/OfflineOtpScreen";
import VoiceAssistantScreen from "@/screens/VoiceAssistantScreen";
import SOSScreen from "@/screens/SOSScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import PaymentProcessingScreen from "@/screens/PaymentProcessingScreen";
import ChangePinScreen from "@/screens/ChangePinScreen";
import BiometricSettingsScreen from "@/screens/BiometricSettingsScreen";
import AadhaarVerificationScreen from "@/screens/AadhaarVerificationScreen";
import HelpFaqScreen from "@/screens/HelpFaqScreen";
import ContactSupportScreen from "@/screens/ContactSupportScreen";
import TermsPrivacyScreen from "@/screens/TermsPrivacyScreen";
import ContactPickerScreen from "@/screens/ContactPickerScreen";
import SecurityDashboardScreen from "@/screens/SecurityDashboardScreen";
import BehaviorAnalyticsDashboard from "@/screens/BehaviorAnalyticsDashboard";
import FraudAlertScreen from "@/screens/FraudAlertScreen";
import SMSFraudDashboard from "@/screens/SMSFraudDashboard";
import UpiLearningScreen from "@/screens/UpiLearningScreen";
import OtpFraudScannerScreen from "@/screens/OtpFraudScannerScreen";
import LoanDashboardScreen from "@/screens/LoanDashboardScreen";
import LoanApplicationScreen from "@/screens/LoanApplicationScreen";
import QrScreen from "@/screens/QrScreen";
import GenerateQRScreen from "@/screens/GenerateQRScreen";
import BiometricAuthScreen from "@/screens/BiometricAuthScreen";
import SpamDetectionScreen from "@/screens/SpamDetectionScreen";
import OTPVerificationScreen from "@/screens/OTPVerificationScreen";
import { PaymentOrder } from "@/services/paymentGateway";
import { FraudAnalysis } from "@/services/RealTimeSMSMonitor";

import SecurityInsightsScreen from "@/screens/SecurityInsightsScreen";
import SecurityGraphScreen from "@/screens/SecurityGraphScreen";
import SecurityAlertsScreen from "@/screens/SecurityAlertsScreen";

export type RootStackParamList = {
  LanguageSelection: undefined;
  PhoneVerification: undefined;
  BankLinking: undefined;
  SecuritySetup: undefined;
  FaceSetup: undefined;
  Login: undefined;
  Dashboard: undefined;
  SendMoney:
    | { recipient?: string; amount?: string; contactName?: string }
    | undefined;
  ContactPicker: undefined;
  OTPVerification:
    | {
        phoneNumber?: string;
        purpose?: 'login' | 'transaction' | 'registration' | 'reset';
        amount?: number;
        recipient?: string;
      }
  PaymentProcessing: { paymentOrder: PaymentOrder };
  QRScanner: undefined;
  FraudScan: undefined;
  Balance: undefined;
  TransactionHistory: undefined;
  OfflineOtp: undefined;
  VoiceAssistant: undefined;
  SOS: undefined;
  Settings: undefined;
  ChangePin: undefined;
  BiometricSettings: undefined;
  AadhaarVerification: undefined;
  HelpFaq: undefined;
  ContactSupport: undefined;
  TermsPrivacy: undefined;
  SecurityDashboard: undefined;
  BehaviorAnalytics: undefined;
  FraudAlert:
    | {
        recordId?: string;
        sms?: {
          sender: string;
          body: string;
          timestamp: number;
        };
        analysis?: FraudAnalysis;
      }
    | undefined;
  SMSFraudDashboard: undefined;
  UpiLearning: undefined;
  OtpFraudScanner: undefined;
  LoanDashboard: undefined;
  LoanApplication: { loanType?: string } | undefined;
  QrScan: undefined;
  GenerateQR: undefined;
  BiometricAuth: undefined;
  SpamDetection: undefined;
  SecurityInsights: undefined;
  SecurityGraph: undefined;
  SecurityAlerts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function DashboardTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: any = "home";
          if (route.name === "Home") iconName = "home";
          else if (route.name === "ScanTab") iconName = "maximize";
          else if (route.name === "HistoryTab") iconName = "clock";
          else if (route.name === "ProfileTab") iconName = "user";
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen
        name="ScanTab"
        component={QRScannerScreen}
        options={{ tabBarLabel: "Scan" }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={TransactionHistoryScreen}
        options={{ tabBarLabel: "History" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={SettingsScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { theme, isDark } = useTheme();

  // 🔥 IMPORTANT: PIN logic
  const { authStep, hasCompletedOnboarding, needsReauth } = useAuth();
  const navigation = useNavigation<any>();

  // 🔥 Redirect to PIN screen when needsReauth = true
  useEffect(() => {
    if (needsReauth && hasCompletedOnboarding && navigation) {
      console.log("🔒 Redirecting to Login screen - needsReauth:", needsReauth);
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }, 100);
    }
  }, [needsReauth, hasCompletedOnboarding, navigation]);

  // Decide first screen based on onboarding + authStep
  const getInitialRoute = (): keyof RootStackParamList => {
    // If onboarding not completed, show onboarding flow
    if (!hasCompletedOnboarding) {
      switch (authStep) {
        case "language_selection":
          return "LanguageSelection";
        case "phone_verification":
          return "PhoneVerification";
        case "bank_linking":
          return "BankLinking";
        case "security_setup":
          return "SecuritySetup";
        default:
          return "LanguageSelection";
      }
    }

    // Onboarding completed - always show PIN screen first
    return "Login";
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={getCommonScreenOptions({ theme, isDark })}
    >
      {/* Onboarding Screens */}
      <Stack.Screen
        name="LanguageSelection"
        component={LanguageSelectionScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="PhoneVerification"
        component={PhoneVerificationScreen}
        options={{ headerTitle: "", headerBackVisible: true }}
      />

      <Stack.Screen
        name="BankLinking"
        component={BankLinkingScreen}
        options={{ headerTitle: "", headerBackVisible: true }}
      />

      <Stack.Screen
        name="SecuritySetup"
        component={SecuritySetupScreen}
        options={{ headerTitle: "", headerBackVisible: true }}
      />

      <Stack.Screen
        name="FaceSetup"
        component={FaceSetupScreen}
        options={{ headerTitle: "Face Setup", headerBackVisible: true }}
      />

      {/* PIN / Login */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />

      {/* MAIN APP */}
      <Stack.Screen
        name="OTPVerification"
        component={OTPVerificationScreen}
        options={{ headerTitle: "Verify OTP" }}
      />

      <Stack.Screen
        name="Dashboard"
        component={DashboardTabs}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="SendMoney"
        component={SendMoneyScreen}
        options={{ headerTitle: "Send Money" }}
      />

      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{
          headerTitle: "Scan QR",
          presentation: "fullScreenModal",
          headerTransparent: true,
        }}
      />

      <Stack.Screen
        name="FraudScan"
        component={FraudScanScreen}
        options={{ headerTitle: "Scan for Fraud" }}
      />

      <Stack.Screen
        name="Balance"
        component={BalanceScreen}
        options={{ headerTitle: "Account Balance" }}
      />

      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ headerTitle: "Recent Activity" }}
      />

      <Stack.Screen
        name="OfflineOtp"
        component={OfflineOtpScreen}
        options={{ headerTitle: "Offline OTP" }}
      />

      <Stack.Screen
        name="VoiceAssistant"
        component={VoiceAssistantScreen}
        options={{
          headerTitle: "Voice Assistant",
          presentation: "modal",
        }}
      />

      <Stack.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          headerTitle: "Emergency",
          presentation: "modal",
        }}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerTitle: "Settings" }}
      />

      <Stack.Screen
        name="ChangePin"
        component={ChangePinScreen}
        options={{ headerTitle: "Change PIN" }}
      />

      <Stack.Screen
        name="BiometricSettings"
        component={BiometricSettingsScreen}
        options={{ headerTitle: "Biometric Authentication" }}
      />

      <Stack.Screen
        name="AadhaarVerification"
        component={AadhaarVerificationScreen}
        options={{ headerTitle: "Aadhaar Verification" }}
      />

      <Stack.Screen
        name="HelpFaq"
        component={HelpFaqScreen}
        options={{ headerTitle: "Help & FAQ" }}
      />

      <Stack.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{ headerTitle: "Contact Support" }}
      />

      <Stack.Screen
        name="TermsPrivacy"
        component={TermsPrivacyScreen}
        options={{ headerTitle: "Terms & Privacy" }}
      />

      <Stack.Screen
        name="ContactPicker"
        component={ContactPickerScreen}
        options={{ headerTitle: "Select Contact" }}
      />

      <Stack.Screen
        name="PaymentProcessing"
        component={PaymentProcessingScreen}
        options={{
          headerTitle: "Payment",
          headerBackVisible: false,
        }}
      />

      <Stack.Screen
        name="SecurityDashboard"
        component={SecurityDashboardScreen}
        options={{ headerTitle: "Security Dashboard" }}
      />

      <Stack.Screen
        name="BehaviorAnalytics"
        component={BehaviorAnalyticsDashboard}
        options={{ headerTitle: "Behavior Analytics" }}
      />

      <Stack.Screen
        name="FraudAlert"
        component={FraudAlertScreen}
        options={{
          headerTitle: "Fraud Alert",
          presentation: "modal",
          headerBackVisible: true,
        }}
      />

      <Stack.Screen
        name="SMSFraudDashboard"
        component={SMSFraudDashboard}
        options={{ headerTitle: "SMS Protection" }}
      />

      {/* Merged NexaVault Features */}
      <Stack.Screen
        name="OtpFraudScanner"
        component={OtpFraudScannerScreen}
        options={{ headerTitle: "OTP Fraud Scanner" }}
      />

      <Stack.Screen
        name="LoanDashboard"
        component={LoanDashboardScreen}
        options={{ headerTitle: "Loans" }}
      />

      <Stack.Screen
        name="LoanApplication"
        component={LoanApplicationScreen}
        options={{ headerTitle: "Apply for Loan" }}
      />

      <Stack.Screen
        name="QrScan"
        component={QrScreen}
        options={{
          headerTitle: "Scan QR Code",
          presentation: "fullScreenModal",
          headerTransparent: true,
        }}
      />

      <Stack.Screen
        name="GenerateQR"
        component={GenerateQRScreen}
        options={{ headerTitle: "Generate QR Code" }}
      />

      <Stack.Screen
        name="BiometricAuth"
        component={BiometricAuthScreen}
        options={{ headerTitle: "Biometric Setup" }}
      />

      <Stack.Screen
        name="SpamDetection"
        component={SpamDetectionScreen}
        options={{ headerTitle: "Spam Detection" }}
      />

      <Stack.Screen
        name="UpiLearning"
        component={UpiLearningScreen}
        options={{ headerTitle: "UPI Learning" }}
      />

      {/* Security Intelligence System */}
      <Stack.Screen
        name="SecurityInsights"
        component={SecurityInsightsScreen}
        options={{ headerTitle: "Intelligence Settings" }}
      />
      <Stack.Screen
        name="SecurityGraph"
        component={SecurityGraphScreen}
        options={{ headerTitle: "Entity Graph", presentation: "modal" }}
      />
      <Stack.Screen
        name="SecurityAlerts"
        component={SecurityAlertsScreen}
        options={{ headerTitle: "Alerts Feeds" }}
      />
    </Stack.Navigator>
  );
}
