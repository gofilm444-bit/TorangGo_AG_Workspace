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
  Button,
} from '@platform/mobile-ui';
import { useCustomerAuth } from '../../../src/auth/auth-context.js';

export default function CustomerAccountScreen() {
  const { user, logout } = useCustomerAuth();

  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Akun Pengguna
        </AppText>
        <StatusBadge label="Mode Tamu" variant="neutral" />
        <StatusBadge label={user ? 'Terautentikasi' : 'Belum Masuk'} variant={user ? 'success' : 'neutral'} />
      </View>

      <Card variant="default" style={styles.card}>
        <AppText variant="label" color="text">
          Status Akun: Belum Masuk (Unauthenticated Shell)
          Nomor Handphone: {user?.phone ?? '-'}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Sistem autentikasi lengkap (OTP, token identitas, dan profil pengguna)
          akan diimplementasikan pada Fase 1G sesuai spesifikasi arsitektur.
          Status Akun: {user?.status ?? 'ACTIVE'} (Audience: CUSTOMER_APP)
        </AppText>
        {user ? (
          <Button
            title="Keluar (Logout)"
            variant="outline"
            onPress={logout}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
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
