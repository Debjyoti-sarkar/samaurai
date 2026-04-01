import React from "react";
import { View, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";

export default function TermsPrivacyScreen() {
  const { theme } = useTheme();

  const sections = [
    {
      title: "1. Terms of Service",
      content: `By using KAVACH, you agree to these terms. KAVACH is a digital payment platform that enables secure money transfers, bill payments, and financial management.

Key Terms:
• You must be 18+ years old to use this service
• You are responsible for maintaining the confidentiality of your PIN and account
• All transactions are final once confirmed
• We reserve the right to suspend accounts for suspicious activity`
    },
    {
      title: "2. Privacy Policy",
      content: `We take your privacy seriously. Here's how we handle your data:

Data Collection:
• Personal information (name, phone, email)
• Transaction history
• Device information for security
• Location data (only when you permit)

Data Usage:
• Processing your transactions
• Fraud prevention
• Customer support
• Service improvement`
    },
    {
      title: "3. Security",
      content: `Your security is our priority:

• End-to-end encryption for all transactions
• Biometric authentication support
• Real-time fraud monitoring
• Secure data centers with bank-grade security
• Regular security audits

We will never ask for your PIN via call, SMS, or email.`
    },
    {
      title: "4. User Responsibilities",
      content: `As a user, you agree to:

• Keep your login credentials secure
• Report unauthorized transactions within 24 hours
• Not use the service for illegal activities
• Provide accurate information
• Comply with RBI and other regulatory guidelines`
    },
    {
      title: "5. Transaction Limits",
      content: `Standard limits apply:

• Per transaction: ₹1,00,000
• Daily limit: ₹2,00,000
• Monthly limit: ₹10,00,000

Higher limits available after Aadhaar verification. Limits may vary based on your bank's policies.`
    },
    {
      title: "6. Refunds & Disputes",
      content: `For transaction issues:

• Failed transactions are auto-refunded within 5-7 business days
• For disputes, contact support within 7 days
• Provide transaction ID and details
• Resolution typically within 10 business days

We investigate all disputes thoroughly and fairly.`
    },
    {
      title: "7. Account Termination",
      content: `We may suspend or terminate accounts for:

• Violation of terms
• Suspected fraud
• Legal requirements
• Extended inactivity (12+ months)

You can close your account anytime by contacting support.`
    },
    {
      title: "8. Changes to Terms",
      content: `We may update these terms periodically. We will notify you of significant changes via:

• In-app notifications
• Email to your registered address
• SMS alerts

Continued use after changes constitutes acceptance.`
    },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          <Feather name="file-text" size={32} color={KAVACHColors.primary} />
        </View>
        <ThemedText type="h3" style={styles.title}>Terms & Privacy</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Last updated: December 2025
        </ThemedText>
      </View>

      {sections.map((section, index) => (
        <View key={index} style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>{section.title}</ThemedText>
          <ThemedText style={[styles.sectionContent, { color: theme.textSecondary }]}>
            {section.content}
          </ThemedText>
        </View>
      ))}

      {/* Contact for Questions */}
      <View style={[styles.contactCard, { backgroundColor: KAVACHColors.info + "10" }]}>
        <Feather name="help-circle" size={24} color={KAVACHColors.info} />
        <View style={styles.contactText}>
          <ThemedText style={{ fontWeight: "500" }}>Questions about these terms?</ThemedText>
          <Pressable onPress={() => Linking.openURL("mailto:legal@kavach.com")}>
            <ThemedText style={{ color: KAVACHColors.primary }}>
              Contact legal@kavach.com
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
          © 2025 KAVACH Financial Services
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
          Regulated by Reserve Bank of India
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  contactCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  contactText: {
    flex: 1,
  },
  footer: {
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
});
