import React from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { AppText } from './AppText.js';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export function LoadingState({
  message = 'Memuat...',
  size = 'large',
  style,
}: LoadingStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar">
      <ActivityIndicator size={size} color={colors.primary} />
      {message ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
