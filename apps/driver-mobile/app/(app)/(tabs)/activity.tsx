import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function DriverActivityScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Aktivitas Pengantaran
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Riwayat order dan status pengantaran selesai
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Riwayat Pengantaran"
        description="Daftar perjalanan dan pengantaran yang Anda selesaikan akan tercatat secara akurat di sini."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  subtitle: {
    marginTop: 2,
  },
});
