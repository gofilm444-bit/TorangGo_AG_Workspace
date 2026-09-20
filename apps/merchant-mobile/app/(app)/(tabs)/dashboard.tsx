import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  Card,
  SectionHeader,
  StatusBadge,
  spacing,
  EmptyState,
} from '@platform/mobile-ui';

export default function MerchantDashboardScreen() {
  return (
    <Screen padding="md">
      {/* Outlet Header */}
      <View style={styles.header}>
        <View>
          <AppText variant="caption" color="textSecondary">
            Outlet Aktif (Single Outlet)
          </AppText>
          <AppText variant="h3" color="text">
            TorangGo Mitra
          </AppText>
        </View>
        <StatusBadge label="DEMO / PLACEHOLDER" variant="neutral" />
      </View>

      {/* Development Status Card */}
      <Card variant="subtle" style={styles.card}>
        <AppText variant="label" color="primary">
          Fase 1E: Merchant App Shell
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Aplikasi merchant beroperasi dalam model outlet tunggal (1 merchant = 1 usaha = 1 outlet).
          Tidak ada switcher multi-outlet maupun fitur franchise. Angka metrik tidak direkayasa
          sebagai data riil.
        </AppText>
      </Card>

      {/* Metrics Section */}
      <SectionHeader
        title="Ringkasan Penjualan Hari Ini"
        subtitle="Data langsung dari outlet"
      />

      <EmptyState
        title="Belum Ada Aktivitas Penjualan"
        description="Statistik penjualan harian, jumlah pesanan, dan pendapatan bersih akan ditampilkan di sini saat toko aktif beroperasi."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardText: {
    marginTop: spacing.xs,
  },
});
