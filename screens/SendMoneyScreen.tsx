import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  GestureResponderEvent,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useNetwork } from "@/hooks/useNetwork";
import { enqueue } from "@/services/QueueManager";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Spacing,
  BorderRadius,
  KAVACHColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

import { createPaymentOrder, isValidUpiId } from "@/services/paymentGateway";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { RiskModal, RiskLevel } from "@/components/RiskModal";
import Constants from 'expo-constants';

// NEW IMPORT (added)
import { speak } from "../utils/speak";

const RECENT_CONTACTS = [
  { id: "1", name: "Rahul Sharma", upiId: "rahul@upi", avatar: "R" },
  { id: "2", name: "Priya Patel", upiId: "priya@ybl", avatar: "P" },
  { id: "3", name: "Amit Kumar", upiId: "amit@paytm", avatar: "A" },
  { id: "4", name: "Sunita Devi", upiId: "sunita@okaxis", avatar: "S" },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ContactCard({
  contact,
  isSelected,
  onSelect,
}: {
  contact: (typeof RECENT_CONTACTS)[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[
        styles.contactCard,
        {
          backgroundColor: isSelected
            ? KAVACHColors.primary + "15"
            : theme.card,
          borderColor: isSelected ? KAVACHColors.primary : theme.border,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: KAVACHColors.primary + "30" },
        ]}
      >
        <ThemedText
          style={[styles.avatarText, { color: KAVACHColors.primary }]}
        >
          {contact.avatar}
        </ThemedText>
      </View>

      <View style={styles.contactInfo}>
        <ThemedText style={[styles.contactName, { textAlign: "center" }]}>
          {contact.name.split(" ")[0]}
        </ThemedText>
      </View>

      {isSelected ? (
        <Feather name="check-circle" size={20} color={KAVACHColors.primary} />
      ) : null}
    </AnimatedPressable>
  );
}

export default function SendMoneyScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SendMoney">>();
  const { t, language } = useLanguage();
  const { isConnected, isWeak } = useNetwork();

  // NexaSafe integration for fraud detection
  const {
    trackScreenVisit,
    trackTransactionStart,
    trackTransactionEnd,
    trackTransactionAmount,
    trackLargeTransaction,
    trackTap,
    trackTapDuration,
    trustScore,
    riskLevel,
    isSessionActive,
  } = useNexaSafe();

  // Track tap timing for behavioral analysis
  const tapStartTime = useRef<number>(0);

  // Track screen visit on mount
  useEffect(() => {
    if (isSessionActive) {
      trackScreenVisit("SendMoney");
    }
  }, [isSessionActive]);

  // Handle tap start (for duration tracking)
  const handleTapStart = () => {
    tapStartTime.current = Date.now();
  };

  // Handle tap end with tracking
  const handleTapEnd = (e: GestureResponderEvent, zone: string = "active") => {
    if (isSessionActive) {
      const { locationX, locationY } = e.nativeEvent;
      const duration = Date.now() - tapStartTime.current;
      trackTap("SendMoney", locationX, locationY, zone);
      trackTapDuration("SendMoney", duration);
    }
  };

  const [recipient, setRecipient] = useState(route.params?.recipient || "");
  const [amount, setAmount] = useState(route.params?.amount || "");
  const [note, setNote] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactName, setContactName] = useState(
    route.params?.contactName || "",
  );
  
  const [isRiskModalVisible, setIsRiskModalVisible] = useState(false);
  const [riskData, setRiskData] = useState<{ risk: RiskLevel; score: number; reasons: string[] }>({
    risk: "LOW",
    score: 0,
    reasons: [],
  });

  // Auto-match recipient name to contact and select it
  useEffect(() => {
    if (route.params?.recipient) {
      const recipientText = route.params.recipient.toLowerCase();

      // First check if it's already a UPI ID
      if (recipientText.includes("@")) {
        setRecipient(route.params.recipient);
        // Try to find matching contact
        const match = RECENT_CONTACTS.find(
          (c) => c.upiId.toLowerCase() === recipientText,
        );
        if (match) {
          setSelectedContact(match.id);
          setContactName(match.name);
        }
      } else {
        // Try to match by name
        const match = RECENT_CONTACTS.find(
          (c) =>
            c.name.toLowerCase().includes(recipientText) ||
            c.name
              .toLowerCase()
              .split(" ")
              .some((part) => part.startsWith(recipientText)),
        );

        if (match) {
          setSelectedContact(match.id);
          setRecipient(match.upiId);
          setContactName(match.name);
          console.log(
            `✅ Auto-matched "${route.params.recipient}" to ${match.name} (${match.upiId})`,
          );
        } else {
          // No match found, use as-is
          setRecipient(route.params.recipient);
        }
      }
    }
    if (route.params?.amount) setAmount(route.params.amount.toString());
    if (route.params?.contactName) setContactName(route.params.contactName);
  }, [route.params]);

  // ✅ UPDATED: new voice‑enabled version
  const handleContactSelect = (contact: (typeof RECENT_CONTACTS)[0]) => {
    setSelectedContact(contact.id);
    setRecipient(contact.upiId);

    const spokenText = `${contact.name}, U P I I D: ${contact.upiId.replace(
      /[@.]/g,
      " ",
    )}`;

    speak(spokenText, language);
  };

  const handleReviewPayment = async () => {
    if (!recipient || !amount) {
      Alert.alert("Missing Information", "Please enter recipient and amount");
      return;
    }

    if (!isValidUpiId(recipient)) {
      Alert.alert(
        "Invalid UPI ID",
        "Enter a valid UPI ID like name@bank to send money to a real recipient.",
      );
      return;
    }

    if (Number(amount) <= 0) {
      Alert.alert("Invalid Amount", "Enter an amount greater than zero.");
      return;
    }

    // Call Kavach Shield Risk API
    try {
      setIsProcessing(true);
      
      const payload = {
        value: recipient,
        amount: Number(amount),
        isFirstTransaction: true, 
      };

      // Check local blacklist first
      const flaggedStr = await AsyncStorage.getItem("KAVACH_FLAGGED_UPIS");
      const flaggedUpis = flaggedStr ? JSON.parse(flaggedStr) : [];
      let isLocalFlagged = flaggedUpis.includes(recipient.toLowerCase());

      // Fetch from backend
      // Automatically determine the computer's local IP running Expo Metro server
      const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
      const bundlerIp = hostUri ? hostUri.split(':')[0] : '10.0.2.2';
      
      const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${bundlerIp}:5000`;
      
      console.log("[Risk Check] Payload:", payload);
      console.log("[Risk Check] Sending to API:", API_URL);
      
      // Let's use a try block for the fetch to avoid crashing if backend is offline
      let finalRisk = "LOW";
      let finalScore = 0;
      let finalReasons: string[] = [];

      try {
        const response = await fetch(`${API_URL}/api/check-risk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          const data = await response.json();
          finalRisk = data.risk;
          finalScore = data.score;
          finalReasons = data.reasons || [];
        }
      } catch (fetchErr) {
        console.warn("Backend not reachable, relying solely on local blacklist");
      }
      
      if (isLocalFlagged && finalRisk !== "HIGH") {
        finalRisk = "HIGH";
        finalScore = Math.max(finalScore, 90);
        finalReasons = ["Previously flagged locally as suspicious", ...finalReasons];
      }

      if (finalRisk === "HIGH" || finalRisk === "MEDIUM") {
        setRiskData({ risk: finalRisk as RiskLevel, score: finalScore, reasons: finalReasons });
        setIsRiskModalVisible(true);
      } else {
        setShowConfirmation(true);
      }
    } catch (error) {
      console.warn("Risk check failed, falling back to confirmation", error);
      setShowConfirmation(true); 
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRiskContinue = async () => {
    setIsRiskModalVisible(false);
    
    // Save to flagged list if it was a HIGH risk that we bypassed
    if (riskData.risk === "HIGH" || riskData.risk === "MEDIUM") {
      try {
        const flaggedStr = await AsyncStorage.getItem("KAVACH_FLAGGED_UPIS");
        const flaggedUpis = flaggedStr ? JSON.parse(flaggedStr) : [];
        if (!flaggedUpis.includes(recipient.toLowerCase())) {
           flaggedUpis.push(recipient.toLowerCase());
           await AsyncStorage.setItem("KAVACH_FLAGGED_UPIS", JSON.stringify(flaggedUpis));
        }
      } catch (err) {
        console.warn("Failed to save flagged UPI", err);
      }
    }

    setShowConfirmation(true);
  };

  const handleConfirmPayment = async () => {
    const amountValue = parseFloat(amount);
    const payload = {
      amount: amountValue,
      recipient,
      note: note || "from-app",
      contactName,
    };

    try {
      setIsProcessing(true);

      // NexaSafe: Mark transaction start
      trackTransactionStart();

      // Check network status - if offline or weak, enqueue the transaction
      if (!isConnected || isWeak) {
        const entry = await enqueue({
          type: "send_money",
          payload,
          idempotencyKey: "send-" + Date.now(),
        });

        // NexaSafe: Mark transaction end
        trackTransactionEnd();

        Alert.alert(
          "Transaction Saved",
          "No internet connection. Transaction saved and will be processed automatically when you're back online.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }

      // Create payment order if online
      const paymentOrder = await createPaymentOrder(
        amountValue,
        recipient,
        note || undefined,
      );

      navigation.navigate("PaymentProcessing", {
        paymentOrder: {
          ...paymentOrder,
          contactName: contactName || undefined,
        },
      });
    } catch (error) {
      // NexaSafe: Mark transaction end on error too
      trackTransactionEnd();

      // On error, optionally enqueue for retry
      if (isConnected && !isWeak) {
        await enqueue({
          type: "send_money",
          payload,
          idempotencyKey: "send-" + Date.now(),
        });
        Alert.alert(
          "Transaction Saved",
          "Could not process now. Transaction saved and will be retried automatically.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert("Error", "Failed to initiate payment. Please try again.", [
          { text: "OK" },
        ]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------- CONFIRMATION UI (unchanged) ------------------

  if (showConfirmation) {
    return (
      <ScreenKeyboardAwareScrollView>
        <View style={styles.confirmationContainer}>
          <View
            style={[
              styles.confirmIcon,
              { backgroundColor: KAVACHColors.primary + "15" },
            ]}
          >
            <Feather name="send" size={48} color={KAVACHColors.primary} />
          </View>

          <ThemedText type="h3" style={styles.confirmTitle}>
            Confirm Payment
          </ThemedText>

          <View
            style={[
              styles.confirmCard,
              { backgroundColor: theme.card },
              Shadows.md,
            ]}
          >
            <View style={styles.confirmRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Sending to
              </ThemedText>
              <ThemedText style={styles.confirmValue}>{recipient}</ThemedText>
            </View>

            <View style={styles.confirmDivider} />

            <View style={styles.confirmRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Amount
              </ThemedText>
              <ThemedText type="h2" style={{ color: KAVACHColors.primary }}>
                ₹ {parseFloat(amount).toLocaleString("en-IN")}
              </ThemedText>
            </View>

            {note ? (
              <>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Note
                  </ThemedText>
                  <ThemedText>{note}</ThemedText>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.confirmButtons}>
            <Button
              onPress={handleConfirmPayment}
              disabled={isProcessing}
              style={{ backgroundColor: KAVACHColors.primary, flex: 1 }}
            >
              {isProcessing ? "Processing..." : t("confirm")}
            </Button>

            <Pressable
              onPress={() => setShowConfirmation(false)}
              disabled={isProcessing}
              style={[styles.cancelButton, { borderColor: theme.border }]}
            >
              <ThemedText>{t("cancel")}</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScreenKeyboardAwareScrollView>
    );
  }

  // ---------------- MAIN UI (UNCHANGED except new handleContactSelect) ------------------

  return (
    <ScreenKeyboardAwareScrollView>
      <Animated.View style={styles.section} entering={FadeInDown.delay(100)}>
        <ThemedText
          type="small"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          Sample Contacts
        </ThemedText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contactsGrid}
        >
          {RECENT_CONTACTS.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isSelected={selectedContact === contact.id}
              onSelect={() => handleContactSelect(contact)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* ALL OTHER UI unchanged exactly as before */}

      <Animated.View style={styles.section} entering={FadeInDown.delay(200)}>
        <ThemedText
          type="small"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("recipientUpi")}
        </ThemedText>

        <View style={styles.inputContainer}>
          <Feather
            name="user"
            size={20}
            color={theme.textSecondary}
            style={styles.inputIcon}
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Enter UPI ID or phone number"
            placeholderTextColor={theme.textSecondary}
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
          />
        </View>

        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
        >
          Enter the exact UPI ID of the person you want to pay, for example
          `name@bank`.
        </ThemedText>

        <Pressable
          onPress={() => navigation.navigate("QRScanner")}
          style={[styles.qrButton, { borderColor: KAVACHColors.primary }]}
        >
          <Feather name="camera" size={20} color={KAVACHColors.primary} />
          <ThemedText
            style={{
              color: KAVACHColors.primary,
              marginLeft: Spacing.sm,
            }}
          >
            Scan QR Code
          </ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.View style={styles.section} entering={FadeInDown.delay(300)}>
        <ThemedText
          type="small"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("amount")}
        </ThemedText>

        <View style={styles.amountContainer}>
          <ThemedText type="h1" style={styles.currencySymbol}>
            ₹
          </ThemedText>

          <TextInput
            style={[styles.amountInput, { color: theme.text }]}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
        </View>
      </Animated.View>

      <Animated.View style={styles.section} entering={FadeInDown.delay(400)}>
        <ThemedText
          type="small"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("note")}
        </ThemedText>

        <TextInput
          style={[
            styles.noteInput,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Add a note (optional)"
          placeholderTextColor={theme.textSecondary}
          value={note}
          onChangeText={setNote}
          multiline
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(500)}
        style={{
          flex: 1,
          paddingBottom: 60,
          justifyContent: "flex-end",
          minHeight: 120,
        }}
      >
        <Button
          onPress={handleReviewPayment}
          disabled={!recipient || !amount || isProcessing}
          style={{
            backgroundColor: KAVACHColors.primary,
            marginTop: Spacing.xl,
          }}
        >
          {isProcessing ? "Checking Securely..." : t("reviewPayment")}
        </Button>
      </Animated.View>

      <RiskModal
        visible={isRiskModalVisible}
        risk={riskData.risk}
        score={riskData.score}
        reasons={riskData.reasons}
        onContinue={handleRiskContinue}
        onCancel={() => setIsRiskModalVisible(false)}
      />
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactsGrid: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  contactCard: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontWeight: "500",
    marginBottom: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 52,
    paddingLeft: Spacing["4xl"],
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontSize: 16,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: Spacing.md,
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  currencySymbol: {
    fontSize: 36,
    marginRight: Spacing.sm,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: "700",
    minWidth: 100,
    textAlign: "center",
  },
  noteInput: {
    height: 80,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontSize: 16,
    textAlignVertical: "top",
  },
  confirmationContainer: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  confirmIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  confirmTitle: {
    marginBottom: Spacing.xl,
  },
  confirmCard: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  confirmRow: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  confirmDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: Spacing.lg,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
