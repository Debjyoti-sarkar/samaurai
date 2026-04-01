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
        navigation.navigate('UPIPayment', {
          amount: response.entities?.amount,
        });
      } else if (response.actionSuggested === 'ask_pin_for_balance') {
        navigation.navigate('Balance');
      } else if (response.actionSuggested === 'show_history') {
        navigation.navigate('TransactionHistory');
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
