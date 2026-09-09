import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@platform/mobile-ui';

export default function MerchantTabLayout() {
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
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pesanan',
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Produk',
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Keuangan',
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
