// Design tokens for the TezRecovery-derived visual system.
//
// PROVISIONAL: the source design (TezRecovery_Light__standalone_.html) is a
// compiled bundle with no extractable source text (confirmed in Phase 0 — see
// frontend-docs/DESIGN-MAPPING.md). Only three colors were directly confirmed
// from the bundle's own visible markup + prior screenshot review: primary,
// background, ink. Everything else below is a reasonable derived scale, not a
// pixel-measured value — re-verify against a live render of the HTML before
// treating this file as locked (see architecture-baseline.md §5.7).

export const colors = {
  // Confirmed
  primary: '#F5A623',
  background: '#F4F2EE',
  ink: '#14161A',

  // Derived — provisional
  primaryMuted: '#FCE7C2',
  surface: '#FFFFFF',
  border: '#E4E0D8',
  inkMuted: '#6B6F76',
  success: '#2E8B57',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

export const typography = {
  fontFamily: undefined, // platform default until the design's actual typeface is confirmed
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const elevation = {
  none: 0,
  low: 2,
  medium: 6,
  high: 12,
} as const;
