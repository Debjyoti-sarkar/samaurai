import React, { useState } from "react";
import { View, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    id: "1",
    category: "Payments",
    question: "How do I send money using UPI?",
    answer: "To send money via UPI:\n1. Tap 'Send Money' on the dashboard\n2. Enter the recipient's UPI ID or scan their QR code\n3. Enter the amount\n4. Confirm with your PIN\n\nThe money will be transferred instantly."
  },
  {
    id: "2",
    category: "Payments",
    question: "What is the maximum transaction limit?",
    answer: "The transaction limits are:\n• Per transaction: ₹1,00,000\n• Daily limit: ₹2,00,000\n• Monthly limit: ₹10,00,000\n\nLimits may vary based on your bank and KYC status."
  },
  {
    id: "3",
    category: "Security",
    question: "How do I change my PIN?",
    answer: "To change your PIN:\n1. Go to Settings\n2. Tap 'Change PIN'\n3. Enter your current PIN\n4. Set a new 6-digit PIN\n5. Confirm your new PIN\n\nMake sure to remember your new PIN!"
  },
  {
    id: "4",
    category: "Security",
    question: "What should I do if I forget my PIN?",
    answer: "If you forget your PIN:\n1. Tap 'Forgot PIN' on the login screen\n2. Verify your identity using OTP sent to your registered mobile\n3. Set a new PIN\n\nFor security, you may need to re-link your bank account."
  },
  {
    id: "5",
    category: "Security",
    question: "Is biometric login secure?",
    answer: "Yes! Biometric authentication (fingerprint/Face ID) is highly secure:\n• Your biometric data never leaves your device\n• It's encrypted and stored in secure hardware\n• Cannot be replicated or stolen\n• PIN remains as backup"
  },
  {
    id: "6",
    category: "Account",
    question: "How do I link my bank account?",
    answer: "To link your bank account:\n1. Go to Settings > Linked Accounts\n2. Tap 'Add Bank Account'\n3. Select your bank\n4. Enter your account details\n5. Verify with OTP\n\nYour account will be linked within 24 hours."
  },
  {
    id: "7",
    category: "Account",
    question: "How do I verify my Aadhaar?",
    answer: "To verify Aadhaar:\n1. Go to Settings > Aadhaar Verification\n2. Enter your 12-digit Aadhaar number\n3. An OTP will be sent to your Aadhaar-registered mobile\n4. Enter the OTP to verify\n\nThis enables higher transaction limits."
  },
  {
    id: "8",
    category: "Features",
    question: "What is the Fraud Scanner?",
    answer: "The Fraud Scanner helps you verify:\n• Suspicious phone numbers\n• Unknown UPI IDs\n• Potential scam messages\n\nSimply enter the details and we'll check our database of known fraudsters."
  },
  {
    id: "9",
    category: "Features",
    question: "How does Voice Assistant work?",
    answer: "Voice Assistant lets you:\n• Send money by voice command\n• Check balance\n• View transactions\n• Navigate the app\n\nJust say commands like 'Send 500 to John' or 'Show my balance'."
  },
  {
    id: "10",
    category: "Features",
    question: "What is Offline OTP?",
    answer: "Offline OTP lets you generate verification codes without internet:\n1. Enable it in Settings\n2. When offline, open the app\n3. Generate a time-based OTP\n4. Use it for verification\n\nUseful in areas with poor connectivity."
  },
];

const categories = ["All", "Payments", "Security", "Account", "Features"];

function FAQItemComponent({ item, isExpanded, onToggle }: { 
  item: FAQItem; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.faqItem, { backgroundColor: theme.card }]}
    >
      <View style={styles.faqHeader}>
        <ThemedText style={styles.question}>{item.question}</ThemedText>
        <Feather 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={theme.textSecondary} 
        />
      </View>
      {isExpanded && (
        <ThemedText style={[styles.answer, { color: theme.textSecondary }]}>
          {item.answer}
        </ThemedText>
      )}
    </Pressable>
  );
}

export default function HelpFaqScreen() {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFaqs = selectedCategory === "All" 
    ? faqs 
    : faqs.filter(f => f.category === selectedCategory);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          <Feather name="help-circle" size={32} color={KAVACHColors.primary} />
        </View>
        <ThemedText type="h3" style={styles.title}>Help & FAQ</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Find answers to commonly asked questions
        </ThemedText>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryContainer}>
        {categories.map((category) => (
          <Pressable
            key={category}
            onPress={() => {
              setSelectedCategory(category);
              setExpandedId(null);
            }}
            style={[
              styles.categoryTab,
              { 
                backgroundColor: selectedCategory === category 
                  ? KAVACHColors.primary 
                  : theme.card,
                borderColor: theme.border,
              }
            ]}
          >
            <ThemedText 
              style={{ 
                color: selectedCategory === category ? "#fff" : theme.text,
                fontSize: 13,
              }}
            >
              {category}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* FAQ List */}
      <View style={styles.faqList}>
        {filteredFaqs.map((item) => (
          <FAQItemComponent
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => toggleExpand(item.id)}
          />
        ))}
      </View>

      {/* Still need help */}
      <View style={[styles.helpCard, { backgroundColor: KAVACHColors.info + "10" }]}>
        <Feather name="message-circle" size={24} color={KAVACHColors.info} />
        <View style={styles.helpText}>
          <ThemedText style={{ fontWeight: "500" }}>Still need help?</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Contact our support team for personalized assistance
          </ThemedText>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
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
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categoryTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  faqList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  faqItem: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    overflow: "hidden",
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    marginRight: Spacing.sm,
  },
  answer: {
    marginTop: Spacing.md,
    fontSize: 14,
    lineHeight: 22,
  },
  helpCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    alignItems: "center",
  },
  helpText: {
    flex: 1,
  },
});
