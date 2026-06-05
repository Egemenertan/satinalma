import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePathname, useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type MaterialGlyph = ComponentProps<typeof MaterialIcons>['name']

const ICON_OFF = '#ffffff'
const ICON_ON = '#01E884'
const ICON_WHITE = '#ffffff'

function TabGlyph({
  name,
  nameActive,
  active,
  size,
  style,
  colorOff,
  colorOn,
}: {
  name: MaterialGlyph
  nameActive?: MaterialGlyph
  active: boolean
  size: number
  style?: ComponentProps<typeof MaterialIcons>['style']
  colorOff?: string
  colorOn?: string
}) {
  const glyph = active && nameActive ? nameActive : name
  const offColor = colorOff ?? ICON_OFF
  const onColor = colorOn ?? ICON_ON
  return <MaterialIcons name={glyph} size={size} color={active ? onColor : offColor} style={style} />
}

/** Kök sekmeler: push yerine dismissTo — üst üste aynı liste birikmez, geri/profilsiz “hayalet” ekran oluşmaz */
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

/** Alt nave: siyah yüzen ada; wrap şeffaf — sadece ada görünür, alt güvenli alan arkada içerik görünür */
const RADIUS_MD = 999
const BAR_BG = '#000000'
const SIDE_INSET = 20

export function IslandBottomBar() {
  const router = useRouter()
  const path = usePathname()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const active: TabKey = path.includes('profile') ? 'profile' : path.includes('create') ? 'create' : 'list'

  const bottomPad = Math.max(insets.bottom, 12)

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View style={[styles.island, styles.islandNarrow]} accessibilityRole="tablist">
        <Pressable
          style={({ pressed }) => [styles.tab, active === 'list' && styles.tabActive, pressed && styles.tabPressed]}
          onPress={() => goRequestsTab(router)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'list' }}
        >
          <TabGlyph name="assignment" active={active === 'list'} size={24} />
          <Text style={[styles.tabLabel, active === 'list' && styles.tabLabelOn]}>{t('tabs.requests')}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.tab, active === 'create' && styles.tabActive, pressed && styles.tabPressed]}
          onPress={() => goCreateTab(router)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'create' }}
        >
          <TabGlyph
            name="add-circle-outline"
            nameActive="add-circle"
            active={active === 'create'}
            size={24}
            colorOff={ICON_WHITE}
            colorOn={ICON_ON}
          />
          <Text style={[styles.tabLabel, active === 'create' && styles.tabLabelOn]}>
            {t('tabs.newRequest')}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.tab, active === 'profile' && styles.tabActive, pressed && styles.tabPressed]}
          onPress={() => goProfileTab(router)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === 'profile' }}
        >
          <TabGlyph name="person-outline" nameActive="person" active={active === 'profile'} size={24} />
          <Text style={[styles.tabLabel, active === 'profile' && styles.tabLabelOn]}>{t('tabs.profile')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: SIDE_INSET,
    backgroundColor: 'transparent',
  },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderRadius: RADIUS_MD,
    padding: 5,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: {
        elevation: 0,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.14)',
      },
      default: { elevation: 0 },
    }),
  },
  islandNarrow: {
    maxWidth: 380,
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    gap: 2,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 9999,
  },
  tabCreateDefault: {
    backgroundColor: '#ffffff',
    borderRadius: 9999,
  },
  tabActiveCreate: {
    backgroundColor: 'rgba(1, 232, 132, 0.2)',
    borderRadius: 9999,
  },
  tabPressed: {
    opacity: 0.92,
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
  tabLabelWhite: {
    color: '#ffffff',
  },
  tabLabelDark: {
    color: '#111827',
  },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    marginVertical: 8,
  },
})
