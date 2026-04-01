import { useEffect, useRef, useCallback } from "react";

// Safely import Porcupine - may not be available in Expo Go
let PorcupineManager: any = null;
try {
  PorcupineManager = require("@picovoice/porcupine-react-native").PorcupineManager;
} catch (e) {
  console.log("🎤 Porcupine not available (expected in Expo Go)");
}

// Global manager reference to allow stopping from anywhere
let globalPorcupineManager: any = null;

// Export function to stop wake word detection globally
export async function stopWakeWordDetection() {
  if (globalPorcupineManager) {
    console.log("🎤 Stopping wake word detection globally...");
    try {
      await globalPorcupineManager.stop();
    } catch (e) {
      console.log("🎤 Wake word stop error (ignored):", e);
    }
  }
}

// Export function to resume wake word detection globally
export async function startWakeWordDetection() {
  if (globalPorcupineManager) {
    console.log("🎤 Resuming wake word detection...");
    try {
      await globalPorcupineManager.start();
    } catch (e) {
      console.log("🎤 Wake word start error (ignored):", e);
    }
  }
}

export function useWakeWord(onWake: () => void) {
  const managerRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      // Skip if Porcupine is not available (Expo Go)
      if (!PorcupineManager || !PorcupineManager.fromKeywordPaths) {
        console.log("🎤 Wake word detection not available (use development build)");
        return;
      }

      try {
        const manager = await PorcupineManager.fromKeywordPaths(
          "porcupine_params.pv",    // engine params file
          ["hey-nexa.ppn"],           // your custom wake word file
          (keywordIndex: number) => {
            console.log("Wake word detected!");
            onWake();
          }
        );
        managerRef.current = manager;
        globalPorcupineManager = manager;
        await manager.start();
        console.log("🎤 Wake word detection started");
      } catch (e) {
        console.log("🎤 Wake word init error:", e);
      }
    }

    init();

    return () => {
      if (managerRef.current) {
        managerRef.current.stop();
        managerRef.current.delete();
        managerRef.current = null;
        globalPorcupineManager = null;
      }
    };
  }, [onWake]);

  const stop = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.start();
    }
  }, []);

  return { stop, start };
}
