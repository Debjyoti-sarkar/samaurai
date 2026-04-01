import { Colors } from "@/constants/theme";

export function useTheme() {
  // Force light mode
  const isDark = false;
  const theme = Colors.light;

  return {
    theme,
    isDark,
  };
}
