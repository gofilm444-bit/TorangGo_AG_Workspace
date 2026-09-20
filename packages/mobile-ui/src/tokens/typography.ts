import type { TextStyle } from 'react-native';

/**
 * Typography design tokens with standard mobile font sizes, line heights, and weights.
 */
export const typography = {
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  } as TextStyle,
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  } as TextStyle,
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  } as TextStyle,
  bodyLarge: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  } as TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  } as TextStyle,
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } as TextStyle,
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  } as TextStyle,
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  } as TextStyle,
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  } as TextStyle,
} as const;

export type TypographyVariant = keyof typeof typography;
