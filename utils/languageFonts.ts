import { Platform, TextStyle } from "react-native";

import type { Language } from "@/constants/i18n";

/** Scripts that benefit from explicit sans-serif on Android for complex glyphs */
const USE_SANS_STACK: Language[] = [
  "hi",
  "or",
  "ta",
  "bn",
  "kn",
  "pa",
  "mr",
  "te",
  "gu",
  "ur",
];

/**
 * Extra text styles so Odia and other Indic scripts render with device fonts
 * that include Unicode glyphs (Android: sans-serif stack; iOS: system default).
 */
export function getIndicTextExtras(language: Language | undefined): TextStyle {
  if (!language || !USE_SANS_STACK.includes(language)) {
    return {};
  }
  return {
    ...Platform.select({
      android: {
        fontFamily: "sans-serif",
        includeFontPadding: false,
      },
      ios: {
        // San Francisco / system fonts cover many Indic ranges; keep default
      },
      default: {},
    }),
  };
}
