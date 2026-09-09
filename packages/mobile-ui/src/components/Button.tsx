import React from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { AppText } from './AppText.js';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        pressed && isInteractive && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.primary}
        />
      ) : (
        <AppText
          variant={size === 'sm' ? 'bodySmall' : 'button'}
          color={getTextColor(variant, disabled)}
          style={[styles.label, textStyle]}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

function getTextColor(variant: ButtonVariant, disabled: boolean): keyof typeof colors {
  if (disabled) return 'textMuted';
  switch (variant) {
    case 'primary':
      return 'textInverse';
    case 'secondary':
      return 'textInverse';
    case 'outline':
      return 'primary';
    case 'text':
      return 'primary';
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    minHeight: 44, // Minimum accessible touch target
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    backgroundColor: 'transparent',
  },
  label: {
    textAlign: 'center',
  },
  size_sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  disabled: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderSubtle,
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
