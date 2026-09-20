import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { AppText } from './AppText.js';

export interface OfflineBannerProps {
  isOffline?: boolean;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function OfflineBanner({
  isOffline = false,
  message = 'Koneksi internet terputus. Menampilkan data lokal.',
  onRetry,
  retryLabel = 'Coba lagi',
}: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <AppText variant="caption" color="textInverse" style={styles.text}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} style={styles.retryButton}>
          <AppText variant="caption" color="textInverse" style={styles.retryText}>
            {retryLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    flex: 1,
  },
  retryButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  retryText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
