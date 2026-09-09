import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { AppText } from './AppText.js';
import { Button } from './Button.js';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export function ErrorState({
  title = 'Terjadi Kesalahan',
  message = 'Gagal memuat data. Silakan periksa koneksi internet Anda.',
  requestId,
  onRetry,
  retryLabel = 'Coba Lagi',
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <AppText variant="h2" color="error">
          !
        </AppText>
      </View>
      <AppText variant="h3" color="text" align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText
        variant="body"
        color="textSecondary"
        align="center"
        style={styles.message}
      >
        {message}
      </AppText>
      {requestId ? (
        <AppText
          variant="caption"
          color="textMuted"
          align="center"
          style={styles.requestId}
        >
          ID Permintaan: {requestId}
        </AppText>
      ) : null}
      {onRetry ? (
        <Button
          title={retryLabel}
          variant="primary"
          size="sm"
          onPress={onRetry}
          style={styles.retryButton}
        />
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  requestId: {
    marginBottom: spacing.lg,
    fontFamily: 'monospace',
  },
  retryButton: {
    minWidth: 140,
  },
});
