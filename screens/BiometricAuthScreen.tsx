import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

export default function BiometricAuthScreen({ navigation, route }) {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState(null);

  useEffect(() => {
    checkBiometricSupport();
    fetchBiometricStatus();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setHasHardware(compatible);

      if (compatible) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsEnrolled(enrolled);

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("Face ID");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("Fingerprint");
        } else {
          setBiometricType("Biometric");
        }
      }
    } catch (error) {
      console.error("Biometric check error:", error);
    }
  };

  const fetchBiometricStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBiometricEnabled(response.data.biometricEnabled || false);
    } catch (error) {
      console.error("Fetch biometric status error:", error);
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to enable biometric login",
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error("Authentication error:", error);
      return false;
    }
  };

  const toggleBiometric = async () => {
    if (!biometricEnabled) {
      // Enabling biometric
      const authenticated = await authenticateWithBiometric();

      if (!authenticated) {
        Alert.alert("Authentication Failed", "Could not verify your identity");
        return;
      }
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      
      const response = await axios.put(
        `${API_URL}/user/biometric`,
        { enabled: !biometricEnabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBiometricEnabled(response.data.biometricEnabled);

      Alert.alert(
        "Success",
        `Biometric authentication ${response.data.biometricEnabled ? "enabled" : "disabled"}`
      );
    } catch (error) {
      console.error("Toggle biometric error:", error);
      Alert.alert("Error", "Failed to update biometric settings");
    } finally {
      setLoading(false);
    }
  };

  const testBiometric = async () => {
    const result = await authenticateWithBiometric();

    if (result) {
      Alert.alert("Success", "Biometric authentication successful!");
    } else {
      Alert.alert("Failed", "Biometric authentication failed");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!hasHardware) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Biometric Not Available</Text>
          <Text style={styles.errorText}>
            Your device doesn't support biometric authentication
          </Text>
        </View>
      </View>
    );
  }

  if (!isEnrolled) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="finger-print" size={64} color="#F59E0B" />
          <Text style={styles.errorTitle}>No Biometric Enrolled</Text>
          <Text style={styles.errorText}>
            Please set up biometric authentication in your device settings first
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => Alert.alert("Info", "Go to Settings > Security to set up biometric authentication")}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name={biometricType === "Face ID" ? "scan" : "finger-print"}
          size={80}
          color="#6366F1"
        />
        <Text style={styles.title}>Biometric Authentication</Text>
        <Text style={styles.subtitle}>
          Secure your account with {biometricType}
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Biometric Login</Text>
            <Text style={styles.statusSubtitle}>
              Use {biometricType} to sign in
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: biometricEnabled ? "#10B981" : "#6B7280" },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {biometricEnabled ? "Enabled" : "Disabled"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            biometricEnabled && styles.toggleButtonActive,
          ]}
          onPress={toggleBiometric}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons
                name={biometricEnabled ? "lock-closed" : "lock-open"}
                size={20}
                color="#FFF"
              />
              <Text style={styles.toggleButtonText}>
                {biometricEnabled ? "Disable" : "Enable"} Biometric
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {biometricEnabled && (
        <TouchableOpacity style={styles.testCard} onPress={testBiometric}>
          <Ionicons name="flash" size={32} color="#6366F1" />
          <View style={styles.testInfo}>
            <Text style={styles.testTitle}>Test Biometric</Text>
            <Text style={styles.testSubtitle}>
              Verify your biometric authentication
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>How it works</Text>

        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark" size={24} color="#6366F1" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Secure Login</Text>
            <Text style={styles.infoItemText}>
              Use your fingerprint or face to sign in instantly
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="flash" size={24} color="#10B981" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Quick Access</Text>
            <Text style={styles.infoItemText}>
              No need to remember or enter your PIN every time
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="lock-closed" size={24} color="#EF4444" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Extra Security</Text>
            <Text style={styles.infoItemText}>
              Your biometric data never leaves your device
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.warningContainer}>
        <Ionicons name="information-circle" size={24} color="#F59E0B" />
        <Text style={styles.warningText}>
          You can always use your PIN if biometric authentication fails
        </Text>
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
  statusCard: {
    backgroundColor: "#FFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  toggleButton: {
    backgroundColor: "#6366F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: "#EF4444",
  },
  toggleButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  testCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testInfo: {
    flex: 1,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  testSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  infoContainer: {
    backgroundColor: "#FFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  infoItemText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    textAlign: "center",
  },
  errorText: {
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
