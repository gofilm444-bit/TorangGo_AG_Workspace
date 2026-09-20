/**
 * Spacing design tokens (in pixels) for consistent layout and padding.
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;
