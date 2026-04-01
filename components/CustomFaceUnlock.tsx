import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { KAVACHColors, Shadows } from "@/constants/theme";
import { useTTS } from "@/hooks/useTTS";
import { enrollFace, verifyFace } from "@/services/faceVerification";

const { width } = Dimensions.get("window");
const SCAN_SIZE = width * 0.7;
const REQUIRED_STABLE_DETECTIONS = 8;
const DETECTION_STALE_MS = 1200;
const SUCCESS_DELAY_MS = 1200;

type FaceBounds = {
  origin?: { x?: number; y?: number };
  size?: { width?: number; height?: number };
};

type DetectedFace = {
  bounds?: FaceBounds;
  yawAngle?: number;
  rollAngle?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
};

type FacesDetectedEvent = {
  faces?: DetectedFace[];
};

interface CustomFaceUnlockProps {
  visible: boolean;
  mode?: "verify" | "enroll";
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
  onFailure?: (message: string) => void;
  onProcessingChange?: (processing: boolean) => void;
}

export function CustomFaceUnlock({
  visible,
  mode = "verify",
  userId,
  onSuccess,
  onClose,
  onFailure,
  onProcessingChange,
}: CustomFaceUnlockProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [statusText, setStatusText] = useState(
    "Position your face in the frame",
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverableError, setHasRecoverableError] = useState(false);
  const cameraRef = useRef<any>(null);
  const stableDetectionsRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const blinkReadyRef = useRef(false);
  const blinkVerifiedRef = useRef(false);
  const isCapturingRef = useRef(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak } = useTTS();

  const scanLinePos = useSharedValue(0);
  const scanRingScale = useSharedValue(1);
  const scanRingOpacity = useSharedValue(0.5);
  const successColorProgress = useSharedValue(0);

  const resetState = useCallback(() => {
    setIsScanning(false);
    setScanComplete(false);
    setScanProgress(0);
    setIsSubmitting(false);
    setHasRecoverableError(false);
    setStatusText("Position your face in the frame");
    stableDetectionsRef.current = 0;
    lastDetectionAtRef.current = 0;
    blinkReadyRef.current = false;
    blinkVerifiedRef.current = false;
    isCapturingRef.current = false;
    successColorProgress.value = 0;
  }, [successColorProgress]);

  const failAndReset = useCallback(
    (message: string) => {
      stableDetectionsRef.current = 0;
      blinkReadyRef.current = false;
      blinkVerifiedRef.current = false;
      isCapturingRef.current = false;
      setIsSubmitting(false);
      setHasRecoverableError(true);
      setScanProgress(0);
      setStatusText(message);
      onFailure?.(message);
    },
    [onFailure],
  );

  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      })();

      resetState();
      speak(
        mode === "enroll"
          ? "Look at the camera to enroll your face"
          : "Please look at the camera",
      );
      setIsScanning(true);
      onProcessingChange?.(false);

      scanRingScale.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      scanRingOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 }),
        ),
        -1,
        true,
      );

      scanLinePos.value = withRepeat(
        withSequence(
          withTiming(SCAN_SIZE, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, [
    mode,
    onProcessingChange,
    resetState,
    scanLinePos,
    scanRingOpacity,
    scanRingScale,
    speak,
    visible,
  ]);

  const completeScan = useCallback(() => {
    if (scanComplete) return;

    isCapturingRef.current = false;
    setIsScanning(false);
    setIsSubmitting(false);
    setHasRecoverableError(false);
    setScanComplete(true);
    setScanProgress(1);
    setStatusText(mode === "enroll" ? "Face Enrolled" : "Face Verified");
    speak(
      mode === "enroll"
        ? "Face enrollment completed."
        : "Face recognized. Access granted.",
    );

    successColorProgress.value = withTiming(1, { duration: 500 });

    successTimeoutRef.current = setTimeout(() => {
      onSuccess();
    }, SUCCESS_DELAY_MS);
  }, [mode, onSuccess, scanComplete, speak, successColorProgress]);

  const updateProgress = useCallback((value: number) => {
    setScanProgress(Math.max(0, Math.min(1, value)));
  }, []);

  const isFaceCentered = useCallback((face: DetectedFace) => {
    const screen = Dimensions.get("window");
    const originX = face.bounds?.origin?.x ?? 0;
    const originY = face.bounds?.origin?.y ?? 0;
    const faceWidth = face.bounds?.size?.width ?? 0;
    const faceHeight = face.bounds?.size?.height ?? 0;

    if (!faceWidth || !faceHeight) {
      return false;
    }

    const faceCenterX = originX + faceWidth / 2;
    const faceCenterY = originY + faceHeight / 2;
    const horizontalOffset = Math.abs(faceCenterX - screen.width / 2);
    const verticalOffset = Math.abs(faceCenterY - screen.height / 2);
    const minFaceSize = Math.min(screen.width, screen.height) * 0.18;
    const maxYaw = Math.abs(face.yawAngle ?? 0);
    const maxRoll = Math.abs(face.rollAngle ?? 0);

    return (
      faceWidth >= minFaceSize &&
      faceHeight >= minFaceSize &&
      horizontalOffset <= screen.width * 0.18 &&
      verticalOffset <= screen.height * 0.2 &&
      maxYaw <= 18 &&
      maxRoll <= 18
    );
  }, []);

  const submitFaceImage = useCallback(async () => {
    if (!userId) {
      failAndReset("A valid user profile is required for face recognition");
      return;
    }

    if (isCapturingRef.current || !cameraRef.current) {
      return;
    }

    isCapturingRef.current = true;
    setIsSubmitting(true);
    setHasRecoverableError(false);
    onProcessingChange?.(true);
    setStatusText(
      mode === "enroll"
        ? "Saving enrolled face..."
        : "Matching enrolled face...",
    );

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error("Unable to capture a clear face image");
      }

      const result =
        mode === "enroll"
          ? await enrollFace(userId, photo.uri)
          : await verifyFace(userId, photo.uri);

      if (!result.success) {
        throw new Error(result.message || "Face processing failed");
      }

      if (mode === "verify" && !result.matched) {
        throw new Error(
          result.message || "Face did not match the enrolled profile",
        );
      }

      completeScan();
    } catch (error) {
      failAndReset(
        error instanceof Error ? error.message : "Face verification failed",
      );
    } finally {
      onProcessingChange?.(false);
    }
  }, [completeScan, failAndReset, mode, onProcessingChange, userId]);

  const handleFacesDetected = useCallback(
    (event: FacesDetectedEvent) => {
      if (!visible || scanComplete || isSubmitting) {
        return;
      }

      const faces = event.faces ?? [];

      if (faces.length === 0) {
        const staleFor = Date.now() - lastDetectionAtRef.current;
        if (staleFor > DETECTION_STALE_MS) {
          stableDetectionsRef.current = 0;
          blinkReadyRef.current = false;
          blinkVerifiedRef.current = false;
          updateProgress(0);
          setHasRecoverableError(true);
          setStatusText("Position your face in the frame");
          onFailure?.("Face not detected");
        }
        return;
      }

      if (faces.length > 1) {
        stableDetectionsRef.current = 0;
        blinkReadyRef.current = false;
        blinkVerifiedRef.current = false;
        updateProgress(0);
        setStatusText("Only one face should be visible");
        return;
      }

      const face = faces[0];
      lastDetectionAtRef.current = Date.now();

      if (!isFaceCentered(face)) {
        stableDetectionsRef.current = 0;
        blinkReadyRef.current = false;
        blinkVerifiedRef.current = false;
        updateProgress(0);
        setStatusText("Center your face and look straight");
        return;
      }

      const leftEye = face.leftEyeOpenProbability;
      const rightEye = face.rightEyeOpenProbability;
      const hasEyeProbabilities =
        typeof leftEye === "number" && typeof rightEye === "number";

      if (hasEyeProbabilities) {
        if (leftEye > 0.7 && rightEye > 0.7) {
          blinkReadyRef.current = true;
        } else if (
          blinkReadyRef.current &&
          (leftEye < 0.35 || rightEye < 0.35)
        ) {
          blinkVerifiedRef.current = true;
        }
      } else {
        blinkVerifiedRef.current = true;
      }

      stableDetectionsRef.current = Math.min(
        stableDetectionsRef.current + 1,
        REQUIRED_STABLE_DETECTIONS,
      );

      const progressWeight =
        hasEyeProbabilities && !blinkVerifiedRef.current ? 0.7 : 1;
      updateProgress(
        (stableDetectionsRef.current / REQUIRED_STABLE_DETECTIONS) *
          progressWeight,
      );

      if (hasEyeProbabilities && !blinkVerifiedRef.current) {
        setStatusText(
          blinkReadyRef.current
            ? "Blink once to verify"
            : "Hold still and keep eyes open",
        );
        return;
      }

      setStatusText(
        mode === "enroll"
          ? "Face detected. Enrolling..."
          : "Face detected. Verifying...",
      );

      if (stableDetectionsRef.current >= REQUIRED_STABLE_DETECTIONS) {
        submitFaceImage();
      }
    },
    [
      isFaceCentered,
      isSubmitting,
      mode,
      onFailure,
      scanComplete,
      submitFaceImage,
      updateProgress,
      visible,
    ],
  );

  const animatedScanLine = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePos.value }],
    opacity: isScanning ? 1 : 0,
  }));

  const animatedRing = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      successColorProgress.value,
      [0, 1],
      [KAVACHColors.primary, KAVACHColors.success],
    );

    return {
      transform: [{ scale: scanRingScale.value }],
      opacity: scanRingOpacity.value,
      borderColor,
    };
  });

  const animatedStatusBox = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      successColorProgress.value,
      [0, 1],
      [KAVACHColors.primary + "CC", KAVACHColors.success + "CC"],
    );
    return { backgroundColor };
  });

  if (!visible) return null;

  if (hasPermission === null) {
    return <View style={styles.overlay} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.overlay}>
        <View style={styles.permissionBox}>
          <Feather name="camera-off" size={48} color={KAVACHColors.sos} />
          <ThemedText style={{ textAlign: "center", marginTop: 16 }}>
            No access to camera
          </ThemedText>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <ThemedText style={{ color: "#FFF" }}>Close</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
        mirror
        active={visible}
        {...({ onFacesDetected: handleFacesDetected } as any)}
      />

      <BlurView
        intensity={20}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconButton}>
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>
          <ThemedText type="h3" style={{ color: "#FFF" }}>
            {mode === "enroll" ? "Enroll Face" : "Face Unlock"}
          </ThemedText>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.scanContainer}>
          <Animated.View style={[styles.scanRingOuter, animatedRing]}>
            <View style={styles.scanRingInner}>
              <Animated.View style={[styles.scanLine, animatedScanLine]} />
              <ThemedText style={styles.instructionText}>
                Align your face inside the frame
              </ThemedText>
              {scanComplete ? (
                <View style={styles.successIconContainer}>
                  <Feather name="check" size={80} color="#FFF" />
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>

        <View style={styles.statusContainer}>
          <Animated.View style={[styles.statusBox, animatedStatusBox]}>
            <ThemedText style={styles.statusText}>{statusText}</ThemedText>
          </Animated.View>
        </View>

        {!scanComplete ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${scanProgress * 100}%` },
                ]}
              />
            </View>
            <ThemedText style={styles.progressText}>
              {isSubmitting
                ? mode === "enroll"
                  ? "Uploading enrolled face"
                  : "Matching face against enrolled profile"
                : "Live camera verification in progress"}
            </ThemedText>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : null}
            {hasRecoverableError ? (
              <Pressable style={styles.retryButton} onPress={resetState}>
                <Feather name="refresh-ccw" size={16} color="#FFF" />
                <ThemedText style={styles.retryText}>Retry</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanRingOuter: {
    width: SCAN_SIZE + 40,
    height: SCAN_SIZE + 40,
    borderRadius: (SCAN_SIZE + 40) / 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  scanRingInner: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  instructionText: {
    position: "absolute",
    bottom: 18,
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scanLine: {
    width: "100%",
    height: 4,
    backgroundColor: KAVACHColors.primary,
    position: "absolute",
    top: 0,
    shadowColor: KAVACHColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  successIconContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: KAVACHColors.success + "AA",
    alignItems: "center",
    justifyContent: "center",
  },
  statusContainer: {
    paddingBottom: 24,
    alignItems: "center",
  },
  statusBox: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    ...Shadows.md,
  },
  statusText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  permissionBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E1E1E",
    padding: 20,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: KAVACHColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  progressContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  progressTrack: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: KAVACHColors.success,
  },
  progressText: {
    color: "#FFF",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
