// components/VoiceRecorder.tsx
import React, {
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  AppState,
  AppStateStatus,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { TRANSCRIBE_URL, PARSE_URL } from "../services/assistant";
import * as Speech from "expo-speech";
import { useNavigation } from "@react-navigation/native";
import { stopWakeWordDetection, startWakeWordDetection } from "../hooks/useWakeWord";
import { useNetwork } from "@/hooks/useNetwork";

export type VoiceRecorderHandle = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRecording: () => boolean;
};

export interface VoiceRecorderProps {
  onTranscribed: (text: string) => void;
  onStateChange?: (isRecording: boolean, isSending: boolean) => void;
  useAssistantEndpoint?: boolean;
  enableAssistantFlow?: boolean;
  showUI?: boolean;
  primaryColor?: string;
}

const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(
  (
    {
      onTranscribed,
      onStateChange,
      useAssistantEndpoint = true,
      enableAssistantFlow = false,
      showUI = true,
      primaryColor = "#007AFF",
    },
    ref
  ) => {
    const navigation = useNavigation<any>();
    const { isConnected, isWeak } = useNetwork();

    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [status, setStatus] = useState<"idle" | "recording" | "sending">(
      "idle"
    );
    const recordingRef = useRef<Audio.Recording | null>(null);
    const isPreparingRef = useRef<boolean>(false);
    const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Keep ref in sync with state for cleanup
    useEffect(() => {
      recordingRef.current = recording;
    }, [recording]);

    // PERMANENT FIX: Completely disable wake word detection while VoiceRecorder is mounted
    // This prevents microphone resource conflicts at the native level
    useEffect(() => {
      stopWakeWordDetection();
      
      return () => {
        // Re-enable when component unmounts
        startWakeWordDetection();
      };
    }, []);

    // Handle app going to background - stop recording
    useEffect(() => {
      const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (nextAppState === "background" || nextAppState === "inactive") {
          if (recordingRef.current) {
            console.log("🎤 App backgrounded, stopping recording...");
            try {
              await recordingRef.current.stopAndUnloadAsync();
            } catch (e) {
              // Ignore
            }
            setRecording(null);
            setStatus("idle");
            onStateChange?.(false, false);
          }
        }
      };

      const subscription = AppState.addEventListener("change", handleAppStateChange);
      return () => {
        subscription.remove();
      };
    }, [onStateChange]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
        }
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
        }
      };
    }, []);

    // -----------------------------
    // 🟢 START RECORDING
    // -----------------------------
    async function startRecording() {
      // Prevent overlapping start calls which can trigger
      // "Only one Recording object can be prepared" errors
      if (status !== "idle" || isPreparingRef.current) {
        console.log("🎤 Already recording or sending, ignoring start request");
        return;
      }

      // Cancel any pending cleanup timers
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }

      try {
        isPreparingRef.current = true;
        
        // AGGRESSIVE CLEANUP: Unload ALL audio objects immediately
        await Audio.setIsEnabledAsync(false);
        
        // Best-effort cleanup of stale recording objects
        if (recordingRef.current) {
          try {
            await recordingRef.current.stopAndUnloadAsync();
          } catch (e) {
            console.log("🎤 Cleanup warning:", e);
          }
          recordingRef.current = null;
        }

        if (recording) {
          try {
            await recording.stopAndUnloadAsync();
          } catch (e) {
            console.log("🎤 Cleanup warning:", e);
          }
          setRecording(null);
        }

        // Give native layer 300ms to fully release resources
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Re-enable audio
        await Audio.setIsEnabledAsync(true);

        // Check network status before starting
        if (!isConnected || isWeak) {
          Alert.alert(
            "Network Issue",
            "Voice assistant unavailable due to weak or no internet connection. Please type your request or try again later."
          );
          isPreparingRef.current = false;
          return;
        }

        console.log("🎤 Requesting mic permissions…");
        const { status: permStatus } = await Audio.requestPermissionsAsync();
        if (permStatus !== "granted") {
          Alert.alert(
            "Microphone Permission Required",
            "Enable microphone permission in settings."
          );
          isPreparingRef.current = false;
          return;
        }
        console.log("🎤 Permissions granted");

        // Set audio mode for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        console.log("🎤 Creating new recording instance...");
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        setRecording(newRecording);
        setStatus("recording");
        onStateChange?.(true, false);

        console.log("🎤 Recording started!");

      } catch (err: any) {
        console.error("🚨 Recording start error:", err);
        Alert.alert(
          "Recording Error",
          err?.message?.includes("Only one Recording") 
            ? "Please wait a moment and try again." 
            : "Could not start recording. Please try again."
        );
        setStatus("idle");
        onStateChange?.(false, false);
      } finally {
        isPreparingRef.current = false;
      }
    }

    // -----------------------------
    // 🛑 STOP RECORDING
    // -----------------------------
    async function stopRecording() {
      if (!recording) {
        console.log("🎤 No active recording to stop");
        return;
      }

      console.log("🎤 Stopping recording...");
      setStatus("sending");
      onStateChange?.(false, true);

      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        // Now that it's stopped and unloaded, clear the state
        setRecording(null);

        console.log("🎤 File URI:", uri);
        if (!uri) throw new Error("No audio file URI");

        // Convert audio → FormData
        const formData = new FormData();
        formData.append("audio", {
          uri,
          name: "recording.wav",
          type: "audio/wav",
        } as any);

        // Send to backend
        console.log("🎤 Sending audio to:", TRANSCRIBE_URL);
        const res = await fetch(TRANSCRIBE_URL, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("🚨 Server error response:", res.status, errorText);
          throw new Error(`Server error: ${res.status}`);
        }

        const json = await res.json();
        const text = json?.text || "";
        console.log("📝 Transcribed text:", text);

        if (text.trim()) {
          onTranscribed(text);
        } else {
          Alert.alert("No Speech Detected", "Please try speaking again.");
        }

      } catch (err) {
        console.error("🚨 Stop recording/transcription error:", err);
        Alert.alert("Error", "Failed to process audio.");
      } finally {
        setStatus("idle");
        onStateChange?.(false, false);
        
        // Delayed cleanup to ensure complete resource release
        cleanupTimerRef.current = setTimeout(async () => {
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
          } catch (e) {
            console.log("🎤 Audio mode reset warning:", e);
          }
        }, 100);
      }
    }

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      start: startRecording,
      stop: stopRecording,
      isRecording: () => status === "recording",
    }));

    // UI
    if (!showUI) return null;

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: status === "recording" ? "#FF3B30" : primaryColor },
          ]}
          disabled={status === "sending"}
          onPress={() => {
            if (status === "recording") stopRecording();
            else startRecording();
          }}
        >
          {status === "sending" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={status === "recording" ? "stop" : "mic"}
              size={28}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {status === "idle" && "Tap to record"}
          {status === "recording" && "Recording… Tap to stop"}
          {status === "sending" && "Processing audio…"}
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: 12 },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: { marginTop: 8, fontSize: 14, color: "#666" },
});

VoiceRecorder.displayName = "VoiceRecorder";
export default VoiceRecorder;
