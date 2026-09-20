import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function CustomerOrdersScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Pesanan Saya
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Riwayat dan status pemesanan aktif
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Pesanan"
        description="Anda belum memiliki pesanan aktif maupun selesai. Pesanan makanan Anda akan muncul di sini."
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
