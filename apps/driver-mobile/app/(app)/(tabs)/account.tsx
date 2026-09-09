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

export default function DriverAccountScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Akun Pengemudi
        </AppText>
        <StatusBadge label="Mode Shell" variant="neutral" />
      </View>

      <Card variant="default" style={styles.card}>
        <AppText variant="label" color="text">
          Status Akun: Belum Terautentikasi (Shell Fase 1E)
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Verifikasi identitas pengemudi, pendaftaran kendaraan, dan aktivasi akun
          akan diimplementasikan pada Fase 1G.
        </AppText>
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
