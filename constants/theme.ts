import { Platform } from "react-native";

export const KAVACHColors = {
  background: "#0F172A", // Slate 900
  primary: "#6366F1", // Indigo 500
  secondary: "#818CF8", // Indigo 400
  sos: "#EF4444", // Red 500
  success: "#10B981", // Emerald 500
  warning: "#F59E0B", // Amber 500
  info: "#3B82F6", // Blue 500
  textPrimary: "#F8FAFC", // Slate 50
  textSecondary: "#94A3B8", // Slate 400
  border: "#1E293B", // Slate 800
  card: "#1E293B", // Slate 800
  sendMoney: "#6366F1", 
  qrScanner: "#3B82F6",
  fraudScan: "#10B981",
  balance: "#3B82F6",
  offlineOtp: "#F59E0B",
  recentActivity: "#8B5CF6", // Violet 500
  voiceAssistant: "#06B6D4", // Cyan 500
};

export const Colors = {
  light: {
    text: "#0F172A",
    textSecondary: "#64748B",
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748B",
    tabIconSelected: KAVACHColors.primary,
    link: KAVACHColors.primary,
    backgroundRoot: "#F8FAFC",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#E2E8F0",
    backgroundTertiary: "#CBD5E1",
    border: "#CBD5E1",
    primary: KAVACHColors.primary,
    secondary: KAVACHColors.secondary,
    sos: KAVACHColors.sos,
    success: KAVACHColors.success,
    warning: KAVACHColors.warning,
    info: KAVACHColors.info,
    card: "#FFFFFF",
  },
  dark: { // force dark mode styling for the aesthetic
    text: KAVACHColors.textPrimary,
    textSecondary: KAVACHColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: KAVACHColors.textSecondary,
    tabIconSelected: KAVACHColors.primary,
    link: KAVACHColors.primary,
    backgroundRoot: KAVACHColors.background,
    backgroundDefault: KAVACHColors.card,
    backgroundSecondary: "#334155",
    backgroundTertiary: "#475569",
    border: KAVACHColors.border,
    primary: KAVACHColors.primary,
    secondary: KAVACHColors.secondary,
    sos: KAVACHColors.sos,
    success: KAVACHColors.success,
    warning: KAVACHColors.warning,
    info: KAVACHColors.info,
    card: KAVACHColors.card,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 56, // Taller inputs for modern feel
  buttonHeight: 56, // Taller buttons
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32, // rounder
  "2xl": 40,
  "3xl": 50,
  full: 9999, // complete pill
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  lg: {
    shadowColor: "#6366F1", // Primary glow for prominent cards
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
};
