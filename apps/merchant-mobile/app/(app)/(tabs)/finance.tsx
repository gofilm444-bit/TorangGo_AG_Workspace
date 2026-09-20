import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function MerchantFinanceScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Keuangan Outlet
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Ringkasan saldo dan riwayat pencairan dana
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Riwayat Keuangan"
        description="Riwayat transaksi penjualan, komisi platform, dan penarikan dana akan ditampilkan di sini tanpa data fiktif."
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
