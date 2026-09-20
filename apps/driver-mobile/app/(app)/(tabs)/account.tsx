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
import { useDriverAuth } from '../../../src/auth/auth-context';

export default function DriverAccountScreen() {
  const { user, logout } = useDriverAuth();

  const hasProfile = !!user?.driver_profile;
  const profileStatus = user?.driver_profile?.status ?? 'BELUM_TERSEDIA';
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
          Akun Pengemudi
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
              Nama Pengemudi: {user?.driver_profile?.full_name ?? '(Belum Terdaftar)'}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
              Status Akun Pengguna: {user?.status ?? 'ACTIVE'} | Status Profil: {profileStatus}
            </AppText>
            {profileStatus !== 'APPROVED' ? (
              <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                Catatan: Hanya profil dengan status APPROVED yang dapat menerima order dan operasional delivery di fase mendatang.
              </AppText>
            ) : null}
          </>
        ) : (
          <View style={{ marginTop: spacing.xs }}>
            <AppText variant="bodySmall" color="warning" style={styles.cardText}>
              Profil driver belum tersedia. Onboarding belum dilakukan.
            </AppText>
            <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              Pendaftaran verifikasi mitra pengemudi akan diproses pada alur onboarding Fase 2.
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

      <SectionHeader title="Spesifikasi Fondasi Driver" />
      <Card variant="subtle" style={styles.card}>
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Izin Latar Belakang (Lokasi)
          </AppText>
          <AppText variant="label" color="textMuted">
            Belum Diminta (Dev-Build Ready)
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Komponen Peta (Maps)
          </AppText>
          <AppText variant="label" color="textMuted">
            Belum Terpasang (Scope Lock)
          </AppText>
        </View>
        <Divider marginVertical="sm" />
        <View style={styles.infoRow}>
          <AppText variant="bodySmall" color="textSecondary">
            Target Audiens
          </AppText>
          <AppText variant="label" color="primary">
            DRIVER_APP
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
