import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function CustomerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TorangGo</Text>
      <Text style={styles.subtitle}>Customer App</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#334155',
    marginBottom: 16,
  },
  badge: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    overflow: 'hidden',
  },
});
