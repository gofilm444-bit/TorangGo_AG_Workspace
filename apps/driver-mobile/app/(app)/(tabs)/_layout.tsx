import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@platform/mobile-ui';

export default function DriverTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Beranda',
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Aktivitas',
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Pendapatan',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Akun',
        }}
      />
    </Tabs>
  );
}
