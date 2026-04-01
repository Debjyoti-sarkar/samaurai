import React, { useState } from "react";
import { View, StyleSheet, TextInput, Alert, Linking, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";

interface ContactOption {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  action: () => void;
  color: string;
}

export default function ContactSupportScreen() {
  const { theme } = useTheme();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contactOptions: ContactOption[] = [
    {
      icon: "phone",
      title: "Call Us",
      subtitle: "24/7 Helpline: 1800-XXX-XXXX",
      action: () => Linking.openURL("tel:1800XXXXXXX"),
      color: KAVACHColors.primary,
    },
    {
      icon: "mail",
      title: "Email",
      subtitle: "support@kavach.com",
      action: () => Linking.openURL("mailto:support@kavach.com"),
      color: KAVACHColors.info,
    },
    {
      icon: "message-circle",
      title: "WhatsApp",
      subtitle: "Chat with us instantly",
      action: () => Linking.openURL("https://wa.me/911234567890"),
      color: "#25D366",
    },
    {
      icon: "twitter",
      title: "Twitter",
      subtitle: "@KAVACHSupport",
      action: () => Linking.openURL("https://twitter.com/KAVACHSupport"),
      color: "#1DA1F2",
    },
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    Alert.alert(
      "Message Sent",
      "Thank you for contacting us. Our team will respond within 24 hours.",
      [{ text: "OK", onPress: () => {
        setSubject("");
        setMessage("");
      }}]
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: KAVACHColors.primary + "15" }]}>
          <Feather name="headphones" size={32} color={KAVACHColors.primary} />
        </View>
        <ThemedText type="h3" style={styles.title}>Contact Support</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          We're here to help you 24/7
        </ThemedText>
      </View>

      {/* Quick Contact Options */}
      <View style={styles.contactGrid}>
        {contactOptions.map((option, index) => (
          <Pressable
            key={index}
            onPress={option.action}
            style={[styles.contactCard, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <View style={[styles.contactIcon, { backgroundColor: option.color + "15" }]}>
              <Feather name={option.icon} size={24} color={option.color} />
            </View>
            <ThemedText style={styles.contactTitle}>{option.title}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {option.subtitle}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Contact Form */}
      <View style={styles.formSection}>
        <ThemedText type="h4" style={styles.formTitle}>Send us a message</ThemedText>
        
        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Subject</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={subject}
            onChangeText={setSubject}
            placeholder="What do you need help with?"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Message</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue in detail..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <Button
          onPress={handleSubmit}
          disabled={isSubmitting || !subject.trim() || !message.trim()}
        >
          {isSubmitting ? "Sending..." : "Send Message"}
        </Button>
      </View>

      {/* Office Hours */}
      <View style={[styles.hoursCard, { backgroundColor: theme.card }]}>
        <Feather name="clock" size={20} color={KAVACHColors.primary} />
        <View style={styles.hoursText}>
          <ThemedText style={{ fontWeight: "500" }}>Support Hours</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Phone: 24/7 • Email: Response within 24 hours
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
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  contactCard: {
    width: "47%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  contactTitle: {
    fontWeight: "500",
    marginBottom: 4,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  formTitle: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    paddingTop: Spacing.md,
  },
  hoursCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    alignItems: "center",
  },
  hoursText: {
    flex: 1,
  },
});
