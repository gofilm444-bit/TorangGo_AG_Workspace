import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function MerchantOrdersScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Pesanan Masuk
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Kelola pesanan pelanggan secara langsung
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Pesanan Masuk"
        description="Pesanan baru dari pelanggan TorangGo akan muncul di sini secara langsung untuk segera diproses."
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
