import { Stack } from 'expo-router';
import React from 'react';
import { OnboardingProvider } from '../../src/onboarding/onboarding-context';
import { OnboardingGate } from '../../src/onboarding/onboarding-gate';

export default function AppLayout() {
  return (
    <OnboardingProvider>
      <OnboardingGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </OnboardingGate>
    </OnboardingProvider>
  );
}
