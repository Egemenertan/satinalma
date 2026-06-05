import { StyleSheet } from 'react-native'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../components/island/islandTokens'
import { stats, statsType } from './statsDesignTokens'

/** Talepler listesi (`requests/index`) ile aynı yatay ritim ve üst bilgi stili */
export const requestDetailLayout = StyleSheet.create({
  screenScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 36 + ISLAND_BOTTOM_BAR_CONTENT_INSET,
  },
  topMeta: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: '#111827',
    letterSpacing: -0.5,
  },
  pageMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  itBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  itBannerText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
})
