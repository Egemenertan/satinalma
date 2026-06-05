import { getHeaderTitle } from '@react-navigation/elements'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { ProfileRow } from '../../lib/purchaseRequestsQuery'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../providers/AuthProvider'
import { IslandHeader } from './IslandHeader'

function profileDisplayName(profile: ProfileRow | null, t: TFunction, localeTag: string): string {
  if (!profile) return t('common.user')
  const fn = profile.full_name?.trim()
  if (fn) return fn
  const em = profile.email?.trim()
  if (em) {
    return em
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toLocaleUpperCase(localeTag) + w.slice(1).toLowerCase())
      .join(' ')
  }
  return t('common.user')
}

export function IslandStackHeader({ navigation, route, options, back }: NativeStackHeaderProps) {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const localeTag = i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'
  const title = getHeaderTitle(options, route.name)
  const showBack = back != null
  const headerStyle = options.headerStyle as { backgroundColor?: string } | undefined
  const safeBg = headerStyle?.backgroundColor ?? 'transparent'
  const { profile, user } = useAuth()
  const userDisplayName = showBack ? undefined : profileDisplayName(profile, t, localeTag)

  const { data: notificationUnreadCount = 0 } = useQuery({
    queryKey: ['notif_unread_count', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
  })

  let rightSlot: ReactNode
  if (typeof options.headerRight === 'function') {
    rightSlot = options.headerRight({ tintColor: options.headerTintColor as string | undefined, canGoBack: showBack })
  } else {
    rightSlot = options.headerRight
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: safeBg }]}>
      <IslandHeader
        title={title}
        showBack={showBack}
        onBack={() => navigation.goBack()}
        rightSlot={rightSlot}
        userDisplayName={userDisplayName}
        onNotificationsPress={
          userDisplayName
            ? () => {
                router.push('/(app)/notifications')
              }
            : undefined
        }
        notificationUnreadCount={notificationUnreadCount}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {},
})
