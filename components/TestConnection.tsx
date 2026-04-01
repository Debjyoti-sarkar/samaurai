import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { healthCheck, BACKEND_URL } from '../services/assistant';
import { useTheme } from '../hooks/useTheme';

// Helper to get colors with fallbacks  
const getColors = (theme: any) => ({
  ...theme,
  background: theme.backgroundRoot || theme.background || '#F5F1E8',
  textSecondary: theme.textSecondary || '#888',
  card: theme.card || '#FFFFFF',
  border: theme.border || '#D4CFC2',
});

interface TestConnectionProps {
  onConnectionResult?: (success: boolean, message: string) => void;
}

export const TestConnection: React.FC<TestConnectionProps> = ({ onConnectionResult }) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const { theme } = useTheme();
  const colors = getColors(theme);

  const testConnection = async () => {
    setStatus('checking');
    setMessage('');

    try {
      const result = await healthCheck();
      
      if (result.status === 'ok') {
        setStatus('success');
        const successMsg = `Connected! Server uptime: ${result.uptime ? Math.floor(result.uptime) + 's' : 'N/A'}`;
        setMessage(successMsg);
        onConnectionResult?.(true, successMsg);
      } else {
        throw new Error('Unexpected status');
      }
    } catch (error) {
      setStatus('error');
      const errorMsg = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setMessage(errorMsg);
      onConnectionResult?.(false, errorMsg);
      
      Alert.alert(
        'Connection Failed',
        `Could not connect to backend at ${BACKEND_URL}\n\nMake sure the server is running.`,
        [{ text: 'OK' }]
      );
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <ActivityIndicator size="small" color={colors.primary} />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={24} color="#34C759" />;
      case 'error':
        return <Ionicons name="close-circle" size={24} color="#FF3B30" />;
      default:
        return <Ionicons name="wifi" size={24} color={colors.textSecondary || '#888'} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#34C759';
      case 'error':
        return '#FF3B30';
      default:
        return colors.primary;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          { borderColor: getStatusColor(), backgroundColor: colors.card },
        ]}
        onPress={testConnection}
        disabled={status === 'checking'}
      >
        <View style={styles.buttonContent}>
          {getStatusIcon()}
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {status === 'checking' ? 'Checking...' : 'Test Connection'}
          </Text>
        </View>
      </TouchableOpacity>
      
      {message ? (
        <Text
          style={[
            styles.message,
            { color: status === 'success' ? '#34C759' : '#FF3B30' },
          ]}
        >
          {message}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary || '#888' }]}>
          Backend: {BACKEND_URL}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default TestConnection;
