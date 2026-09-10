import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { QueryProvider } from '@platform/mobile-ui';
import { MerchantAuthProvider } from '../src/auth/auth-context';

export default function RootLayout() {
  return (
    <QueryProvider>
      <MerchantAuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(app)" />
        </Stack>
      </MerchantAuthProvider>
    </QueryProvider>
  );
}
