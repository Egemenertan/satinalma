import { Platform, StyleSheet } from 'react-native'

/**
 * Stitch / Material-3-expressive stili: nötr tuval, yüksek yüzey, yumuşak elevation.
 * MCP ile .stitch/DESIGN.md üretildiğinde bu dosya tek kaynak olarak güncellenebilir.
 */
export const stitchTokens = {
  canvas: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceDim: '#EEF1F6',
  onSurface: '#1B1B1F',
  onSurfaceVariant: '#44474E',
  outline: 'rgba(27, 27, 31, 0.12)',
  outlineVariant: 'rgba(27, 27, 31, 0.08)',
  primary: '#01E884',
  onPrimary: '#FFFFFF',
  primaryContainer: 'rgba(0, 230, 118, 0.14)',
  secondary: '#1565C0',
  secondaryContainer: 'rgba(21, 101, 192, 0.12)',
  error: '#B3261E',
  errorContainer: '#F9DEDC',
  radiusXs: 8,
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusFull: 999,
  /** Başlık / gövde ölçekleri (RN system font) */
  type: {
    display: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
    title: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    bodyMedium: { fontSize: 14, fontWeight: '500' as const },
    label: { fontSize: 12, fontWeight: '600' as const },
    micro: { fontSize: 11, fontWeight: '600' as const },
  },
  shadowCard: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 2 },
    default: { elevation: 2 },
  }),
  shadowLift: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
} as const

export const stitchCard = StyleSheet.create({
  base: {
    backgroundColor: stitchTokens.surface,
    borderRadius: stitchTokens.radiusMd,
    borderWidth: 1,
    borderColor: stitchTokens.outlineVariant,
    ...stitchTokens.shadowCard,
  },
})

export const stitchFilledField = StyleSheet.create({
  base: {
    backgroundColor: stitchTokens.surfaceDim,
    borderRadius: stitchTokens.radiusSm,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
})
