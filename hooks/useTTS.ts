import { useCallback } from "react";
import * as Speech from "expo-speech";

/**
 * Simple TTS hook using expo-speech (free, works offline)
 * No backend required
 */
export function useTTS() {
  const speak = useCallback(async (text: string, lang = "en-IN") => {
    try {
      // Stop any ongoing speech
      await Speech.stop();

      // Speak the text using device's built-in TTS
      Speech.speak(text, {
        language: lang,
        pitch: 1.0,
        rate: 0.9,
        onError: (error) => {
          console.warn("TTS error:", error);
        },
      });
    } catch (err) {
      console.error("useTTS error:", err);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await Speech.stop();
    } catch (err) {
      console.error("useTTS stop error:", err);
    }
  }, []);

  const isSpeaking = useCallback(async () => {
    return await Speech.isSpeakingAsync();
  }, []);

  return { speak, stop, isSpeaking };
}
