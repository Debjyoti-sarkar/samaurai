import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

// Helper to get colors with fallbacks
const getColors = (theme: any) => ({
  ...theme,
  background: theme.backgroundRoot || theme.background || '#F5F1E8',
  textSecondary: theme.textSecondary || '#888',
  card: theme.card || '#FFFFFF',
  border: theme.border || '#D4CFC2',
});

interface AssistantInputProps {
  text: string;
  setText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const AssistantInput: React.FC<AssistantInputProps> = ({
  text,
  setText,
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const { theme } = useTheme();
  const colors = getColors(theme);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary || '#888'}
        editable={!disabled}
        multiline
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: text.trim() && !disabled ? colors.primary : colors.border },
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Ionicons
          name="send"
          size={20}
          color={text.trim() && !disabled ? '#fff' : colors.textSecondary || '#888'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default AssistantInput;
