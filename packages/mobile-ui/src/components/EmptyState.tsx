import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';
import { radius } from '../tokens/radius.js';
import { AppText } from './AppText.js';
import { Button } from './Button.js';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <AppText variant="h2" color="textMuted">
          ∅
        </AppText>
      </View>
      <AppText variant="h3" color="text" align="center" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText
          variant="body"
          color="textSecondary"
          align="center"
          style={styles.description}
        >
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="outline"
          size="sm"
          onPress={onAction}
          style={styles.actionButton}
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
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    marginBottom: spacing.xs,
  },
  description: {
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  actionButton: {
    minWidth: 140,
  },
});
