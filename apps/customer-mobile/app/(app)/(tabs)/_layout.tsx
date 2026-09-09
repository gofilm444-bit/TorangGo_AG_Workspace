import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@platform/mobile-ui';

export default function TabLayout() {
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
        name="search"
        options={{
          title: 'Cari',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pesanan',
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
