import { Redirect } from 'expo-router';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useDriverAuth } from '../src/auth/auth-context';
import { DriverAuthScreen } from '../src/auth/auth-screen';
import { colors } from '@platform/mobile-ui';

export default function Index() {
  const { status } = useDriverAuth();

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

  return <DriverAuthScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
