import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET, islandTokens } from '../../../src/components/island/islandTokens'
import { fetchRequestsPageData } from '../../../src/lib/requestsPageData'
import { resolveProfileSiteIds } from '../../../src/lib/profileSiteIds'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats, statsFont, statsType } from '../../../src/theme/statsDesignTokens'

/** `requests/index` ile aynı anahtarlar */
const AS_UNORDERED = 'unordered_filter_active'
const AS_OVERDUE = 'overdue_filter_active'

const REQUIRES_SITE = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici']

type InboxRow = {
  id: string
  title: string
  message: string
  type: string
  reference_type: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

function formatInboxTime(iso: string, locale: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const inboxLocale = i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  const { data: pageData, refetch: refetchPage, isRefetching: pageRefetching, isPending: pagePending } = useQuery({
    queryKey: ['requests_page_data', user?.id],
    enabled: Boolean(user?.id && profile),
    queryFn: async () => {
      if (!user?.id || !profile) throw new Error('Oturum yok')
      return fetchRequestsPageData(supabase, user.id, profile)
    },
  })

  const {
    data: inboxRows = [],
    refetch: refetchInbox,
    isRefetching: inboxRefetching,
    isPending: inboxPending,
  } = useQuery({
    queryKey: ['inbox_notifications', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, reference_type, reference_id, is_read, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as InboxRow[]
    },
  })

  const userRole = profile?.role ?? ''
  const userSiteIds = useMemo(() => (profile ? resolveProfileSiteIds(profile) : []), [profile])
  const hasSiteAssignment = userSiteIds.length > 0
  const requiresSiteId = REQUIRES_SITE.includes(userRole)
  const showSiteWarning = requiresSiteId && !hasSiteAssignment

  const pendingOrdersCount = pageData?.pendingOrdersCount ?? 0
  const showPendingOrdersBanner = userRole === 'purchasing_officer' && pendingOrdersCount > 0

  const isOverdueRole = ['site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(userRole)
  const overdueDeliveriesCount = pageData?.overdueDeliveriesCount ?? 0
  const showOverdueBanner = isOverdueRole && overdueDeliveriesCount > 0

  const goToUnorderedRequests = useCallback(async () => {
    await AsyncStorage.setItem(AS_UNORDERED, 'true')
    router.replace('/(app)/requests')
  }, [router])

  const goToOverdueRequests = useCallback(async () => {
    await AsyncStorage.setItem(AS_OVERDUE, 'true')
    router.replace('/(app)/requests')
  }, [router])

  const onRefresh = useCallback(() => {
    void refetchPage()
    void refetchInbox()
  }, [refetchPage, refetchInbox])

  useFocusEffect(
    useCallback(() => {
      void refetchInbox()
      void queryClient.invalidateQueries({ queryKey: ['notif_unread_count', user?.id] })
    }, [refetchInbox, queryClient, user?.id])
  )

  const handleInboxPress = useCallback(
    async (row: InboxRow) => {
      if (!user?.id) return
      if (!row.is_read) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', row.id)
        if (!error) {
          void queryClient.invalidateQueries({ queryKey: ['notif_unread_count', user.id] })
          void queryClient.invalidateQueries({ queryKey: ['inbox_notifications', user.id] })
        }
      }
      if (row.reference_type === 'purchase_request' && row.reference_id) {
        router.push(`/(app)/requests/${row.reference_id}`)
      }
    },
    [queryClient, router, user?.id]
  )

  const unreadCount = useMemo(() => inboxRows.filter((r) => !r.is_read).length, [inboxRows])

  const markAllAsRead = useCallback(async () => {
    if (!user?.id || unreadCount === 0) return
    const unreadIds = inboxRows.filter((r) => !r.is_read).map((r) => r.id)
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    if (!error) {
      void queryClient.invalidateQueries({ queryKey: ['notif_unread_count', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['inbox_notifications', user.id] })
    }
  }, [inboxRows, queryClient, user?.id, unreadCount])

  const refreshing = (pageRefetching && !pagePending) || (inboxRefetching && !inboxPending)
  const hasAnyBanner = showSiteWarning || showOverdueBanner || showPendingOrdersBanner
  const hasInbox = inboxRows.length > 0
  const showEmptyCard = !hasAnyBanner && !hasInbox

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#01E884" />}
    >
      {showSiteWarning ? (
        <View style={styles.bannerDanger}>
          <Text style={styles.bannerDangerTitle}>{t('notifications.siteWaitTitle')}</Text>
          <Text style={styles.bannerDangerBody}>{t('notifications.siteWaitBody')}</Text>
        </View>
      ) : null}

      {showOverdueBanner ? (
        <View style={styles.bannerOk}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerOkTitleLg}>
              {overdueDeliveriesCount === 1
                ? t('notifications.overdueOne')
                : t('notifications.overdueMany', { count: overdueDeliveriesCount })}
            </Text>
            <Text style={styles.bannerOkSub}>{t('notifications.overdueSub')}</Text>
          </View>
          <Pressable style={styles.bannerBtn} onPress={goToOverdueRequests}>
            <Text style={styles.bannerBtnText}>{t('notifications.peek')}</Text>
          </Pressable>
        </View>
      ) : null}

      {showPendingOrdersBanner ? (
        <View style={styles.poBanner}>
          <View style={styles.poBannerBadge}>
            <Text style={styles.poBannerBadgeText}>{pendingOrdersCount}</Text>
          </View>
          <View style={styles.poBannerTextCol}>
            <Text style={styles.poBannerTitle}>
              {pendingOrdersCount === 1
                ? t('notifications.poOne')
                : t('notifications.poMany', { count: pendingOrdersCount })}
            </Text>
            <Text style={styles.poBannerSub}>{t('notifications.poSub')}</Text>
          </View>
          <Pressable style={styles.poBannerBtn} onPress={goToUnorderedRequests}>
            <Text style={styles.poBannerBtnText}>Göz at</Text>
          </Pressable>
        </View>
      ) : null}

      {hasInbox ? (
        <View style={styles.inboxSection}>
          <View style={styles.inboxHeader}>
            <Text style={styles.inboxSectionTitle}>{t('notifications.inbox')}</Text>
            {unreadCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
                onPress={() => void markAllAsRead()}
              >
                <Text style={styles.markAllBtnText}>{t('notifications.markAllRead')}</Text>
              </Pressable>
            ) : null}
          </View>
          {inboxRows.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => void handleInboxPress(row)}
              style={({ pressed }) => [styles.inboxRow, !row.is_read && styles.inboxRowUnread, pressed && { opacity: 0.88 }]}
            >
              <View style={styles.inboxRowTop}>
                <Text style={[styles.inboxTitle, !row.is_read && styles.inboxTitleUnread]} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={styles.inboxTime}>{formatInboxTime(row.created_at, inboxLocale)}</Text>
              </View>
              <Text style={styles.inboxMessage} numberOfLines={3}>
                {row.message}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showEmptyCard ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('notifications.emptyTitle')}</Text>
          <Text style={styles.cardBody}>{t('notifications.emptyBody')}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24 + ISLAND_BOTTOM_BAR_CONTENT_INSET,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  bannerDanger: {
    backgroundColor: stats.errorContainer,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.22)',
    borderRadius: stats.radiusXl,
    padding: 14,
    ...(stats.shadowSm ?? {}),
  },
  bannerDangerTitle: { fontFamily: statsFont.bold, fontSize: 14, color: stats.error },
  bannerDangerBody: { marginTop: 4, ...statsType.bodyMd, color: stats.onErrorContainer },
  bannerOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${stats.primaryContainer}33`,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: stats.radiusXl,
    padding: 12,
  },
  bannerOkTitleLg: { fontFamily: statsFont.semibold, fontSize: 16, color: stats.primary },
  bannerOkSub: { marginTop: 2, ...statsType.labelSm, color: stats.onSurfaceVariant },
  bannerBtn: {
    borderWidth: 1,
    borderColor: stats.primary,
    borderRadius: stats.radiusFull,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: stats.surfaceContainerLowest,
  },
  bannerBtnText: { ...statsType.labelMd, color: stats.primary },
  poBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    borderRadius: 16,
    padding: 12,
  },
  poBannerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#01E884',
    justifyContent: 'center',
    alignItems: 'center',
  },
  poBannerBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  poBannerTextCol: { flex: 1, minWidth: 0 },
  poBannerTitle: { fontSize: 13, fontWeight: '600', color: '#00a85c' },
  poBannerSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  poBannerBtn: {
    borderWidth: 1,
    borderColor: '#01E884',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  poBannerBtnText: { fontSize: 12, fontWeight: '600', color: '#01E884' },
  inboxSection: { gap: 8 },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inboxSectionTitle: {
    fontFamily: statsFont.semibold,
    fontSize: 15,
    color: stats.onSurface,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: stats.primaryContainer,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stats.primary,
  },
  inboxRow: {
    borderRadius: stats.radiusXl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: islandTokens.fillActive,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: islandTokens.border,
  },
  inboxRowUnread: {
    borderColor: stats.primary,
    backgroundColor: `${stats.primaryContainer}22`,
  },
  inboxRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inboxTitle: { flex: 1, ...statsType.bodyMd, color: stats.onSurfaceVariant },
  inboxTitleUnread: { fontFamily: statsFont.semibold, color: stats.onSurface },
  inboxTime: { ...statsType.labelSm, color: stats.onSurfaceVariant, flexShrink: 0 },
  inboxMessage: { marginTop: 6, ...statsType.labelSm, color: stats.onSurfaceVariant, lineHeight: 18 },
  card: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: islandTokens.fillActive,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: islandTokens.border,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: islandTokens.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardBody: {
    fontSize: 15,
    fontWeight: '500',
    color: islandTokens.muted,
    lineHeight: 22,
  },
})
