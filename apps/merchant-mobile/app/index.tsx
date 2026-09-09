import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MerchantScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TorangGo Merchant</Text>
      <Text style={styles.badge}>Foundation Ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  badge: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '600',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    overflow: 'hidden',
  },
});
