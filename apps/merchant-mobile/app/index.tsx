import { Redirect } from 'expo-router';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useMerchantAuth } from '../src/auth/auth-context.js';
import { MerchantAuthScreen } from '../src/auth/auth-screen.js';
import { colors } from '@platform/mobile-ui';

export default function Index() {
  const { status } = useMerchantAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)/dashboard" />;
  }

  return <MerchantAuthScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
