// screens/VoiceAssistantScreen.tsx
import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated
} from "react-native";
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import VoiceRecorder, { VoiceRecorderHandle } from "../components/VoiceRecorder";
import { AssistantInput } from "../components/AssistantInput";
import { TestConnection } from "../components/TestConnection";
import { parseText, ParseResponse, getTTSLanguage } from "../services/assistant";
import { useTheme } from "../hooks/useTheme";

// Helper to get colors with fallbacks
const getColors = (theme: any) => ({
  ...theme,
  background: theme.backgroundRoot || theme.background || '#F5F1E8',
  textSecondary: theme.textSecondary || '#888',
});

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  intent?: string;
  action?: string;
}

interface PendingTransaction {
  action: string;
  entities: Record<string, any>;
  detectedLanguage?: string;
}

export default function VoiceAssistantScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const colors = getColors(theme);
  const recorderRef = useRef<VoiceRecorderHandle | null>(null);

  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: "Hello! I'm your payment assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);

  // Pending transaction awaiting voice confirmation
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);

  const addMessage = useCallback((text: string, isUser: boolean, intent?: string, action?: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
      intent,
      action,
    }]);
    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Helper to clean transcribed text - remove assistant's prompts that got picked up
  const cleanTranscribedText = useCallback((text: string): string => {
    let cleaned = text.toLowerCase().trim();

    // Remove common assistant prompt patterns that get picked up by mic
    const promptPatterns = [
      /say yes or no\.?\s*/gi,
      /is that correct\??\.?\s*/gi,
      /do you want to send.*?\?\s*/gi,
      /हां या नहीं बोलें\.?\s*/gi,
      /क्या आप.*भेजना चाहते हैं\??\s*/gi,
      /kya aap.*bhejna chahte hain\??\s*/gi,
      /haan ya nahi bolein\.?\s*/gi,
      /\d+\s*rupees?\s*to\s*\w+\.?\s*/gi,  // "500 rupees to X"
      /₹\d+.*?\.\s*/gi,
    ];

    for (const pattern of promptPatterns) {
      cleaned = cleaned.replace(pattern, ' ');
    }

    return cleaned.trim();
  }, []);

  // Helper to check if a word exists as a standalone word (not part of another word)
  const hasWord = useCallback((text: string, word: string): boolean => {
    // Create regex that matches word boundaries
    const regex = new RegExp(`(^|\\s|[,.!?])${word}($|\\s|[,.!?])`, 'i');
    return regex.test(text);
  }, []);

  // Check if user is confirming a pending transaction
  const isConfirmation = useCallback((text: string): boolean => {
    // Clean the text to remove assistant prompt echoes
    const cleanedText = cleanTranscribedText(text);
    const lowerText = cleanedText.toLowerCase().trim();

    console.log('🔍 Checking confirmation for cleaned text:', lowerText);

    // If the cleaned text is empty or very short, check original for yes/no at the end
    if (lowerText.length < 3) {
      const originalLower = text.toLowerCase().trim();
      // Check if text ends with yes/confirmation
      if (/\b(yes|yeah|yep|yup|हां|हाँ)\s*\.?\s*$/i.test(originalLower)) {
        console.log('✅ Found confirmation at end of text');
        return true;
      }
    }

    // Count yes vs no occurrences - the last one usually matters most
    const yesMatches = (lowerText.match(/\b(yes|yeah|yep|yup|ok|okay|sure|हां|हाँ|ठीक)\b/gi) || []).length;
    const noMatches = (lowerText.match(/\b(no|nope|nah|cancel|नहीं)\b/gi) || []).length;

    console.log(`🔢 Yes count: ${yesMatches}, No count: ${noMatches}`);

    // If there are more yes than no, it's a confirmation
    if (yesMatches > noMatches) {
      return true;
    }

    // If equal or no matches, check for explicit cancel words
    if (noMatches > 0 && noMatches >= yesMatches) {
      return false;
    }

    // Confirm words - check with word boundaries for short words
    const standaloneConfirm = ['yes', 'ok', 'yep', 'yup', 'ya', 'yeah', 'send', 'bhejo', 'भेजो'];
    const confirmWords = ['confirm', 'proceed', 'okay', 'sure', 'do it', 'go ahead', 'send him', 'send it', 'send her',
      'हां', 'हाँ', 'ठीक', 'करो', 'भेजो', 'कर दो', 'हो जाए', 'भेज दो',
      'হ্যাঁ', 'ஆமா', 'అవును', 'ಹೌದು', 'ശരി'];

    if (standaloneConfirm.some(w => hasWord(lowerText, w))) return true;
    return confirmWords.some(w => lowerText.includes(w));
  }, [hasWord, cleanTranscribedText]);

  const isCancellation = useCallback((text: string): boolean => {
    // Clean the text to remove assistant prompt echoes
    const cleanedText = cleanTranscribedText(text);
    const lowerText = cleanedText.toLowerCase().trim();

    console.log('🔍 Checking cancellation for cleaned text:', lowerText);

    // Count yes vs no occurrences
    const yesMatches = (lowerText.match(/\b(yes|yeah|yep|yup|ok|okay|sure|हां|हाँ)\b/gi) || []).length;
    const noMatches = (lowerText.match(/\b(no|nope|nah|cancel|नहीं|रुको)\b/gi) || []).length;

    // Only cancel if there are more no's than yes's
    if (noMatches > yesMatches) {
      return true;
    }

    // Explicit cancel phrases
    const cancelPhrases = ['don\'t send', 'मत भेजो', 'cancel it', 'stop it', 'रुको', 'मत करो', 'बंद करो'];
    return cancelPhrases.some(w => lowerText.includes(w));
  }, [cleanTranscribedText]);

  // Process user text → Parse → Add reply → Navigate + Speak
  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    addMessage(text, true);
    setIsProcessing(true);

    try {
      // Check if we're waiting for confirmation
      if (pendingTransaction) {
        if (isConfirmation(text)) {
          // User confirmed the transaction
          const confirmMsg = pendingTransaction.detectedLanguage === 'hi'
            ? "ठीक है, आपका अनुरोध प्रोसेस कर रही हूं।"
            : pendingTransaction.detectedLanguage === 'hi-en'
            ? "Theek hai, aapka request process kar rahi hoon."
            : "Okay, processing your request now.";

          addMessage(confirmMsg, false);
          Speech.speak(confirmMsg, {
            language: getTTSLanguage(pendingTransaction.detectedLanguage),
            pitch: 1.0,
            rate: 0.9,
          });

          // Execute the pending action
          setTimeout(() => {
            executeAction(pendingTransaction.action, pendingTransaction.entities);
            setPendingTransaction(null);
          }, 1000);
        } else if (isCancellation(text)) {
          // User cancelled the transaction
          const cancelMsg = pendingTransaction.detectedLanguage === 'hi'
            ? "ठीक है, मैंने अनुरोध रद्द कर दिया है।"
            : pendingTransaction.detectedLanguage === 'hi-en'
            ? "Theek hai, maine request cancel kar diya."
            : "Okay, I've cancelled the request.";

          addMessage(cancelMsg, false);
          Speech.speak(cancelMsg, {
            language: getTTSLanguage(pendingTransaction.detectedLanguage),
            pitch: 1.0,
            rate: 0.9,
          });
          setPendingTransaction(null);
        } else {
          // User said something else, ask again
          const askAgainMsg = pendingTransaction.detectedLanguage === 'hi'
            ? "कृपया 'हां' या 'नहीं' में जवाब दें।"
            : pendingTransaction.detectedLanguage === 'hi-en'
            ? "Please 'haan' ya 'nahi' mein jawab dein."
            : "Please say 'yes' to confirm or 'no' to cancel.";

          addMessage(askAgainMsg, false);
          Speech.speak(askAgainMsg, {
            language: getTTSLanguage(pendingTransaction.detectedLanguage),
            pitch: 1.0,
            rate: 0.9,
          });
        }
        setIsProcessing(false);
        return;
      }

      // Normal processing - parse the text
      const response: ParseResponse = await parseText(text);

      addMessage(
        response.replyText || "I understood your request.",
        false,
        response.intent,
        response.actionSuggested
      );

      if (response.replyText) {
        // Use detected language for TTS (supports Hindi, Bengali, Tamil, etc.)
        const ttsLanguage = getTTSLanguage(response.detectedLanguage);
        console.log(`🗣️ Speaking in ${ttsLanguage}:`, response.replyText);

        Speech.speak(response.replyText, {
          language: ttsLanguage,
          pitch: 1.0,
          rate: 0.9,
        });
      }

      // For money transfers, ask for confirmation first
      if (response.actionSuggested === 'prefill_and_navigate_upi' && response.entities?.amount) {
        const confirmPrompt = response.detectedLanguage === 'hi'
          ? `क्या आप ₹${response.entities.amount} ${response.entities.recipient ? response.entities.recipient + ' को' : ''} भेजना चाहते हैं? हां या नहीं बोलें।`
          : response.detectedLanguage === 'hi-en'
          ? `Kya aap ₹${response.entities.amount} ${response.entities.recipient ? response.entities.recipient + ' ko' : ''} bhejna chahte hain? Haan ya nahi bolein.`
          : `Do you want to send ₹${response.entities.amount} ${response.entities.recipient ? 'to ' + response.entities.recipient : ''}? Say yes or no.`;

        // Add confirmation request after a short delay
        setTimeout(() => {
          addMessage(confirmPrompt, false);
          Speech.speak(confirmPrompt, {
            language: getTTSLanguage(response.detectedLanguage),
            pitch: 1.0,
            rate: 0.9,
          });
        }, 2000);

        // Store pending transaction
        setPendingTransaction({
          action: response.actionSuggested,
          entities: response.entities,
          detectedLanguage: response.detectedLanguage,
        });
      } else {
        // For non-money actions, execute immediately
        handleAction(response.actionSuggested, response.entities);
      }

    } catch (error) {
      console.error("Error processing text:", error);
      const errorMsg = "Sorry, I couldn't process your request. Please try again.";
      addMessage(errorMsg, false);
      Speech.speak(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [addMessage, pendingTransaction, isConfirmation, isCancellation]);

  // Execute action immediately (used after confirmation)
  const executeAction = (action: string, entities?: Record<string, any>) => {
    switch (action) {
      case "prefill_and_navigate_upi":
        navigation.navigate("SendMoney" as never, {
          amount: entities?.amount,
          recipient: entities?.recipient,
          paymentMethod: "UPI",
        } as never);
        break;

      case "ask_pin_for_balance":
        navigation.navigate("Balance" as never);
        break;

      case "show_history":
        navigation.navigate("TransactionHistory" as never);
        break;

      case "scan_qr":
        navigation.navigate("QRScanner" as never);
        break;

      case "check_fraud":
        navigation.navigate("FraudScan" as never);
        break;

      case "help_support_page":
        navigation.navigate("HelpFaq" as never);
        break;

      default:
        console.log("No navigation triggered for:", action);
    }
  };

  // Navigation + intents - with delay so user can see/hear the response first
  const handleAction = (action: string, entities?: Record<string, any>) => {
    if (!action || action === "none") {
      console.log("No action to perform");
      return;
    }

    // Delay navigation so user can see the response
    setTimeout(() => {
      executeAction(action, entities);
    }, 1500); // Wait 1.5 seconds so user can read the response
  };

  // Send button triggered
  const handleSend = useCallback(() => {
    if (inputText.trim()) {
      processText(inputText.trim());
      setInputText("");
    }
  }, [inputText, processText]);

  // Handle transcribed voice input - populate input field and auto-process
  const handleTranscribed = useCallback((text: string) => {
    setIsTranscribing(false);
    if (!text.trim()) {
      setTranscribedText(null);
      return;
    }
    const trimmedText = text.trim();
    
    // Show the transcribed text so user can see what was recognized
    setTranscribedText(trimmedText);
    // Put the text in the input field so user can see it
    setInputText(trimmedText);
    
    // Auto-process immediately (no delay needed)
    setTimeout(() => {
      processText(trimmedText);
      setTranscribedText(null);
      setInputText("");
    }, 100);
  }, [processText]);

  // Handle recording state changes from VoiceRecorder
  const handleRecordingStateChange = useCallback((isRecording: boolean, isSending: boolean) => {
    setIsTranscribing(isSending);
    if (isRecording) {
      setTranscribedText(null);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Voice Assistant</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Speak or type your request
          </Text>
        </View>

        <TestConnection />

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isUser 
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }]
              ]}
            >
              <Text 
                style={[
                  styles.messageText,
                  { color: message.isUser ? '#fff' : colors.text }
                ]}
              >
                {message.text}
              </Text>

              {message.intent && (
                <Text style={[styles.intentTag, { color: message.isUser ? '#ddd' : colors.textSecondary }]}>
                  Intent: {message.intent}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Show transcribed text before processing */}
        {(transcribedText || isTranscribing) && (
          <View style={[styles.transcribedContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {isTranscribing ? (
              <Text style={[styles.transcribingText, { color: colors.textSecondary }]}>
                Listening...
              </Text>
            ) : (
              <>
                <Text style={[styles.transcribedLabel, { color: colors.textSecondary }]}>
                  You said:
                </Text>
                <Text style={[styles.transcribedText, { color: colors.text }]}>
                  "{transcribedText}"
                </Text>
              </>
            )}
          </View>
        )}

        {/* Microphone Recorder */}
        <VoiceRecorder
          ref={recorderRef}
          onTranscribed={handleTranscribed}
          onStateChange={handleRecordingStateChange}
          useAssistantEndpoint={true}
          enableAssistantFlow={true}
          primaryColor={colors.primary}
        />

        <AssistantInput
          text={inputText}
          setText={setInputText}
          onSend={handleSend}
          placeholder="Type a message..."
          disabled={isProcessing}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginTop: 4 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16 },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  intentTag: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
  transcribedContainer: {
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  transcribedLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  transcribedText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  transcribingText: {
    fontSize: 14,
    fontStyle: "italic",
  },
});
