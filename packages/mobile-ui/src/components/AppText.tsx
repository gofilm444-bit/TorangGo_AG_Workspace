import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors } from '../tokens/colors.js';
import { typography, type TypographyVariant } from '../tokens/typography.js';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof typeof colors;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  children?: React.ReactNode;
}

export function AppText({
  variant = 'body',
  color = 'text',
  align = 'left',
  style,
  children,
  ...rest
}: AppTextProps) {
  const variantStyle = typography[variant] ?? typography.body;
  const textColor = colors[color] ?? colors.text;

  const combinedStyle: TextStyle = {
    ...variantStyle,
    color: textColor,
    textAlign: align,
  };

  return (
    <Text style={[combinedStyle, style]} accessibilityRole="text" {...rest}>
      {children}
    </Text>
  );
}
