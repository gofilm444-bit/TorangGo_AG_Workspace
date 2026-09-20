import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { spacing } from '../tokens/spacing.js';

export interface DividerProps {
  marginVertical?: keyof typeof spacing;
  color?: keyof typeof colors;
  style?: ViewStyle;
}

export function Divider({
  marginVertical = 'md',
  color = 'border',
  style,
}: DividerProps) {
  return (
    <View
      style={[
        styles.divider,
        {
          marginVertical: spacing[marginVertical],
          backgroundColor: colors[color],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
});
