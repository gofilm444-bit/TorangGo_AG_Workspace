import React, { useState } from 'react';
import {
  View,
  TextInput,
  type TextInputProps,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { AppText } from './AppText.js';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  helperText,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        accessibilityLabel={label}
        {...rest}
      />

      {error ? (
        <AppText variant="caption" color="error" style={styles.feedbackText}>
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" color="textMuted" style={styles.feedbackText}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    minHeight: 44, // Accessible touch target
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
  inputError: {
    borderColor: colors.error,
  },
  feedbackText: {
    marginTop: spacing.xs,
  },
});
