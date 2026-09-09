import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function MerchantProductsScreen() {
  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Katalog Produk
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Menu dan persediaan produk outlet
        </AppText>
      </View>

      <EmptyState
        title="Belum Ada Produk Terdaftar"
        description="Daftar menu dan produk outlet Anda akan dikelola di sini pada fase katalog produk."
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
