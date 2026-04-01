import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const USER_KEY = "@kavach_user";

type LocalUserInfo = {
  phoneNumber?: string;
  bankName?: string;
  bankAccountMasked?: string;
  upiId?: string;
  name?: string;
};

function buildQrImageUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
}

function buildUpiPayload({
  upiId,
  name,
  amount,
  note,
}: {
  upiId: string;
  name: string;
  amount?: string;
  note?: string;
}) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    cu: "INR",
  });

  if (amount?.trim()) {
    params.set("am", String(Number(amount)));
  }

  if (note?.trim()) {
    params.set("tn", note.trim());
  }

  return `upi://pay?${params.toString()}`;
}

function isValidUpiId(upiId: string) {
  return /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i.test(upiId.trim());
}

export default function GenerateQRScreen() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [upiId, setUpiId] = useState("");
  const [userInfo, setUserInfo] = useState<LocalUserInfo | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingUpi, setSavingUpi] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const rawUser = await AsyncStorage.getItem(USER_KEY);
      const parsedUser = rawUser ? (JSON.parse(rawUser) as LocalUserInfo) : {};
      const normalizedUser = {
        ...parsedUser,
        name: parsedUser?.name || "KAVACH User",
      };
      setUserInfo(normalizedUser);
      setUpiId(normalizedUser.upiId || "");
    } catch (error) {
      console.error("Fetch user error:", error);
      Alert.alert("Error", "Failed to fetch user information");
    } finally {
      setLoadingUser(false);
    }
  };

  const saveUpiId = async () => {
    const trimmedUpi = upiId.trim().toLowerCase();

    if (!trimmedUpi) {
      Alert.alert("Missing UPI ID", "Please enter your UPI ID");
      return false;
    }

    if (!isValidUpiId(trimmedUpi)) {
      Alert.alert("Invalid UPI ID", "Enter a valid UPI ID like name@bank");
      return false;
    }

    setSavingUpi(true);
    try {
      const updatedUser: LocalUserInfo = {
        ...(userInfo || {}),
        upiId: trimmedUpi,
        name: userInfo?.name || "KAVACH User",
      };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUserInfo(updatedUser);
      setUpiId(trimmedUpi);
      Alert.alert("Success", "UPI ID saved successfully");
      return true;
    } catch (error) {
      console.error("Save UPI ID error:", error);
      Alert.alert("Error", "Failed to save UPI ID");
      return false;
    } finally {
      setSavingUpi(false);
    }
  };

  const effectiveUpiId = useMemo(
    () => (userInfo?.upiId || upiId).trim().toLowerCase(),
    [upiId, userInfo?.upiId],
  );

  const generateQR = async () => {
    if (!effectiveUpiId) {
      Alert.alert("Error", "Please set up your UPI ID first");
      return;
    }

    if (!isValidUpiId(effectiveUpiId)) {
      Alert.alert("Invalid UPI ID", "Enter a valid UPI ID like name@bank");
      return;
    }

    if (
      upiId.trim() &&
      upiId.trim().toLowerCase() !== (userInfo?.upiId || "").toLowerCase()
    ) {
      const saved = await saveUpiId();
      if (!saved) return;
    }

    setLoading(true);
    try {
      const upiPayload = buildUpiPayload({
        upiId: effectiveUpiId,
        name: userInfo?.name || "KAVACH User",
        amount,
        note,
      });

      setQrCode(buildQrImageUrl(upiPayload));
    } catch (error) {
      console.error("QR generation error:", error);
      Alert.alert("Error", "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const resetQR = () => {
    setQrCode(null);
    setAmount("");
    setNote("");
  };

  if (loadingUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (qrCode) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>Your Payment QR Code</Text>

          <View style={styles.qrCard}>
            <Image
              source={{ uri: qrCode }}
              style={styles.qrImage}
              resizeMode="contain"
            />

            <View style={styles.qrInfo}>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>UPI ID</Text>
                <Text style={styles.qrInfoValue}>{effectiveUpiId}</Text>
              </View>

              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>Name</Text>
                <Text style={styles.qrInfoValue}>
                  {userInfo?.name || "KAVACH User"}
                </Text>
              </View>

              {amount ? (
                <View style={styles.qrInfoRow}>
                  <Text style={styles.qrInfoLabel}>Amount</Text>
                  <Text style={styles.qrInfoValue}>
                    Rs {parseFloat(amount).toLocaleString("en-IN")}
                  </Text>
                </View>
              ) : null}

              {note ? (
                <View style={styles.qrInfoRow}>
                  <Text style={styles.qrInfoLabel}>Note</Text>
                  <Text style={styles.qrInfoValue}>{note}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={resetQR}>
            <Ionicons name="refresh" size={20} color="#6366F1" />
            <Text style={styles.resetButtonText}>Generate New QR</Text>
          </TouchableOpacity>

          <View style={styles.instructionsBox}>
            <Ionicons name="information-circle" size={24} color="#6366F1" />
            <Text style={styles.instructionsText}>
              Show this QR code to receive payments. Anyone can scan it to pay
              you {amount ? `Rs ${amount}` : "any amount"}.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="qr-code" size={64} color="#6366F1" />
        <Text style={styles.title}>Generate QR Code</Text>
        <Text style={styles.subtitle}>
          Create a QR code to receive payments
        </Text>
      </View>

      <View style={styles.userInfoCard}>
        <View style={styles.userHeader}>
          <Ionicons name="person-circle" size={48} color="#6366F1" />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {userInfo?.name || "KAVACH User"}
            </Text>
            <Text style={styles.userUPI}>
              {effectiveUpiId || "Set your UPI ID below"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Your UPI ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your UPI ID (e.g. omkar@oksbi)"
          value={upiId}
          onChangeText={setUpiId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.saveButton, savingUpi && styles.saveButtonDisabled]}
          onPress={saveUpiId}
          disabled={savingUpi}
        >
          {savingUpi ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Save UPI ID</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Amount (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter amount to receive"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <Text style={styles.helper}>
          Leave empty if you want the payer to enter the amount
        </Text>

        <Text style={styles.label}>Note (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add a note (e.g., Payment for...)"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={styles.generateButton}
          onPress={generateQR}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="create" size={24} color="#FFF" />
              <Text style={styles.generateButtonText}>Generate QR Code</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Features</Text>

        <View style={styles.feature}>
          <Ionicons name="flash" size={24} color="#10B981" />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Instant Payments</Text>
            <Text style={styles.featureText}>
              Receive payments instantly when someone scans your QR code
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Ionicons name="lock-closed" size={24} color="#6366F1" />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Secure</Text>
            <Text style={styles.featureText}>
              Standard UPI payment payload encoded in a QR code
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Ionicons name="settings" size={24} color="#F59E0B" />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Flexible</Text>
            <Text style={styles.featureText}>
              Generate QR with or without amount and add custom notes
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    backgroundColor: "#FFF",
    padding: 32,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  userInfoCard: {
    backgroundColor: "#FFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  userUPI: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  helper: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  generateButton: {
    backgroundColor: "#6366F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  generateButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  qrContainer: {
    padding: 16,
  },
  qrTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 24,
  },
  qrCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrImage: {
    width: 300,
    height: 300,
    marginBottom: 24,
  },
  qrInfo: {
    width: "100%",
    gap: 12,
  },
  qrInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  qrInfoLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  qrInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1,
    textAlign: "right",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#6366F1",
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  resetButtonText: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "600",
  },
  instructionsBox: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: "#4338CA",
    lineHeight: 20,
  },
  featuresContainer: {
    backgroundColor: "#FFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
