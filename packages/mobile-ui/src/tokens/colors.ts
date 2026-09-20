/**
 * Neutral, accessible color design tokens for TorangGo mobile apps.
 * Avoids deep brand coupling while providing a cohesive, modern commerce palette.
 */
export const colors = {
  // Brand / Action
  primary: '#0284c7',       // Sky blue / ocean primary
  primaryDark: '#0369a1',
  primaryLight: '#e0f2fe',
  secondary: '#0f172a',     // Slate dark
  secondaryLight: '#f1f5f9',

  // Surfaces & Backgrounds
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceSubtle: '#f1f5f9',
  surfaceHover: '#e2e8f0',

  // Text
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',

  // Borders
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderFocus: '#0284c7',

  // Semantic Status
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#d97706',
  warningLight: '#fef3c7',
  error: '#dc2626',
  errorLight: '#fee2e2',
  info: '#2563eb',
  infoLight: '#dbeafe',
  neutral: '#64748b',
  neutralLight: '#f1f5f9',
} as const;

export type ColorToken = keyof typeof colors;
