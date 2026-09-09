import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  Card,
  SectionHeader,
  StatusBadge,
  spacing,
} from '@platform/mobile-ui';

export default function CustomerHomeScreen() {
  return (
    <Screen padding="md">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <AppText variant="caption" color="textSecondary">
            Lokasi Pengantaran
          </AppText>
          <AppText variant="h3" color="text">
            Manado & Sekitarnya
          </AppText>
        </View>
        <StatusBadge label="Fase 1E Shell" variant="info" />
      </View>

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <AppText variant="h1" color="text">
          Halo, TorangPe Teman!
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.greetingSubtitle}>
          Mau pesan makanan apa hari ini di Manado?
        </AppText>
      </View>

      {/* Architecture / Development Info Card */}
      <Card variant="subtle" style={styles.card}>
        <AppText variant="label" color="primary">
          Informasi Pengembangan
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.cardText}>
          Aplikasi Customer Mobile berjalan dalam mode unauthenticated shell.
          Autentikasi (Fase 1G), katalog produk, dan pemesanan akan diintegrasikan
          secara bertahap tanpa data tiruan.
        </AppText>
      </Card>

      {/* MVP Service Highlight */}
      <SectionHeader
        title="Layanan Tersedia"
        subtitle="Fokus MVP aktif"
      />
      <Card variant="default" style={styles.card}>
        <View style={styles.serviceRow}>
          <View style={styles.serviceIcon}>
            <AppText variant="h2">🍽️</AppText>
          </View>
          <View style={styles.serviceInfo}>
            <AppText variant="h3" color="text">
              Pesan Antar Makanan (Food Delivery)
            </AppText>
            <AppText variant="bodySmall" color="textSecondary">
              Katalog resto dan kuliner lokal Manado segera hadir.
            </AppText>
          </View>
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
  greetingSection: {
    marginBottom: spacing.lg,
  },
  greetingSubtitle: {
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardText: {
    marginTop: spacing.xs,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
});
