export const Colors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  primary: '#C8FF00',
  primaryMuted: '#C8FF0020',
  text: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#444444',
  error: '#FF4444',
  success: '#00C851',
  border: '#2A2A2A',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
