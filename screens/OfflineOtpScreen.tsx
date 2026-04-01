import { Camera, CameraView } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function parseQuery(uri: string) {
  const qIndex = uri.indexOf("?");
  if (qIndex === -1) return {};
  const q = uri.slice(qIndex + 1);
  const parts = q.split("&");
  const out: Record<string, string> = {};
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function buildUpiUri(
  fields: Record<string, string>,
  amount?: string,
  note?: string
) {
  const params = { ...fields };
  if (amount) params.am = amount;
  if (note) params.tn = note;
  params.cu = params.cu || "INR";

  const encoded = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return `upi://pay?${encoded}`;
}

export default function OfflineOtpScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [scannedFields, setScannedFields] = useState<Record<string, string> | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [enableTorch, setEnableTorch] = useState(false);
  const navigation = useNavigation();


  useEffect(() => {
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      } catch (e) {
        console.error("Camera permission error", e);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onBarCodeScanned = (payload: { type: string; data: string }) => {
    if (!scanningEnabled) return;
    setScanningEnabled(false);

    const { data } = payload;
    setScannedData(data);

    if (data && data.startsWith("upi://")) {
      const fields = parseQuery(data);
      setScannedFields(fields);
      setShowPaymentModal(true);
    } else {
      Alert.alert("Scanned", data, [
        { text: "OK", onPress: () => setScanningEnabled(true) },
      ]);
    }
  };

  async function onPayConfirm() {
    if (!scannedFields) return;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert(
        "Invalid amount",
        "Enter a valid numeric amount greater than zero."
      );
      return;
    }

    const uri = buildUpiUri(scannedFields, amount, note);

    try {
      const canOpen = await Linking.canOpenURL(uri);
      if (!canOpen) {
        Alert.alert(
          "No UPI app",
          "No UPI app found that can handle the payment link on this device."
        );
        return;
      }

      await Linking.openURL(uri);

      setShowPaymentModal(false);
      setAmount("");
      setNote("");
      setScannedFields(null);
      setScannedData(null);
      setScanningEnabled(true);
    } catch (err) {
      console.error("Open UPI error", err);
      Alert.alert("Error", "Unable to open UPI app. " + String(err));
      setScanningEnabled(true);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>
          No access to camera. Grant camera permission in settings.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            Camera.requestCameraPermissionsAsync().then((r) =>
              setHasPermission(r.status === "granted")
            )
          }
        >
          <Text style={styles.buttonText}>Try Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={enableTorch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanningEnabled ? onBarCodeScanned : undefined}
        />

        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.scanBox} />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setScanningEnabled(true);
            setScannedData(null);
            setScannedFields(null);
          }}
        >
          <Text style={styles.buttonText}>Scan</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.iconButton]}
            onPress={() => setEnableTorch((prev) => !prev)}
          >
            <Text style={styles.iconText}>
              {enableTorch ? "Torch ON" : "Torch OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton]}
            onPress={() =>
              setFacing((prev) => (prev === "back" ? "front" : "back"))
            }
          >
            <Text style={styles.iconText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.iconText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalInner}>
            <Text style={styles.modalTitle}>
              Pay {scannedFields?.pn ? `to ${scannedFields.pn}` : "Recipient"}
            </Text>

            <Text style={styles.label}>UPI ID</Text>
            <Text style={styles.value}>{scannedFields?.pa || scannedData}</Text>

            <Text style={styles.label}>Enter amount (INR)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 250.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="For what?"
              value={note}
              onChangeText={setNote}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: "#ccc", paddingHorizontal: 14 },
                ]}
                onPress={() => {
                  setShowPaymentModal(false);
                  setScanningEnabled(true);
                }}
              >
                <Text style={[styles.buttonText, { color: "#000" }]}> 
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={onPayConfirm}>
                <Text style={styles.buttonText}>Pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraContainer: { flex: 1, overflow: "hidden" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanBox: {
    width: 260,
    height: 260,
    borderColor: "#fff",
    borderWidth: 2,
    borderRadius: 8,
    opacity: 0.95,
  },
  controls: {
    padding: 16,
    backgroundColor: "#0e0e0e",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#1e90ff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  text: { color: "#fff", textAlign: "center", marginBottom: 12 },
  textSmall: { color: "#bbb", marginTop: 6 },
  row: { flexDirection: "row", marginTop: 12, gap: 10 },
  iconButton: {
    backgroundColor: "#222",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  iconText: { color: "#fff", fontWeight: "600" },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalInner: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { color: "#444", marginTop: 8 },
  value: { fontSize: 14, color: "#111", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
});
