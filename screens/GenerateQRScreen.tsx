import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

export default function GenerateQRScreen({ navigation }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserInfo(response.data);
    } catch (error) {
      console.error("Fetch user error:", error);
      Alert.alert("Error", "Failed to fetch user information");
    } finally {
      setLoadingUser(false);
    }
  };

  const generateQR = async () => {
    if (!userInfo?.upiId) {
      Alert.alert("Error", "Please set up your UPI ID first");
      navigation.navigate("ProfileSettings");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");

      const payload = {
        amount: amount ? parseFloat(amount) : undefined,
        note: note || undefined,
      };

      const response = await axios.post(
        `${API_URL}/qr/generate`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setQrCode(response.data.qrCode);
      } else {
        Alert.alert("Error", "Failed to generate QR code");
      }
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

  if (!userInfo?.upiId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={64} color="#F59E0B" />
          <Text style={styles.emptyTitle}>UPI ID Not Set</Text>
          <Text style={styles.emptyText}>
            Please set up your UPI ID before generating QR codes
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("ProfileSettings")}
          >
            <Text style={styles.buttonText}>Set Up UPI ID</Text>
          </TouchableOpacity>
        </View>
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
                <Text style={styles.qrInfoValue}>{userInfo.upiId}</Text>
              </View>

              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>Name</Text>
                <Text style={styles.qrInfoValue}>{userInfo.name}</Text>
              </View>

              {amount && (
                <View style={styles.qrInfoRow}>
                  <Text style={styles.qrInfoLabel}>Amount</Text>
                  <Text style={styles.qrInfoValue}>₹{parseFloat(amount).toLocaleString()}</Text>
                </View>
              )}

              {note && (
                <View style={styles.qrInfoRow}>
                  <Text style={styles.qrInfoLabel}>Note</Text>
                  <Text style={styles.qrInfoValue}>{note}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={resetQR}>
            <Ionicons name="refresh" size={20} color="#6366F1" />
            <Text style={styles.resetButtonText}>Generate New QR</Text>
          </TouchableOpacity>

          <View style={styles.instructionsBox}>
            <Ionicons name="information-circle" size={24} color="#6366F1" />
            <Text style={styles.instructionsText}>
              Show this QR code to receive payments. Anyone can scan this code to
              pay you {amount ? `₹${amount}` : "any amount"}.
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
            <Text style={styles.userName}>{userInfo.name}</Text>
            <Text style={styles.userUPI}>{userInfo.upiId}</Text>
          </View>
        </View>
      </View>

      <View style={styles.form}>
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
              UPI standard QR codes with encrypted payment information
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Ionicons name="settings" size={24} color="#F59E0B" />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Flexible</Text>
            <Text style={styles.featureText}>
              Generate QR with or without amount, add custom notes
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
