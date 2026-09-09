import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { AppText } from './AppText.js';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  style?: ViewStyle;
}

export function StatusBadge({
  label,
  variant = 'neutral',
  style,
}: StatusBadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <AppText variant="caption" color={getTextColor(variant)} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

function getTextColor(variant: StatusVariant): keyof typeof colors {
  switch (variant) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'info':
      return 'info';
    case 'neutral':
      return 'neutral';
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
  success: {
    backgroundColor: colors.successLight,
  },
  warning: {
    backgroundColor: colors.warningLight,
  },
  error: {
    backgroundColor: colors.errorLight,
  },
  info: {
    backgroundColor: colors.infoLight,
  },
  neutral: {
    backgroundColor: colors.neutralLight,
  },
});
