import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { theme, isDark, toggleTheme } = useThemeContext();
  return { theme, isDark, toggleTheme };
}
