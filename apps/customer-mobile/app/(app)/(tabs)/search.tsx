import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Screen,
  AppText,
  Input,
  EmptyState,
  spacing,
} from '@platform/mobile-ui';

export default function CustomerSearchScreen() {
  const [query, setQuery] = useState('');

  return (
    <Screen padding="md">
      <View style={styles.header}>
        <AppText variant="h2" color="text">
          Pencarian Makanan
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          Temukan makanan favoritmu di Manado
        </AppText>
      </View>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Cari makanan, minuman, atau resto..."
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <EmptyState
        title="Mulai Cari Makanan"
        description="Ketik kata kunci nama makanan atau tempat makan untuk memulai pencarian."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  subtitle: {
    marginTop: 2,
  },
});
