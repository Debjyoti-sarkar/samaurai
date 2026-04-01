import { Platform } from "react-native";

export const KAVACHColors = {
  background: "#F5F1E8",
  primary: "#2C5F4F",
  secondary: "#7A9B8E",
  sos: "#D32F2F",
  success: "#43A047",
  warning: "#FB8C00",
  info: "#1976D2",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  border: "#D4CFC2",
  card: "#FFFFFF",
  sendMoney: "#2C5F4F",
  qrScanner: "#1976D2",
  fraudScan: "#43A047",
  balance: "#1976D2",
  offlineOtp: "#FB8C00",
  recentActivity: "#FFC107",
  voiceAssistant: "#2196F3",
};

export const Colors = {
  light: {
    text: KAVACHColors.textPrimary,
    textSecondary: KAVACHColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: KAVACHColors.textSecondary,
    tabIconSelected: KAVACHColors.primary,
    link: KAVACHColors.primary,
    backgroundRoot: KAVACHColors.background,
    backgroundDefault: KAVACHColors.card,
    backgroundSecondary: "#F0ECE3",
    backgroundTertiary: "#E8E4DB",
    border: KAVACHColors.border,
    primary: KAVACHColors.primary,
    secondary: KAVACHColors.secondary,
    sos: KAVACHColors.sos,
    success: KAVACHColors.success,
    warning: KAVACHColors.warning,
    info: KAVACHColors.info,
    card: KAVACHColors.card,
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#7A9B8E",
    link: "#7A9B8E",
    backgroundRoot: "#1A1A1A",
    backgroundDefault: "#2A2C2E",
    backgroundSecondary: "#353739",
    backgroundTertiary: "#404244",
    border: "#404244",
    primary: "#7A9B8E",
    secondary: "#5A7B6E",
    sos: "#EF5350",
    success: "#66BB6A",
    warning: "#FFA726",
    info: "#42A5F5",
    card: "#2A2C2E",
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
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
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
    fontWeight: "400" as const,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};
