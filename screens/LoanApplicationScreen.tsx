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

const loanTypes = [
  { value: "personal", label: "Personal Loan", icon: "person" },
  { value: "business", label: "Business Loan", icon: "briefcase" },
  { value: "education", label: "Education Loan", icon: "school" },
  { value: "home", label: "Home Loan", icon: "home" },
  { value: "vehicle", label: "Vehicle Loan", icon: "car" },
];

export default function LoanApplicationScreen({ navigation }) {
  const [loanType, setLoanType] = useState("personal");
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("12");
  const [interestRate, setInterestRate] = useState("12");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [emiPreview, setEmiPreview] = useState(null);

  const calculateEMI = () => {
    if (!amount || !tenure || !interestRate) return;

    const principal = parseFloat(amount);
    const rate = parseFloat(interestRate) / 12 / 100;
    const months = parseInt(tenure);

    if (rate === 0) {
      setEmiPreview({
        emi: (principal / months).toFixed(2),
        totalPayment: principal.toFixed(2),
        totalInterest: "0.00",
      });
      return;
    }

    const emi =
      (principal * rate * Math.pow(1 + rate, months)) /
      (Math.pow(1 + rate, months) - 1);

    const totalPayment = emi * months;
    const totalInterest = totalPayment - principal;

    setEmiPreview({
      emi: emi.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
    });
  };

  React.useEffect(() => {
    calculateEMI();
  }, [amount, tenure, interestRate]);

  const submitApplication = async () => {
    if (!amount || !tenure || !purpose) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const principal = parseFloat(amount);
    if (principal < 10000) {
      Alert.alert("Error", "Minimum loan amount is ₹10,000");
      return;
    }
    if (principal > 10000000) {
      Alert.alert("Error", "Maximum loan amount is ₹1,00,00,000");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");

      const response = await axios.post(
        `${API_URL}/loans/apply`,
        {
          loanType,
          principalAmount: principal,
          interestRate: parseFloat(interestRate),
          tenureMonths: parseInt(tenure),
          purpose,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        "Success",
        "Loan application submitted successfully!",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Loan application error:", error);
      Alert.alert("Error", error.response?.data?.msg || "Failed to submit loan application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={48} color="#6366F1" />
        <Text style={styles.title}>Apply for Loan</Text>
        <Text style={styles.subtitle}>
          Fill in the details to apply for a loan
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Loan Type</Text>
        <View style={styles.loanTypeContainer}>
          {loanTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.loanTypeCard,
                loanType === type.value && styles.loanTypeCardActive,
              ]}
              onPress={() => setLoanType(type.value)}
            >
              <Ionicons
                name={type.icon}
                size={32}
                color={loanType === type.value ? "#6366F1" : "#6B7280"}
              />
              <Text
                style={[
                  styles.loanTypeLabel,
                  loanType === type.value && styles.loanTypeLabelActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Loan Amount (₹) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter loan amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Tenure (Months) *</Text>
        <View style={styles.tenureContainer}>
          {["12", "24", "36", "48", "60"].map((months) => (
            <TouchableOpacity
              key={months}
              style={[
                styles.tenureButton,
                tenure === months && styles.tenureButtonActive,
              ]}
              onPress={() => setTenure(months)}
            >
              <Text
                style={[
                  styles.tenureText,
                  tenure === months && styles.tenureTextActive,
                ]}
              >
                {months}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Interest Rate (% per annum)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter interest rate"
          value={interestRate}
          onChangeText={setInterestRate}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Purpose *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the purpose of the loan"
          value={purpose}
          onChangeText={setPurpose}
          multiline
          numberOfLines={4}
        />

        {emiPreview && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>EMI Calculator</Text>
            
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Monthly EMI</Text>
              <Text style={styles.previewValue}>₹{parseFloat(emiPreview.emi).toLocaleString()}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Total Payment</Text>
              <Text style={styles.previewValue}>
                ₹{parseFloat(emiPreview.totalPayment).toLocaleString()}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Total Interest</Text>
              <Text style={styles.previewValue}>
                ₹{parseFloat(emiPreview.totalInterest).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.submitButton}
          onPress={submitApplication}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  loanTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  loanTypeCard: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  loanTypeCardActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  loanTypeLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  loanTypeLabelActive: {
    color: "#6366F1",
    fontWeight: "600",
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
    color: "#111827",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  tenureContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tenureButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    alignItems: "center",
  },
  tenureButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  tenureText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  tenureTextActive: {
    color: "#FFF",
  },
  previewContainer: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  previewLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  previewValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  submitButton: {
    backgroundColor: "#6366F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 32,
    gap: 8,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
