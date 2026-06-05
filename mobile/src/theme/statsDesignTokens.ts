import { Platform, StyleSheet } from 'react-native'

/**
 * Talepler / istatistik teması. Yeşil web ile uyumlu: `src/app/dashboard/requests/page.tsx` (#01E884).
 */
export const stats = {
  surfaceBright: '#ffffff',
  background: '#ffffff',
  surface: '#ffffff',
  surfaceContainerLow: '#f3f4f3',
  surfaceContainer: '#edeeed',
  surfaceContainerHighest: '#e1e3e2',
  surfaceContainerLowest: '#ffffff',
  /** Web marka yeşili */
  primary: '#01E884',
  /** Web buton hover */
  primaryHover: '#00c46a',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#065f46',
  /** Açık yeşil yüzey (rozet / vurgu) */
  primaryContainer: '#d1fae5',
  onSurface: '#191c1c',
  onSurfaceVariant: '#41493e',
  outline: '#717a6d',
  outlineVariant: '#c0c9ba',
  secondary: '#5e5e5e',
  secondaryContainer: '#e2e2e2',
  onSecondaryContainer: '#646464',
  tertiary: '#556156',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  inverseSurface: '#2e3131',
  radiusLg: 12,
  radiusXl: 16,
  radiusFull: 9999,
  gutter: 16,
  marginMobile: 20,
  shadowSm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: { elevation: 2 },
  }),
} as const

/** Plus Jakarta yüklemesi yapılmadan önce fallback */
export const statsFont = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const

export const statsType = {
  headlineLgMobile: {
    fontFamily: statsFont.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
  },
  bodyMd: {
    fontFamily: statsFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyLg: {
    fontFamily: statsFont.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  labelMd: {
    fontFamily: statsFont.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
  },
  labelSm: {
    fontFamily: statsFont.medium,
    fontSize: 11,
    lineHeight: 14,
  },
}

export const statsCardSurface = StyleSheet.create({
  bento: {
    backgroundColor: stats.surfaceContainerLow,
    borderRadius: stats.radiusXl,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    ...(stats.shadowSm ?? {}),
  },
  listItem: {
    backgroundColor: stats.surfaceContainerLowest,
    borderRadius: stats.radiusXl,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    ...(stats.shadowSm ?? {}),
  },
})
