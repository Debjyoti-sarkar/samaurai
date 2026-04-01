import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Shadows, BorderRadius, KAVACHColors } from '../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

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
  const scale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend();
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 200 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  const active = !!text.trim() && !disabled;

  return (
    <View style={[styles.floatingWrapper, Shadows.lg]}>
      <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary || '#888'}
          editable={!disabled}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <AnimatedPressable
          style={[
            styles.sendButton,
            { backgroundColor: active ? KAVACHColors.primary : theme.backgroundSecondary },
            animatedButtonStyle,
          ]}
          onPress={handleSend}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!active}
          activeOpacity={1}
        >
          <Feather
            name="arrow-up"
            size={22}
            color={active ? '#fff' : theme.textSecondary}
          />
        </AnimatedPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: BorderRadius.xl,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.xl, // Pill shaped outer box
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 120, // Let it grow but cap it
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20, // Circular button
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});

export default AssistantInput;
