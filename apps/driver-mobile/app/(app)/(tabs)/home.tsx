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

export default function DriverHomeScreen() {
  return (
    <Screen padding="md">
      {/* Status Header */}
      <View style={styles.header}>
        <View>
          <AppText variant="caption" color="textSecondary">
            Area Operasi
          </AppText>
          <AppText variant="h3" color="text">
            Manado Raya
          </AppText>
        </View>
        <StatusBadge label="Offline (Shell)" variant="neutral" />
      </View>

      {/* Driver Dev-Build-First Card */}
      <Card variant="subtle" style={styles.card}>
        <AppText variant="label" color="primary">
          Driver Dev-Build-First
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Aplikasi pengemudi siap untuk alur pengembangan native Expo.
          Tidak ada izin lokasi latar belakang, kamera, notifikasi, maupun peta
          yang diminta pada fase fondasi shell ini.
        </AppText>
      </Card>

      {/* Order Opportunity Placeholder */}
      <SectionHeader
        title="Peluang Orderan"
        subtitle="Mencari pesanan pengantaran aktif"
      />

      <EmptyState
        title="Belum Ada Orderan Masuk"
        description="Aktifkan status penerimaan order saat sistem penugasan pengemudi (dispatch) siap pada fase berikutnya."
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
