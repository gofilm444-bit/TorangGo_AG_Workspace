import { Redirect } from 'expo-router';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useCustomerAuth } from '../src/auth/auth-context.js';
import { CustomerAuthScreen } from '../src/auth/auth-screen.js';
import { colors } from '@platform/mobile-ui';

export default function Index() {
  const { status } = useCustomerAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <CustomerAuthScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
