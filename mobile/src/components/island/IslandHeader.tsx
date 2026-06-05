import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { islandTokens } from './islandTokens'

const LogoImage = require('../../../assets/dld.png')

export type IslandHeaderProps = {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  rightSlot?: ReactNode
  compact?: boolean
  /** Kök ekranlar: geri yokken logo + bildirim butonu gösterilir */
  userDisplayName?: string | null
  onNotificationsPress?: () => void
  /** Okunmamış gelen kutusu sayısı (0 ise rozet gösterilmez) */
  notificationUnreadCount?: number
}

export function IslandHeader({
  title,
  subtitle,
  showBack,
  onBack,
  rightSlot,
  compact,
  userDisplayName,
  onNotificationsPress,
  notificationUnreadCount = 0,
}: IslandHeaderProps) {
  const { t } = useTranslation()
  const showProfile = Boolean(userDisplayName && !showBack)

  if (showProfile) {
    return (
      <View style={[styles.outer, compact && styles.outerCompact]}>
        <View style={styles.row}>
          {/* Logo */}
          <Image source={LogoImage} style={styles.logo} resizeMode="contain" />
          <View style={styles.flex1} />
          <View style={styles.rightActions}>
            {rightSlot ? <View style={styles.rightWrap}>{rightSlot}</View> : null}
            {onNotificationsPress ? (
              <Pressable
                onPress={onNotificationsPress}
                hitSlop={8}
                style={({ pressed }) => [styles.notifIconBtn, pressed && { opacity: 0.82 }]}
                accessibilityRole="button"
                accessibilityLabel={t('island.notificationsA11y')}
              >
                <MaterialIcons name="notifications" size={22} color="#111827" />
                {notificationUnreadCount > 0 ? (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>
        {subtitle ? (
          <Text style={styles.subtitleUnder} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.outer, compact && styles.outerCompact]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={({ pressed }) => [styles.backPlain, pressed && styles.backPlainPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.goBack')}
            >
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.sideSpacer} />
          )}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.sideEnd]}>{rightSlot ?? <View style={styles.sideSpacer} />}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  outerCompact: {
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  flex1: { flex: 1 },
  logo: {
    height: 32,
    width: 90,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  notifIconBtn: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#01E884',
    borderWidth: 0,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  rightWrap: {
    marginLeft: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  subtitleUnder: {
    marginTop: 4,
    fontSize: 12,
    color: islandTokens.muted,
    fontWeight: '500',
  },
  side: {
    minWidth: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  sideSpacer: {
    width: 36,
    height: 36,
  },
  backPlain: {
    paddingVertical: 4,
    paddingRight: 8,
    marginLeft: -4,
  },
  backPlainPressed: {
    opacity: 0.55,
  },
  backChevron: {
    fontSize: 32,
    fontWeight: '300',
    color: islandTokens.text,
    marginTop: -2,
    lineHeight: 34,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: islandTokens.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: islandTokens.muted,
  },
})
