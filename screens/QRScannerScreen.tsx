import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Platform, Linking, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

export default function QRScannerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const scanLinePosition = useSharedValue(0);

  useEffect(() => {
    scanLinePosition.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value * 200 }],
  }));

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    
    const { data, type } = result;
    console.log("📷 QR Scanned - Type:", type, "Data:", data);
    
    setScanned(true);

    // Parse UPI QR code
    // Format: upi://pay?pa=upiid@bank&pn=Name&am=100&cu=INR
    const upiMatch = data.match(/pa=([^&]+)/);
    const amountMatch = data.match(/am=([^&]+)/);
    const nameMatch = data.match(/pn=([^&]+)/);

    const recipient = upiMatch ? decodeURIComponent(upiMatch[1]) : data;
    const amount = amountMatch ? decodeURIComponent(amountMatch[1]) : undefined;

    console.log("📤 Navigating to SendMoney with:", { recipient, amount });

    // Small delay to show the scanned feedback
    setTimeout(() => {
      navigation.navigate("SendMoney", {
        recipient: recipient,
        amount: amount,
      });
    }, 300);
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading camera...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.backgroundRoot,
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.permissionContainer}>
            <View style={[styles.iconCircle, { backgroundColor: KAVACHColors.warning + "20" }]}>
              <Feather name="camera-off" size={48} color={KAVACHColors.warning} />
            </View>
            <ThemedText type="h3" style={styles.permissionTitle}>
              Camera Access Required
            </ThemedText>
            <ThemedText type="small" style={[styles.permissionText, { color: theme.textSecondary }]}>
              Please enable camera access in your device settings to scan QR codes for payments.
            </ThemedText>
            {Platform.OS !== "web" ? (
              <Button
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.log("Cannot open settings");
                  }
                }}
                style={{ backgroundColor: KAVACHColors.primary, marginTop: Spacing.xl }}
              >
                Open Settings
              </Button>
            ) : null}
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Go Back</ThemedText>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.permissionContainer}>
          <View style={[styles.iconCircle, { backgroundColor: KAVACHColors.primary + "20" }]}>
            <Feather name="camera" size={48} color={KAVACHColors.primary} />
          </View>
          <ThemedText type="h3" style={styles.permissionTitle}>
            Camera Permission
          </ThemedText>
          <ThemedText type="small" style={[styles.permissionText, { color: theme.textSecondary }]}>
            KAVACH needs camera access to scan QR codes for secure payments.
          </ThemedText>
          <Button
            onPress={requestPermission}
            style={{ backgroundColor: KAVACHColors.primary, marginTop: Spacing.xl }}
          >
            Enable Camera
          </Button>
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.permissionContainer}>
          <View style={[styles.iconCircle, { backgroundColor: KAVACHColors.info + "20" }]}>
            <Feather name="smartphone" size={48} color={KAVACHColors.info} />
          </View>
          <ThemedText type="h3" style={styles.permissionTitle}>
            Use Expo Go
          </ThemedText>
          <ThemedText type="small" style={[styles.permissionText, { color: theme.textSecondary }]}>
            Run in Expo Go to use the QR scanner feature. The camera is not available on web.
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("SendMoney")}
            style={[styles.manualButton, { borderColor: KAVACHColors.primary }]}
          >
            <Feather name="edit-3" size={20} color={KAVACHColors.primary} />
            <ThemedText style={{ color: KAVACHColors.primary, marginLeft: Spacing.sm }}>
              {t("manualEntry")}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      <View style={styles.overlay}>
        <View style={[styles.overlayTop, { paddingTop: insets.top + 60 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.scannerContainer}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <Animated.View style={[styles.scanLine, scanLineStyle]} />
          </View>
        </View>

        <View style={styles.overlayBottom}>
          <ThemedText style={styles.scanText}>
            {scanned ? "✅ QR Code Scanned!" : t("scanQrCode")}
          </ThemedText>
          <ThemedText style={styles.scanSubtext}>
            {scanned ? "Redirecting to payment..." : "Point your camera at a UPI QR code"}
          </ThemedText>

          {scanned ? (
            <Pressable
              onPress={() => setScanned(false)}
              style={[styles.manualButton, { borderColor: "#FFFFFF", marginBottom: Spacing.md }]}
            >
              <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                Scan Again
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate("SendMoney")}
            style={[styles.manualButton, { borderColor: "#FFFFFF" }]}
          >
            <Feather name="edit-3" size={20} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
              {t("manualEntry")}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  permissionText: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  overlayTop: {
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#FFFFFF",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: KAVACHColors.primary,
    top: 25,
  },
  overlayBottom: {
    alignItems: "center",
    paddingBottom: 100,
    paddingHorizontal: Spacing.xl,
  },
  scanText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  scanSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
