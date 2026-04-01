import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

export default function LoanDashboardScreen({ navigation }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchLoans();
  }, [activeTab]);

  const fetchLoans = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const params = activeTab !== "all" ? `?status=${activeTab}` : "";
      
      const response = await axios.get(`${API_URL}/loans${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setLoans(response.data);
    } catch (error) {
      console.error("Fetch loans error:", error);
      Alert.alert("Error", "Failed to fetch loans");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLoans();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
      case "active":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "rejected":
      case "defaulted":
        return "#EF4444";
      case "completed":
        return "#6366F1";
      default:
        return "#6B7280";
    }
  };

  const getLoanTypeIcon = (type) => {
    switch (type) {
      case "personal":
        return "person";
      case "business":
        return "briefcase";
      case "education":
        return "school";
      case "home":
        return "home";
      case "vehicle":
        return "car";
      default:
        return "cash";
    }
  };

  const renderLoanCard = (loan) => (
    <TouchableOpacity
      key={loan._id}
      style={styles.loanCard}
      onPress={() => navigation.navigate("LoanDetails", { loanId: loan._id })}
    >
      <View style={styles.loanHeader}>
        <View style={styles.loanTypeContainer}>
          <Ionicons
            name={getLoanTypeIcon(loan.loanType)}
            size={24}
            color="#6366F1"
          />
          <View style={styles.loanInfo}>
            <Text style={styles.loanType}>
              {loan.loanType.charAt(0).toUpperCase() + loan.loanType.slice(1)} Loan
            </Text>
            <Text style={styles.loanDate}>
              Applied: {new Date(loan.applicationDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(loan.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {loan.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.loanDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Principal Amount</Text>
          <Text style={styles.detailValue}>₹{loan.principalAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Monthly EMI</Text>
          <Text style={styles.detailValue}>₹{loan.emiAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tenure</Text>
          <Text style={styles.detailValue}>{loan.tenureMonths} months</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Interest Rate</Text>
          <Text style={styles.detailValue}>{loan.interestRate}% p.a.</Text>
        </View>
      </View>

      {loan.status === "active" && (
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Remaining</Text>
            <Text style={styles.progressValue}>
              ₹{loan.remainingAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((loan.totalAmount - loan.remainingAmount) /
                      loan.totalAmount) *
                    100
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressPercent}>
            {Math.round(
              ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100
            )}
            % Paid
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Loans</Text>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => navigation.navigate("LoanApplication")}
        >
          <Ionicons name="add-circle" size={24} color="#FFF" />
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {["all", "pending", "active", "completed"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.activeTabText]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : loans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>No loans found</Text>
          <Text style={styles.emptySubtext}>
            Apply for a loan to get started
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate("LoanApplication")}
          >
            <Text style={styles.emptyButtonText}>Apply for Loan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loans.map(renderLoanCard)}
          <View style={styles.spacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  applyButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
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
  scrollView: {
    flex: 1,
  },
  loanCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  loanTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  loanInfo: {
    flex: 1,
  },
  loanType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  loanDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  loanDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  progressContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  progressPercent: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "right",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  spacer: {
    height: 24,
  },
});
