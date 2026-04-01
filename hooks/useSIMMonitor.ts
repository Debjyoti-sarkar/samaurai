import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import simService from '../services/SIMService';
import { wipeAllAppData, isSIMRegistered } from '../utils/secureManager';

interface SIMMonitorOptions {
  onSIMChange?: () => void;
  onDataWiped?: () => void;
  enabled?: boolean;
}

interface SIMMonitorState {
  isChecking: boolean;
  lastCheckTime: Date | null;
  simValid: boolean;
  error: string | null;
}

export function useSIMMonitor(options: SIMMonitorOptions = {}) {
  const { onSIMChange, onDataWiped, enabled = true } = options;
  const appState = useRef(AppState.currentState);
  const [state, setState] = useState<SIMMonitorState>({
    isChecking: false,
    lastCheckTime: null,
    simValid: true,
    error: null,
  });

  // Use refs to store callbacks to avoid dependency changes
  const onSIMChangeRef = useRef(onSIMChange);
  const onDataWipedRef = useRef(onDataWiped);

  // Update refs when callbacks change
  useEffect(() => {
    onSIMChangeRef.current = onSIMChange;
    onDataWipedRef.current = onDataWiped;
  }, [onSIMChange, onDataWiped]);

  // Track if initial check has been done to avoid duplicate checks
  const initialCheckDone = useRef(false);

  const handleSIMChange = useCallback(async () => {
    console.log('🚨 SIM CHANGE DETECTED - Initiating data wipe...');

    // Show alert to user
    Alert.alert(
      'Security Alert',
      'A SIM card change has been detected. For your security, all app data will be deleted. You will need to re-register.',
      [
        {
          text: 'OK',
          onPress: async () => {
            // Wipe all data
            const result = await wipeAllAppData();

            if (result.success) {
              console.log('✅ Data wipe completed after SIM change');
              onSIMChangeRef.current?.();
              onDataWipedRef.current?.();
            } else {
              console.error('❌ Failed to wipe data:', result.error);
              // Still notify that SIM changed
              onSIMChangeRef.current?.();
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, []); // No dependencies - uses refs

  const checkSIM = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;

    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      // First check if SIM is registered
      const registered = await isSIMRegistered();

      if (!registered) {
        // SIM not registered yet, skip verification
        setState(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          simValid: true,
        }));
        return true;
      }

      // Verify the current SIM matches the registered one
      const result = await simService.verifySIM();

      if (result.changed) {
        setState(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          simValid: false,
        }));

        // Handle SIM change
        await handleSIMChange();
        return false;
      }

      if (result.error) {
        console.warn('SIM verification error:', result.error);
        setState(prev => ({
          ...prev,
          isChecking: false,
          lastCheckTime: new Date(),
          error: result.error || null,
        }));
        // Don't fail on error, just log it
        return true;
      }

      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheckTime: new Date(),
        simValid: true,
      }));

      return true;
    } catch (error) {
      console.error('SIM check error:', error);
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheckTime: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return true; // Don't block on errors
    }
  }, [enabled, handleSIMChange]);

  // Check SIM when app comes to foreground
  useEffect(() => {
    if (!enabled) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Check SIM when app comes back to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App returned to foreground - checking SIM...');
        await checkSIM();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial check when hook mounts (only once)
    if (!initialCheckDone.current) {
      initialCheckDone.current = true;
      checkSIM();
    }

    return () => {
      subscription.remove();
    };
  }, [enabled, checkSIM]);

  return {
    ...state,
    checkSIM,
    registerSIM: simService.registerSIM.bind(simService),
  };
}

export default useSIMMonitor;
