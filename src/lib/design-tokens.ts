// Design tokens for use in JS contexts (recharts, dynamic styles, etc.)
// Keep in sync with globals.css @theme

export const colors = {
  // backgrounds
  base: '#0E0E11',
  surface: '#16161A',
  elevated: '#1C1C21',
  hover: '#222228',
  borderSubtle: '#26262C',
  borderStrong: '#33333B',

  // accent violet
  accent: '#7C72E8',
  accentHover: '#8F86F0',
  accentText: '#A9A2F2',

  // text
  textPrimary: '#EDEDEF',
  textSecondary: '#A0A0A8',
  textTertiary: '#62626B',
  textDisabled: '#44444C',

  // semantic
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
} as const

// Recharts-specific color palette
export const chartColors = {
  primary: colors.accent,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  grid: colors.borderSubtle,
  axis: colors.textTertiary,
  tooltipBg: colors.elevated,
  tooltipBorder: colors.borderSubtle,
  tooltipText: colors.textPrimary,
} as const
