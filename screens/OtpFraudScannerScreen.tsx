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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

export default function OtpFraudScannerScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeOTP = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter the OTP message");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      
      const response = await axios.post(
        `${API_URL}/ml/analyze-otp`,
        { message, sender },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(response.data);
    } catch (error) {
      console.error("Analysis error:", error);
      Alert.alert("Error", "Failed to analyze message");
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithSpamDetection = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter the message");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      
      const response = await axios.post(
        `${API_URL}/spam/check-otp-legitimacy`,
        { message, sender },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(response.data);
    } catch (error) {
      console.error("Analysis error:", error);
      Alert.alert("Error", "Failed to analyze message");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score >= 70) return "#DC2626";
    if (score >= 50) return "#EA580C";
    if (score >= 30) return "#F59E0B";
    return "#10B981";
  };

  const getRiskText = (score) => {
    if (score >= 70) return "CRITICAL RISK";
    if (score >= 50) return "HIGH RISK";
    if (score >= 30) return "MEDIUM RISK";
    return "LOW RISK";
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={60} color="#6366F1" />
        <Text style={styles.title}>OTP Fraud Scanner</Text>
        <Text style={styles.subtitle}>
          Powered by ML - Detect fraudulent OTP messages
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Sender / Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., SBIINB, +919876543210"
          value={sender}
          onChangeText={setSender}
        />

        <Text style={styles.label}>Message Content</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Paste the OTP message here..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={analyzeOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="analytics" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Analyze with ML</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={analyzeWithSpamDetection}
            disabled={loading}
          >
            <Ionicons name="bug" size={20} color="#6366F1" />
            <Text style={styles.secondaryButtonText}>Spam Check</Text>
          </TouchableOpacity>
        </View>
      </View>

      {result && (
        <View style={styles.resultContainer}>
          <View
            style={[
              styles.scoreCard,
              { borderLeftColor: getRiskColor(result.fraudScore) },
            ]}
          >
            <Text style={styles.scoreLabel}>Fraud Score</Text>
            <Text
              style={[styles.scoreValue, { color: getRiskColor(result.fraudScore) }]}
            >
              {result.fraudScore}/100
            </Text>
            <Text style={[styles.riskText, { color: getRiskColor(result.fraudScore) }]}>
              {getRiskText(result.fraudScore)}
            </Text>
          </View>

          {result.otp && (
            <View style={styles.infoCard}>
              <Ionicons name="key" size={24} color="#6366F1" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Detected OTP</Text>
                <Text style={styles.infoValue}>{result.otp}</Text>
              </View>
            </View>
          )}

          {result.hasTrustedSender !== undefined && (
            <View style={styles.infoCard}>
              <Ionicons
                name={result.hasTrustedSender ? "shield-checkmark" : "warning"}
                size={24}
                color={result.hasTrustedSender ? "#10B981" : "#F59E0B"}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Sender Status</Text>
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: result.hasTrustedSender ? "#10B981" : "#F59E0B",
                    },
                  ]}
                >
                  {result.hasTrustedSender ? "Trusted Sender" : "Unknown Sender"}
                </Text>
              </View>
            </View>
          )}

          {result.recommendation && (
            <View
              style={[
                styles.recommendationCard,
                {
                  backgroundColor:
                    result.fraudScore >= 60 ? "#FEE2E2" : "#DBEAFE",
                },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={24}
                color={result.fraudScore >= 60 ? "#DC2626" : "#2563EB"}
              />
              <Text
                style={[
                  styles.recommendation,
                  {
                    color: result.fraudScore >= 60 ? "#DC2626" : "#2563EB",
                  },
                ]}
              >
                {result.recommendation}
              </Text>
            </View>
          )}

          {result.flags && result.flags.length > 0 && (
            <View style={styles.flagsContainer}>
              <Text style={styles.flagsTitle}>Detected Issues:</Text>
              {result.flags.map((flag, index) => (
                <View key={index} style={styles.flagItem}>
                  <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>🛡️ Safety Tips</Text>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Never share OTPs with anyone, even bank officials
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Banks never ask for OTP via call or SMS
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Verify sender before entering OTP
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>
            Be cautious of urgent or threatening messages
          </Text>
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
  header: {
    backgroundColor: "#FFF",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  inputContainer: {
    backgroundColor: "#FFF",
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#FFF",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#6366F1",
  },
  secondaryButton: {
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    padding: 16,
    gap: 12,
  },
  scoreCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    borderLeftWidth: 4,
  },
  scoreLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "bold",
  },
  riskText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  recommendationCard: {
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recommendation: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  flagsContainer: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
  },
  flagsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  flagItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  tipsContainer: {
    backgroundColor: "#FFF",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "bold",
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
});
