import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { QueryProvider } from '@platform/mobile-ui';
import { DriverAuthProvider } from '../src/auth/auth-context';

export default function RootLayout() {
  return (
    <QueryProvider>
      <DriverAuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(app)" />
        </Stack>
      </DriverAuthProvider>
    </QueryProvider>
  );
}
