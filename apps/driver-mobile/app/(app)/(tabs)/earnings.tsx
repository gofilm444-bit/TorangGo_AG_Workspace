import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function DriverEarningsScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Pendapatan Mitra
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Ringkasan komisi dan hasil pengantaran
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Pendapatan Hari Ini"
        description="Hasil ongkos kirim dan tip yang Anda peroleh hari ini akan ditampilkan di sini."
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
