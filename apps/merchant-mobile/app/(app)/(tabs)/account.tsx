import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  Card,
  SectionHeader,
  StatusBadge,
  spacing,
  Divider,
} from '@platform/mobile-ui';

export default function MerchantAccountScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Akun Merchant
        </AppText>
        <StatusBadge label="Mode Shell" variant="neutral" />
      </View>

      <Card variant="default" style={styles.card}>
        <AppText variant="label" color="text">
          Status Akun: Belum Terautentikasi (Shell Fase 1E)
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Login merchant, autentikasi berbasis OTP/identitas, dan verifikasi profil
          akan diimplementasikan pada Fase 1G.
        </AppText>
      </Card>

      <SectionHeader title="Informasi Model Bisnis" />
      <Card variant="subtle" style={styles.card}>
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Struktur Usaha
          </AppText>
          <AppText variant="label" color="text">
            1 Merchant = 1 Usaha = 1 Outlet
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Multi-Outlet / Franchise
          </AppText>
          <AppText variant="label" color="textMuted">
            Tidak Diaktifkan (Scope Lock)
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Target Audiens
          </AppText>
          <AppText variant="label" color="primary">
            MERCHANT_APP
          </AppText>
        </View>
      </Card>
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
