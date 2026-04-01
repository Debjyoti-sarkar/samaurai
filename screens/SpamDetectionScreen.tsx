import React, { useState } from "react";
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

export default function SpamDetectionScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("sms");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeSMS = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter the message");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      
      const response = await axios.post(
        `${API_URL}/spam/analyze-message`,
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

  const analyzePhone = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter a phone number");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      
      const response = await axios.post(
        `${API_URL}/spam/analyze-phone`,
        { phoneNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(response.data);
    } catch (error) {
      console.error("Analysis error:", error);
      Alert.alert("Error", "Failed to analyze phone number");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case "critical":
        return "#DC2626";
      case "high":
        return "#EA580C";
      case "medium":
        return "#F59E0B";
      default:
        return "#10B981";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield" size={60} color="#6366F1" />
        <Text style={styles.title}>Spam Detection</Text>
        <Text style={styles.subtitle}>
          Detect spam calls and messages
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "sms" && styles.activeTab]}
          onPress={() => {
            setActiveTab("sms");
            setResult(null);
          }}
        >
          <Ionicons
            name="mail"
            size={20}
            color={activeTab === "sms" ? "#6366F1" : "#6B7280"}
          />
          <Text style={[styles.tabText, activeTab === "sms" && styles.activeTabText]}>
            SMS Spam
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "call" && styles.activeTab]}
          onPress={() => {
            setActiveTab("call");
            setResult(null);
          }}
        >
          <Ionicons
            name="call"
            size={20}
            color={activeTab === "call" ? "#6366F1" : "#6B7280"}
          />
          <Text style={[styles.tabText, activeTab === "call" && styles.activeTabText]}>
            Call Spam
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "sms" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sender ID / Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., VM-ICICI, +919876543210"
              value={sender}
              onChangeText={setSender}
            />

            <Text style={styles.label}>Message Content</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste the message here..."
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
            />

            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={analyzeSMS}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#FFF" />
                  <Text style={styles.analyzeButtonText}>Analyze Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number (e.g., 1800123456)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={analyzePhone}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#FFF" />
                  <Text style={styles.analyzeButtonText}>Analyze Number</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {result && (
          <View style={styles.resultContainer}>
            <View
              style={[
                styles.resultCard,
                { borderLeftColor: getRiskColor(result.riskLevel) },
              ]}
            >
              <View style={styles.resultHeader}>
                <View>
                  <Text style={styles.resultTitle}>
                    {result.isSpam ? "⚠️ SPAM DETECTED" : "✅ NOT SPAM"}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    Risk Level: {result.riskLevel.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.scoreText,
                    { color: getRiskColor(result.riskLevel) },
                  ]}
                >
                  {result.spamScore}/100
                </Text>
              </View>

              {result.recommendation && (
                <View style={styles.recommendationBox}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={getRiskColor(result.riskLevel)}
                  />
                  <Text
                    style={[
                      styles.recommendation,
                      { color: getRiskColor(result.riskLevel) },
                    ]}
                  >
                    {result.recommendation}
                  </Text>
                </View>
              )}

              {result.flags && result.flags.length > 0 && (
                <View style={styles.flagsSection}>
                  <Text style={styles.flagsTitle}>Detected Issues:</Text>
                  {result.flags.map((flag, index) => (
                    <View key={index} style={styles.flagItem}>
                      <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                      <Text style={styles.flagText}>{flag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.isTrustedSender && (
                <View style={styles.trustedBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                  <Text style={styles.trustedText}>Trusted Bank Sender</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>🛡️ Spam Protection Tips</Text>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Never share OTP or personal information via SMS or call
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Banks never ask for sensitive information via SMS
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Be cautious of urgent or threatening messages
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Verify links before clicking (hover to see full URL)
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.tipText}>
              Block numbers that repeatedly send spam
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
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
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#6366F1",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#6366F1",
    fontWeight: "600",
  },
  content: {
    flex: 1,
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
    marginTop: 8,
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
  analyzeButton: {
    backgroundColor: "#6366F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  analyzeButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    padding: 16,
  },
  resultCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  resultSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "bold",
  },
  recommendationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  recommendation: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  flagsSection: {
    marginTop: 12,
  },
  flagsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  flagItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  trustedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 12,
  },
  trustedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  tipsContainer: {
    backgroundColor: "#FFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
});
