// hooks/useVoiceAgent.ts
import { useState, useCallback } from 'react';
import { parseText, ParseResponse } from '../services/assistant';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';

export function useVoiceAgent() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<ParseResponse | null>(null);
  const navigation = useNavigation<any>();

  const processCommand = useCallback(async (text: string): Promise<ParseResponse> => {
    setIsProcessing(true);
    try {
      console.log('🤖 Processing command:', text);
      const response = await parseText(text);
      setLastResponse(response);
      
      // Speak the response
      if (response.replyText) {
        Speech.speak(response.replyText, {
          language: 'en-IN',
        });
      }

      // Handle navigation based on action
      if (response.actionSuggested === 'prefill_and_navigate_upi') {
        navigation.navigate('SendMoney', {
          amount: response.entities?.amount?.toString(),
          recipient: response.entities?.recipient,
          paymentMethod: 'UPI',
        });
      } else if (response.actionSuggested === 'ask_pin_for_balance') {
        navigation.navigate('Balance');
      } else if (response.actionSuggested === 'show_history') {
        navigation.navigate('TransactionHistory');
      } else if (response.actionSuggested === 'scan_qr') {
        navigation.navigate('QRScanner');
      } else if (response.actionSuggested === 'check_fraud') {
        navigation.navigate('FraudScan');
      } else if (response.actionSuggested === 'help_support_page') {
        navigation.navigate('HelpFaq');
      }

      return response;
    } catch (error) {
      console.error('❌ Voice agent error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [navigation]);

  return {
    processCommand,
    isProcessing,
    lastResponse,
  };
}
