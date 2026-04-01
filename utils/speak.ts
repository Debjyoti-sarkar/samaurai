// utils/speak.ts
// Sends text to your backend /tts (preferred) and falls back to expo-speech.
// Prevents overlapping audio by stopping/unloading previous sound.

import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";

const SERVER_BASE = "http://192.168.0.175:5000"; // update if needed

let globalSound: Audio.Sound | null = null;

async function stopAndUnloadCurrent() {
  if (!globalSound) return;
  try {
    await globalSound.stopAsync();
  } catch {}
  try {
    await globalSound.unloadAsync();
  } catch {}
  globalSound = null;
}

export async function speak(text: string, languageCode?: string): Promise<void> {
  // Fire-and-forget (non-blocking) — safe to call for UI interactions
  try {
    // stop previous to avoid overlap
    await stopAndUnloadCurrent();

    // Try server POST /tts -> returns base64 audio (MP3)
    const resp = await fetch(`${SERVER_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });

    if (!resp.ok) {
      // fallback to expo-speech
      fallbackSpeak(text, languageCode);
      return;
    }

    const data = await resp.json();
    if (!data || !data.ok || !data.audioBase64) {
      fallbackSpeak(text, languageCode);
      return;
    }

    const fileUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, { encoding: "base64" });

    globalSound = new Audio.Sound();
    await globalSound.loadAsync({ uri: fileUri }, { shouldPlay: true });

    globalSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        // cleanup
        globalSound?.unloadAsync().catch(() => {});
        globalSound = null;
        FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
      }
    });
  } catch (e) {
    // fallback
    fallbackSpeak(text, languageCode);
  }
}

// speak and return a Promise that resolves when audio finishes
export async function speakAndWait(text: string, languageCode?: string): Promise<void> {
  // stop previous
  await stopAndUnloadCurrent();

  try {
    const resp = await fetch(`${SERVER_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });

    if (!resp.ok) {
      await fallbackSpeakAndWait(text, languageCode);
      return;
    }

    const data = await resp.json();
    if (!data || !data.ok || !data.audioBase64) {
      await fallbackSpeakAndWait(text, languageCode);
      return;
    }

    const fileUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, { encoding: "base64" });

    globalSound = new Audio.Sound();
    await globalSound.loadAsync({ uri: fileUri }, { shouldPlay: true });

    return new Promise((resolve) => {
      globalSound!.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          globalSound?.unloadAsync().catch(() => {});
          globalSound = null;
          FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          resolve();
        }
      });
      globalSound!.playAsync().catch(() => { resolve(); });
    });
  } catch (e) {
    await fallbackSpeakAndWait(text, languageCode);
  }
}

/* Fallback implementations using expo-speech */
function fallbackSpeak(text: string, languageCode?: string) {
  const lang = mapToExpoLang(languageCode);
  try {
    Speech.speak(text, {
      language: lang,
      rate: 1.0,
    });
  } catch (e) {
    // last resort: console log
    console.log("Fallback TTS error:", e);
  }
}

function fallbackSpeakAndWait(text: string, languageCode?: string): Promise<void> {
  return new Promise((resolve) => {
    const lang = mapToExpoLang(languageCode);
    try {
      Speech.speak(text, {
        language: lang,
        rate: 1.0,
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    } catch (e) {
      resolve();
    }
  });
}

function mapToExpoLang(languageCode?: string) {
  if (!languageCode) return "en-IN";
  // languageCode might be 'hi' or 'hi-IN' or 'or-IN'
  const lc = languageCode.toLowerCase();
  if (lc.startsWith("hi")) return "hi-IN";
  if (lc.startsWith("or")) return "or-IN";
  if (lc.startsWith("kn")) return "kn-IN";
  if (lc.startsWith("ta")) return "ta-IN";
  if (lc.startsWith("te")) return "te-IN";
  if (lc.startsWith("en")) return "en-IN";
  return "en-IN";
}

export default { speak, speakAndWait };