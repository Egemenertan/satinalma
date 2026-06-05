import { Platform, StyleSheet } from 'react-native'

/**
 * Alt yüzen tab bar + home indicator için içerik alt boşluğu.
 * Stack’te `paddingBottom` kullanmak yerine scroll/list `contentContainerStyle` ile verilir;
 * böylece ekstra opak “şerit” oluşmaz, içerik adağın arkasında süzülür.
 */
export const ISLAND_BOTTOM_BAR_CONTENT_INSET = 108

/** Yüzen tab adasının yaklaşık yüksekliği + sepet FAB ile ada arası boşluk (safe area hariç). */
export const ISLAND_CART_BAR_CLEARANCE = 72

/** Ortak “Dynamic Island” hissi: yumuşak hap, hafif cam, üst üste binen gölge */
export const islandTokens = {
  pillRadius: 32,
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  androidElevation: 12,
  border: 'rgba(15, 23, 42, 0.08)',
  fill: 'rgba(255, 255, 255, 0.94)',
  fillActive: 'rgba(1, 232, 132, 0.14)',
  accent: '#01E884',
  muted: '#64748b',
  text: '#0f172a',
  /** Alt bar: sayfa içeriği hafif görünsün (yüzen ada) */
  fillGlass: 'rgba(255, 255, 255, 0.72)',
  borderGlass: 'rgba(15, 23, 42, 0.1)',
  iosShadowLift: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  androidElevationLift: 14,
} as const

export const islandPill = StyleSheet.create({
  base: {
    backgroundColor: islandTokens.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: islandTokens.border,
    borderRadius: islandTokens.pillRadius,
    ...Platform.select({
      ios: { ...islandTokens.iosShadow },
      android: { elevation: islandTokens.androidElevation },
      default: { elevation: islandTokens.androidElevation },
    }),
  },
})

/** Bottom bar: arka plan şeffaf, sadece hap; içerik arkadan süzülür */
export const islandBottomFloatingPill = StyleSheet.create({
  base: {
    backgroundColor: islandTokens.fillGlass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: islandTokens.borderGlass,
    borderRadius: islandTokens.pillRadius,
    ...Platform.select({
      ios: { ...islandTokens.iosShadowLift },
      android: { elevation: islandTokens.androidElevationLift },
      default: { elevation: islandTokens.androidElevationLift },
    }),
  },
})
