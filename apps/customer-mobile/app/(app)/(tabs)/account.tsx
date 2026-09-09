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

export default function CustomerAccountScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Akun Pengguna
        </AppText>
        <StatusBadge label="Mode Tamu" variant="neutral" />
      </View>

      <Card variant="default" style={styles.card}>
        <AppText variant="label" color="text">
          Status Akun: Belum Masuk (Unauthenticated Shell)
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Sistem autentikasi lengkap (OTP, token identitas, dan profil pengguna)
          akan diimplementasikan pada Fase 1G sesuai spesifikasi arsitektur.
        </AppText>
      </Card>

      <SectionHeader title="Tentang Aplikasi" />
      <Card variant="subtle" style={styles.card}>
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Aplikasi
          </AppText>
          <AppText variant="label" color="text">
            TorangGo Customer
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Versi
          </AppText>
          <AppText variant="label" color="text">
            1.0.0 (Fase 1E Shell)
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Target Audiens
          </AppText>
          <AppText variant="label" color="primary">
            CUSTOMER_APP
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
