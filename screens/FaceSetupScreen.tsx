import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { CustomFaceUnlock } from "@/components/CustomFaceUnlock";
import { FaceAuthSnackbar } from "@/components/FaceAuthSnackbar";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import {
  KAVACHColors,
  Shadows,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootNavigator";
import {
  saveCustomFaceEnrolledFlag,
  saveCustomFaceFlag,
} from "@/utils/secureManager";

export default function FaceSetupScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userData, enableCustomFace } = useAuth();

  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarTone, setSnackbarTone] = useState<
    "error" | "success" | "info"
  >("info");

  const userId = userData?.phoneNumber || "";

  const showSnackbar = useCallback(
    (message: string, tone: "error" | "success" | "info" = "info") => {
      setSnackbarMessage(message);
      setSnackbarTone(tone);
      setTimeout(() => {
        setSnackbarMessage("");
      }, 2600);
    },
    [],
  );

  const helperText = useMemo(() => {
    if (isEnrolled) {
      return "Face enrolled successfully";
    }
    return "Align your face inside the frame and keep the camera steady.";
  }, [isEnrolled]);

  const handleEnrollmentSuccess = useCallback(async () => {
    try {
      await saveCustomFaceFlag(true);
      await saveCustomFaceEnrolledFlag(true);
      await enableCustomFace(true);
      setIsEnrolled(true);
      setShowFaceEnrollment(false);
      showSnackbar("Face enrolled successfully", "success");
    } catch {
      setShowFaceEnrollment(false);
      showSnackbar("Face enrolled, but settings could not be saved", "error");
    }
  }, [enableCustomFace, showSnackbar]);

  const handleFailure = useCallback(
    (message: string) => {
      const normalized = message.toLowerCase();
      if (normalized.includes("confidence")) {
        showSnackbar(
          "Low confidence. Please retry in better lighting.",
          "error",
        );
        return;
      }
      if (normalized.includes("not detected")) {
        showSnackbar("Face not detected. Align your face and retry.", "error");
        return;
      }
      showSnackbar(message || "Face setup failed. Please try again.", "error");
    },
    [showSnackbar],
  );

  return (
    <>
      <ScreenScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Feather name="camera" size={34} color={KAVACHColors.primary} />
          </View>
          <ThemedText type="h2" style={styles.title}>
            Set up Face Unlock
          </ThemedText>
          <ThemedText style={styles.subtitle}>{helperText}</ThemedText>
        </View>

        <View style={[styles.card, Shadows.md]}>
          <View style={styles.row}>
            <Feather
              name="check-circle"
              size={18}
              color={KAVACHColors.success}
            />
            <ThemedText style={styles.rowText}>
              Align your face inside the frame
            </ThemedText>
          </View>
          <View style={styles.row}>
            <Feather name="sun" size={18} color={KAVACHColors.info} />
            <ThemedText style={styles.rowText}>
              Use bright lighting and keep only one face visible
            </ThemedText>
          </View>
          <View style={styles.row}>
            <Feather name="shield" size={18} color={KAVACHColors.primary} />
            <ThemedText style={styles.rowText}>
              Unlock happens only after backend verification succeeds
            </ThemedText>
          </View>
        </View>

        <Button
          onPress={() => setShowFaceEnrollment(true)}
          disabled={isEnrolling}
          style={styles.button}
        >
          {isEnrolling ? "Enrolling Face..." : "Enroll Face"}
        </Button>

        {isEnrolling ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={KAVACHColors.primary} />
            <ThemedText>Processing face enrollment...</ThemedText>
          </View>
        ) : null}

        {isEnrolled ? (
          <Button
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.secondaryButton}
          >
            Continue
          </Button>
        ) : null}
      </ScreenScrollView>

      <CustomFaceUnlock
        visible={showFaceEnrollment}
        mode="enroll"
        userId={userId}
        onClose={() => {
          setShowFaceEnrollment(false);
          setIsEnrolling(false);
        }}
        onSuccess={handleEnrollmentSuccess}
        onFailure={handleFailure}
        onProcessingChange={setIsEnrolling}
      />

      <FaceAuthSnackbar
        visible={!!snackbarMessage}
        message={snackbarMessage}
        tone={snackbarTone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: `${KAVACHColors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.8,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
  },
  button: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
    marginTop: Spacing.md,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
});
