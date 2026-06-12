import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePathname, useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type MaterialGlyph = ComponentProps<typeof MaterialIcons>['name']

const ICON_OFF = '#ffffff'
const ICON_ON = '#01E884'

function TabGlyph({
  name,
  nameActive,
  active,
  size,
  colorOff,
  colorOn,
}: {
  name: MaterialGlyph
  nameActive?: MaterialGlyph
  active: boolean
  size: number
  colorOff?: string
  colorOn?: string
}) {
  const glyph = active && nameActive ? nameActive : name
  const offColor = colorOff ?? ICON_OFF
  const onColor = colorOn ?? ICON_ON
  return <MaterialIcons name={glyph} size={size} color={active ? onColor : offColor} />
}

function goRequestsTab(router: ReturnType<typeof useRouter>) {
  router.dismissTo('/(app)/requests')
}

function goCreateTab(router: ReturnType<typeof useRouter>) {
  router.push('/(app)/requests/create')
}

function goProfileTab(router: ReturnType<typeof useRouter>) {
  router.push('/(app)/profile')
}

type TabKey = 'list' | 'create' | 'profile'

const RADIUS_PILL = 999
const BAR_BG = '#000000'
const SIDE_INSET = 16
const GAP = 10
const PRIMARY_GREEN = '#01E884'

export function IslandBottomBar() {
  const router = useRouter()
  const path = usePathname()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const active: TabKey = path.includes('profile') ? 'profile' : path.includes('create') ? 'create' : 'list'

  const bottomPad = Math.max(insets.bottom, 12)

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      {/* Sol: Tab bar (Talepler + Profil) */}
      <View style={styles.island} accessibilityRole="tablist">
        <Pressable
          style={({ pressed }) => [styles.tab, active === 'list' && styles.tabActive, pressed && styles.tabPressed]}
          onPress={() => goRequestsTab(router)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'list' }}
        >
          <TabGlyph name="assignment" active={active === 'list'} size={22} />
          <Text style={[styles.tabLabel, active === 'list' && styles.tabLabelOn]}>{t('tabs.requests')}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.tab, active === 'profile' && styles.tabActive, pressed && styles.tabPressed]}
          onPress={() => goProfileTab(router)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'profile' }}
        >
          <TabGlyph name="person-outline" nameActive="person" active={active === 'profile'} size={22} />
          <Text style={[styles.tabLabel, active === 'profile' && styles.tabLabelOn]}>{t('tabs.profile')}</Text>
        </Pressable>
      </View>

      {/* Sağ: Yeni Talep Pill Button */}
      <Pressable
        style={({ pressed }) => [
          styles.createPill,
          active === 'create' && styles.createPillActive,
          pressed && styles.createPillPressed,
        ]}
        onPress={() => goCreateTab(router)}
        accessibilityRole="button"
        accessibilityLabel={t('tabs.newRequest')}
      >
        <MaterialIcons name="add" size={24} color="#000000" />
        <Text style={styles.createPillText}>{t('tabs.newRequest')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE_INSET,
    backgroundColor: 'transparent',
    gap: GAP,
  },
  island: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderRadius: RADIUS_PILL,
    paddingVertical: 3,
    paddingHorizontal: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
      default: { elevation: 0 },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS_PILL,
    gap: 1,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabPressed: {
    opacity: 0.85,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  tabLabelOn: {
    color: '#ffffff',
  },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    marginVertical: 6,
  },
  createPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 4,
    backgroundColor: PRIMARY_GREEN,
    borderRadius: RADIUS_PILL,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY_GREEN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: { elevation: 0 },
    }),
  },
  createPillActive: {
    backgroundColor: '#00cc75',
  },
  createPillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  createPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
  },
})
