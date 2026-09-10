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
import { useMerchantAuth } from '../../../src/auth/auth-context';

export default function MerchantAccountScreen() {
  const { user, logout } = useMerchantAuth();

  const hasProfile = !!user?.merchant_profile;
  const profileStatus = user?.merchant_profile?.status ?? 'BELUM_TERSEDIA';
  const badgeVariant =
    profileStatus === 'APPROVED'
      ? 'success'
      : profileStatus === 'PENDING'
        ? 'warning'
        : 'neutral';

  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Akun Merchant
        </AppText>
        <StatusBadge label={hasProfile ? profileStatus : 'BELUM TERSEDIA'} variant={badgeVariant} />
      </View>

      <Card variant="default" style={styles.card}>
        <AppText variant="label" color="text">
          Nomor Handphone: {user?.phone ?? '-'}
        </AppText>
        {hasProfile ? (
          <>
            <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
              Nama Usaha: {user?.merchant_profile?.business_name ?? '(Belum Terdaftar)'}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
              Status Akun Pengguna: {user?.status ?? 'ACTIVE'} | Status Profil: {profileStatus}
            </AppText>
            {profileStatus !== 'APPROVED' ? (
              <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                Catatan: Hanya profil dengan status APPROVED yang dapat melakukan aksi operasional bisnis pada fase mendatang.
              </AppText>
            ) : null}
          </>
        ) : (
          <View style={{ marginTop: spacing.xs }}>
            <AppText variant="bodySmall" color="warning" style={styles.cardText}>
              Profil merchant belum tersedia. Onboarding belum dilakukan.
            </AppText>
            <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              Pendaftaran profil usaha merchant akan diproses pada alur onboarding Fase 2.
            </AppText>
          </View>
        )}
        {user ? (
          <Button
            title="Keluar (Logout)"
            variant="outline"
            onPress={logout}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
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
