import AsyncStorage from '@react-native-async-storage/async-storage'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island'
import { SwipeDismissSheet } from '../../../src/components/island/SwipeDismissSheet'
import { RequestCardSkeleton, RequestsPageSkeleton } from '../../../src/components/common/SkeletonLoader'
import { siteManagerApproveOrSendToPurchasing } from '../../../src/features/siteManager/siteManagerRequestActions'
import { canSeeItWorkflowTab, isPazarlamaDepartment, IT_STATUS_ONAYLANDI } from '../../../src/lib/it-workflow'
import { fetchPurchaseRequestsPage, type PurchaseRequestListRow } from '../../../src/lib/purchaseRequestsQuery'
import { getStatusPresentation, getUrgencyPresentation, REQUEST_STATUS_FILTER_OPTIONS } from '../../../src/lib/requestBadges'
import { fetchRequestsPageData } from '../../../src/lib/requestsPageData'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats, statsCardSurface, statsFont, statsType } from '../../../src/theme/statsDesignTokens'

const AS_UNORDERED = 'unordered_filter_active'
const AS_OVERDUE = 'overdue_filter_active'
const AS_SM_TAB = 'purchase_requests_active_tab'

const REQUIRES_SITE = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici']

const APPROVAL_PENDING_STATUSES = ['kısmen gönderildi', 'depoda mevcut değil', 'ana depoda yok']

/** Site yöneticisi liste kartından hızlı aksiyon (detaydaki akışla aynı durumlar) */
const SITE_MANAGER_CARD_SEND_STATUSES = [
  'onay_bekliyor',
  'awaiting_offers',
  'kısmen gönderildi',
  'depoda mevcut değil',
  'ana depoda yok',
] as const

function siteManagerQuickSendLabel(status: string | null, listView: 'main' | 'it', t: TFunction) {
  if (status === 'onay_bekliyor' || status === 'awaiting_offers') return t('siteActions.approve')
  if (listView === 'it' && status === IT_STATUS_ONAYLANDI) return t('siteActions.sendToPurchasing')
  return t('siteActions.send')
}

function formatRequestListDate(iso: string, locale: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

/** Web `PurchaseRequestsTable` `showSendToPurchasingInRow` — ana liste + IT Yönetim (Pazarlama SM, it_onaylandi). */
function showSiteManagerCardSend(
  role: string,
  listView: 'main' | 'it',
  status: string | null,
  department: string | null | undefined,
  itWorkflowApplies: boolean | null | undefined
) {
  if (role !== 'site_manager' || !status) return false

  if (listView === 'main') {
    return (SITE_MANAGER_CARD_SEND_STATUSES as readonly string[]).includes(status)
  }

  return (
    listView === 'it' &&
    isPazarlamaDepartment(department) &&
    itWorkflowApplies === true &&
    status === IT_STATUS_ONAYLANDI
  )
}

function personInitials(name: string | null | undefined) {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (a + b).toUpperCase().slice(0, 2)
}

type DeliveryStatusBadge = {
  type: 'full' | 'partial'
  label: string
  bg: string
  color: string
} | null

function calculateMaterialDeliveryStatus(request: PurchaseRequestListRow): DeliveryStatusBadge {
  const orders = request.orders ?? []
  if (orders.length === 0) return null

  const materialOrders = new Map<string, typeof orders>()
  orders.forEach((order) => {
    const materialId = order.material_item_id
    if (!materialId) return
    if (!materialOrders.has(materialId)) {
      materialOrders.set(materialId, [])
    }
    materialOrders.get(materialId)!.push(order)
  })

  const totalMaterials = materialOrders.size
  let deliveredMaterials = 0
  let partialMaterials = 0

  materialOrders.forEach((matOrders) => {
    const allDelivered = matOrders.every(
      (o) =>
        o.status === 'teslim alındı' ||
        (o.delivered_quantity && o.quantity && Number(o.delivered_quantity) >= Number(o.quantity))
    )

    const someDelivered = matOrders.some(
      (o) =>
        (o.delivered_quantity && Number(o.delivered_quantity) > 0) ||
        o.status === 'teslim alındı' ||
        o.status === 'kısmen teslim alındı'
    )

    if (allDelivered) {
      deliveredMaterials++
    } else if (someDelivered) {
      partialMaterials++
    }
  })

  if (deliveredMaterials === totalMaterials) {
    return { type: 'full', label: 'Tamamı Teslim Alındı', bg: '#2C5444', color: '#ffffff' }
  } else if (deliveredMaterials > 0 || partialMaterials > 0) {
    return { type: 'partial', label: 'Kısmen Teslim Alındı', bg: '#fef2f2', color: '#991b1b' }
  }

  return null
}

function resolveProfileSiteIds(profile: { site_id?: string | string[] | null; construction_site_id?: string | null }) {
  if (profile.site_id && Array.isArray(profile.site_id) && profile.site_id.length) {
    return profile.site_id as string[]
  }
  if (profile.site_id && typeof profile.site_id === 'string') {
    return [profile.site_id]
  }
  if (profile.construction_site_id) {
    return [profile.construction_site_id]
  }
  return []
}

export default function RequestsListScreen() {
  const router = useRouter()
  const { user, profile, refreshProfile } = useAuth()
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'
  const [listView, setListView] = useState<'main' | 'it'>('main')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [unorderedOnly, setUnorderedOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [smTab, setSmTab] = useState<'approval_pending' | 'all'>('approval_pending')
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [sendBusyId, setSendBusyId] = useState<string | null>(null)
  const [openKebabId, setOpenKebabId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [u, o, t] = await Promise.all([
          AsyncStorage.getItem(AS_UNORDERED),
          AsyncStorage.getItem(AS_OVERDUE),
          AsyncStorage.getItem(AS_SM_TAB),
        ])
        if (u === 'true') setUnorderedOnly(true)
        if (o === 'true') setOverdueOnly(true)
        if (t === 'all' || t === 'approval_pending') setSmTab(t)
      } finally {
        setPrefsLoaded(true)
      }
    })()
  }, [])

  // Sayfa mount olduğunda profili yenile (org setup sonrası güncel data için)
  useEffect(() => {
    if (user?.id) {
      void refreshProfile(user.id)
    }
  }, [user?.id, refreshProfile])

  useEffect(() => {
    if (!prefsLoaded) return
    void AsyncStorage.setItem(AS_UNORDERED, String(unorderedOnly))
  }, [unorderedOnly, prefsLoaded])

  useFocusEffect(
    useCallback(() => {
      if (!prefsLoaded) return
      let cancelled = false
      void (async () => {
        const u = await AsyncStorage.getItem(AS_UNORDERED)
        if (cancelled) return
        if (u === 'true') setUnorderedOnly(true)
      })()
      return () => {
        cancelled = true
      }
    }, [prefsLoaded])
  )

  useFocusEffect(
    useCallback(() => {
      if (!prefsLoaded) return
      let cancelled = false
      void (async () => {
        const o = await AsyncStorage.getItem(AS_OVERDUE)
        if (cancelled) return
        if (o === 'true') setOverdueOnly(true)
      })()
      return () => {
        cancelled = true
      }
    }, [prefsLoaded])
  )

  useEffect(() => {
    if (!prefsLoaded) return
    void AsyncStorage.setItem(AS_OVERDUE, String(overdueOnly))
  }, [overdueOnly, prefsLoaded])

  useEffect(() => {
    if (!prefsLoaded) return
    void AsyncStorage.setItem(AS_SM_TAB, smTab)
  }, [smTab, prefsLoaded])

  const userRole = profile?.role ?? ''
  const userSiteIds = useMemo(() => (profile ? resolveProfileSiteIds(profile) : []), [profile])

  const hasSiteAssignment = userSiteIds.length > 0
  const requiresSiteId = REQUIRES_SITE.includes(userRole)
  
  // Organizasyon kontrolü - SADECE yeni kullanıcılar için (site_id'si olmayanlar)
  // Mevcut kullanıcılar (site_id'si olanlar) direkt devam etsin
  const hasOrganization = Boolean(profile?.organization_id)
  const isExistingUser = hasSiteAssignment // Site ataması varsa mevcut kullanıcı
  const showOrgSetup = profile && !hasOrganization && !isExistingUser
  
  useEffect(() => {
    if (showOrgSetup) {
      router.replace('/setup-organization')
    }
  }, [showOrgSetup, router])

  // Site ataması olmayan kullanıcılar için uyarı (mevcut davranış)
  const showSiteWarning = requiresSiteId && !hasSiteAssignment && !showOrgSetup

  // Site oluşturma modal state
  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [newSiteName, setNewSiteName] = useState('')
  const [creatingSite, setCreatingSite] = useState(false)

  const handleCreateSite = async () => {
    if (!newSiteName.trim()) {
      Alert.alert(t('common.error'), t('site.nameRequired'))
      return
    }
    if (!user?.id) return

    setCreatingSite(true)
    try {
      // 1. Site oluştur
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .insert({ name: newSiteName.trim() })
        .select()
        .single()

      if (siteError) throw siteError

      // 2. Kullanıcının profile'ına site_id ekle
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ site_id: [site.id] })
        .eq('id', user.id)

      if (profileError) {
        console.warn('Profile update error:', profileError.message)
      }

      // 3. Profile'ı yenile
      await refreshProfile(user.id)

      // 4. Modal kapat ve sayfayı yenile
      setSiteModalOpen(false)
      setNewSiteName('')
      Alert.alert(t('common.success'), t('site.created'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('common.unknownError')
      Alert.alert(t('site.createFailed'), message)
    } finally {
      setCreatingSite(false)
    }
  }

  const { data: pageData, refetch: refetchPageData, isFetching: pageDataFetching } = useQuery({
    queryKey: ['requests_page_data', user?.id],
    enabled: Boolean(user?.id && profile) && !showOrgSetup,
    staleTime: 45_000,
    gcTime: 6 * 60_000,
    queryFn: async () => {
      if (!user?.id || !profile) throw new Error('Oturum yok')
      return fetchRequestsPageData(supabase, user.id, profile)
    },
  })

  /**
   * Web: requests/page.tsx `canSeeItWorkflowTabUser` (= fetchPageData içindeki canSeeItWorkflowTab).
   * Veri gelene kadar profilden tahmin — yüklendikten sonra pageData tek kaynak.
   */
  const canSeeItWorkflowTabUser = useMemo(() => {
    if (pageData !== undefined) return pageData.canSeeItWorkflowTab === true
    return canSeeItWorkflowTab({ role: profile?.role ?? null, department: profile?.department ?? null })
  }, [pageData, profile?.role, profile?.department])

  useEffect(() => {
    if (!canSeeItWorkflowTabUser && listView === 'it') {
      setListView('main')
      setPage(1)
    }
  }, [canSeeItWorkflowTabUser, listView])

  useEffect(() => {
    if (openKebabId !== null) {
      const timer = setTimeout(() => setOpenKebabId(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [openKebabId])

  const { data: sitesData } = useQuery({
    queryKey: ['sites', 'all'],
    enabled: Boolean(profile),
    staleTime: 120_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('sites').select('id, name').order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; name: string }[]
    },
  })

  const overdueRequestIds = pageData?.overdueRequestIds ?? []
  const isOverdueRole = ['site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(userRole)
  const overdueDataReady = !overdueOnly || !isOverdueRole || pageData !== undefined
  /** Liste AsyncStorage ile bloklanmıyor; tercihler yüklendikçe sorgu anahtarı güncellenir (ek istek olabilir). */
  // Organizasyon kurulumu gerekiyorsa query'yi çalıştırma
  const listQueryEnabled = Boolean(user?.id && profile) && overdueDataReady && !showOrgSetup

  const listQueryKey = useMemo(
    () => [
      'requests',
      user?.id,
      profile?.role,
      listView,
      search.trim(),
      page,
      statusFilter,
      locationFilter,
      unorderedOnly && listView === 'main' && userRole === 'purchasing_officer',
      overdueOnly && listView === 'main',
      overdueOnly ? overdueRequestIds.join(',') : '',
    ],
    [
      user?.id,
      profile?.role,
      listView,
      search,
      page,
      statusFilter,
      locationFilter,
      unorderedOnly,
      overdueOnly,
      overdueRequestIds,
      userRole,
    ]
  )

  const {
    data: listData,
    isLoading: listLoading,
    isFetching: listFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: listQueryKey,
    enabled: listQueryEnabled,
    staleTime: 25_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!user?.id || !profile) throw new Error('Oturum yok')
      const unorderedActive = unorderedOnly && listView === 'main' && userRole === 'purchasing_officer'
      const overdueActive =
        overdueOnly && listView === 'main' && ['site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(userRole)
      return fetchPurchaseRequestsPage(supabase, user.id, profile, {
        page,
        pageSize,
        listView,
        statusFilter,
        locationFilter,
        searchTerm: search.trim() || undefined,
        unorderedOnly: unorderedActive,
        overdueOnly: overdueActive,
        overdueRequestIds,
      })
    },
  })

  const [isManualRefreshing, setIsManualRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setIsManualRefreshing(true)
    try {
      await Promise.all([refetchPageData(), refetchList()])
    } finally {
      setIsManualRefreshing(false)
    }
  }, [refetchPageData, refetchList])

  // Sayfa focus aldığında arka planda sessizce verileri yenile
  useFocusEffect(
    useCallback(() => {
      if (listQueryEnabled) {
        // Arka planda sessizce yenile - RefreshControl gösterme
        void refetchList()
        void refetchPageData()
      }
    }, [listQueryEnabled, refetchList, refetchPageData])
  )

  const handleSiteManagerQuickSend = useCallback(
    async (item: PurchaseRequestListRow) => {
      setSendBusyId(item.id)
      try {
        const { message } = await siteManagerApproveOrSendToPurchasing(
          supabase,
          item.id,
          item.status,
          item.site_id
        )
        Alert.alert(t('common.ok'), message)
        await Promise.all([refetchList(), refetchPageData()])
      } catch (e) {
        Alert.alert(t('requestsList.quickErr'), e instanceof Error ? e.message : t('common.unknownError'))
      } finally {
        setSendBusyId(null)
      }
    },
    [refetchList, refetchPageData, t]
  )

  const handleDeleteRequest = useCallback(
    async (requestId: string) => {
      try {
        const { error } = await supabase
          .from('purchase_requests')
          .delete()
          .eq('id', requestId)

        if (error) throw error

        Alert.alert(t('common.ok'), 'Talep başarıyla silindi')
        await Promise.all([refetchList(), refetchPageData()])
      } catch (e) {
        Alert.alert('Hata', e instanceof Error ? e.message : t('common.unknownError'))
      } finally {
        setOpenKebabId(null)
      }
    },
    [refetchList, refetchPageData, t]
  )

  const displayRequests = useMemo(() => {
    let rows = listData?.requests ?? []
    if (userRole === 'site_manager' && listView === 'main' && smTab === 'approval_pending') {
      rows = rows.filter((r) => r.status && APPROVAL_PENDING_STATUSES.includes(r.status))
    }
    if (unorderedOnly && userRole === 'purchasing_officer' && listView === 'main') {
      rows = [...rows].sort((a, b) => (b.unordered_materials_count || 0) - (a.unordered_materials_count || 0))
    }
    return rows
  }, [listData?.requests, userRole, listView, smTab, unorderedOnly])

  const userInfo = pageData?.userInfo
  const statsFromApi = pageData?.stats
  const itAttention = pageData?.itWorkflowAttentionCount ?? 0
  const showItTabNotification = canSeeItWorkflowTabUser && itAttention > 0 && listView === 'main'

  const handleRowPress = (item: (typeof displayRequests)[number]) => {
    if (userRole === 'purchasing_officer' && item.status === 'depoda mevcut değil') {
      Alert.alert(t('requestsList.poBlockedTitle'), t('requestsList.poBlockedBody'))
      return
    }
    if (item.status !== 'draft' && item.status !== 'cancelled' && item.status !== 'rejected') {
      router.push(`/(app)/requests/${item.id}`)
    }
  }

  const hasActiveFilters =
    unorderedOnly || overdueOnly || statusFilter !== 'all' || locationFilter !== 'all'

  const clearFilters = () => {
    setStatusFilter('all')
    setLocationFilter('all')
    setUnorderedOnly(false)
    setOverdueOnly(false)
    setPage(1)
  }

  const renderMonthly = () => {
    if (!statsFromApi?.monthlyData?.length) return null
    const maxCount = Math.max(...statsFromApi.monthlyData.map((m) => m.count), 1)
    const monthSum = statsFromApi.monthlyData.reduce((s, m) => s + m.count, 0)
    const maxIdx = statsFromApi.monthlyData.reduce(
      (bestIdx, m, i, arr) => (m.count >= arr[bestIdx].count ? i : bestIdx),
      0
    )

    const rowH = 160
    const colGap = 8
    const labelApprox = 16
    const maxBarH = rowH - labelApprox - colGap

    return (
      <View style={styles.monthlyWrapper}>
        <View style={styles.monthlyHeaderRow}>
          <Text style={styles.monthlyTitle}>{t('requestsList.monthlyTitle')}</Text>
          <Text style={styles.monthlyTotal}>{t('requestsList.monthlyTotal', { count: monthSum })}</Text>
        </View>
        <View style={styles.monthlyCard}>
          <View style={styles.monthBarsRow}>
            {statsFromApi.monthlyData.map((month, i) => {
              const barH = Math.max(10, Math.round((month.count / maxCount) * maxBarH))
              const isHi = i === maxIdx
              const barBg = isHi ? '#01E884' : i % 2 === 0 ? '#01E884' : '#ffffff'
              return (
                <View key={`${month.month}-${i}`} style={styles.monthColumn}>
                  <View style={[styles.monthBarPill, { height: barH, backgroundColor: barBg }]} />
                  <Text style={[styles.monthLabel, isHi && styles.monthLabelHi]} numberOfLines={1}>
                    {month.month}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    )
  }

  const listHeader = (
    <View style={styles.headerOuter}>
      {userInfo?.displayName ? (
        <Text style={styles.welcomeLine}>
          {t('requestsList.welcomeHello')}{' '}
          <Text style={styles.welcomeName}>{userInfo.displayName}</Text>
        </Text>
      ) : null}

      {showSiteWarning ? (
        <View style={styles.bannerDanger}>
          <Text style={styles.bannerDangerTitle}>{t('site.noSiteTitle')}</Text>
          <Text style={styles.bannerDangerBody}>{t('site.noSiteBody')}</Text>
          <Pressable style={styles.bannerButton} onPress={() => setSiteModalOpen(true)}>
            <Text style={styles.bannerButtonText}>{t('site.createSite')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.introBlock}>
        <Text style={styles.pageTitle}>{t('requestsList.pageTitle')}</Text>
      </View>

      <View style={styles.statsWrap}>{renderMonthly()}</View>

      {canSeeItWorkflowTabUser ? (
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, listView === 'main' && styles.tabActive]}
            onPress={() => {
              setListView('main')
              setPage(1)
            }}
          >
            <Text style={[styles.tabText, listView === 'main' && styles.tabTextActive]}>{t('requestsList.tabRequests')}</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, listView === 'it' && styles.tabItActive]}
            onPress={() => {
              setListView('it')
              setPage(1)
            }}
            accessibilityLabel={
              showItTabNotification
                ? t('requestsList.itA11yPending', { count: itAttention })
                : t('requestsList.itA11y')
            }
          >
            <View style={styles.tabItInner}>
              <Text style={[styles.tabText, listView === 'it' && styles.itTabTextActive]}>{t('requestsList.tabIt')}</Text>
              {showItTabNotification ? <View style={styles.itDot} /> : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      {userRole === 'site_manager' && listView === 'main' ? (
        <View style={styles.smTabRow}>
          <Pressable
            style={[styles.smTab, smTab === 'approval_pending' && styles.smTabOn]}
            onPress={() => {
              setSmTab('approval_pending')
              setPage(1)
            }}
          >
            <Text style={[styles.smTabText, smTab === 'approval_pending' && styles.smTabTextOn]}>
              {t('requestsList.smPending')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.smTab, smTab === 'all' && styles.smTabOn]}
            onPress={() => {
              setSmTab('all')
              setPage(1)
            }}
          >
            <Text style={[styles.smTabText, smTab === 'all' && styles.smTabTextOn]}>{t('common.all')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchShell}>
        <View style={styles.searchIconWrap}>
          <MaterialIcons name="travel-explore" size={26} color="#01E884" />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder={t('requestsList.searchPh')}
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={(txt) => {
            setSearch(txt)
            setPage(1)
          }}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <Pressable style={styles.filterPill} onPress={() => setStatusModalOpen(true)}>
          <Text style={styles.filterPillMuted}>{t('requestsList.filterStatus')}</Text>
          <Text style={styles.filterPillValue}>
            {statusFilter === 'all' ? t('common.all') : getStatusPresentation(statusFilter, userRole, userSiteIds, undefined, t).label}
          </Text>
          <MaterialIcons name="expand-more" size={20} color="#94a3b8" />
        </Pressable>
        <Pressable style={styles.filterPill} onPress={() => setLocationModalOpen(true)}>
          <Text style={styles.filterPillMuted}>{t('requestsList.filterLocation')}</Text>
          <Text style={styles.filterPillValue} numberOfLines={1}>
            {locationFilter === 'all' ? t('common.all') : sitesData?.find((s) => s.id === locationFilter)?.name ?? t('common.dash')}
          </Text>
          <MaterialIcons name="expand-more" size={20} color="#94a3b8" />
        </Pressable>
        {userRole === 'purchasing_officer' && listView === 'main' ? (
          <Pressable
            style={[styles.filterPill, unorderedOnly && styles.filterPillAccent]}
            onPress={() => {
              setUnorderedOnly((v) => !v)
              setPage(1)
            }}
          >
            <Text style={styles.filterPillMuted}>{t('requestsList.filterOrder')}</Text>
            <Text style={[styles.filterPillValue, unorderedOnly && styles.filterPillValueOn]}>
              {t('requestsList.filterOrderMissing')}
            </Text>
          </Pressable>
        ) : null}
        {['site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(userRole) && listView === 'main' ? (
          <Pressable
            style={[styles.filterPillOverdue, overdueOnly && styles.filterPillOverdueOn]}
            onPress={() => {
              setOverdueOnly((v) => !v)
              setPage(1)
            }}
          >
            <MaterialIcons name="history" size={18} color={overdueOnly ? stats.error : stats.onErrorContainer} />
            <Text style={[styles.filterOverdueText, overdueOnly && styles.filterOverdueTextOn]}>
              {t('requestsList.overdue')}
            </Text>
          </Pressable>
        ) : null}
        {hasActiveFilters ? (
          <Pressable style={styles.filterPillGhost} onPress={clearFilters}>
            <Text style={styles.filterGhostText}>{t('requestsList.clear')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Text style={styles.resultCount}>
        {listData?.totalCount != null
          ? t('requestsList.results', { shown: displayRequests.length, total: listData.totalCount })
          : ''}
      </Text>
    </View>
  )

  const listFooter = useMemo(
    () => (
      <View style={styles.listFooter}>
        <Pressable
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          style={styles.pageBtn}
        >
          <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>{t('requestsList.prev')}</Text>
        </Pressable>
        <Text style={styles.pageInfo}>
          {listData?.totalCount != null
            ? t('requestsList.pageInfoTotal', { page, total: listData.totalCount })
            : t('requestsList.pageInfo', { page })}
        </Text>
        <Pressable
          disabled={!listData || page * pageSize >= (listData.totalCount ?? 0)}
          onPress={() => setPage((p) => p + 1)}
          style={styles.pageBtn}
        >
          <Text
            style={[
              styles.pageBtnText,
              !listData || page * pageSize >= (listData.totalCount ?? 0) ? styles.pageBtnTextDisabled : null,
            ]}
          >
            {t('requestsList.next')}
          </Text>
        </Pressable>
      </View>
    ),
    [listData, page, pageSize, t]
  )

  const isInitialLoading = !user || !profile || (listLoading && !listData)

  if (isInitialLoading) {
    return (
      <View style={styles.container}>
        <RequestsPageSkeleton />
      </View>
    )
  }

  // Organizasyon kurulumu için yönlendirme yapılırken loading göster
  if (showOrgSetup) {
    return (
      <View style={styles.container}>
        <RequestsPageSkeleton />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={displayRequests}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={onRefresh}
            tintColor="#6b7280"
            colors={['#6b7280']}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          listLoading ? (
            <View>
              <RequestCardSkeleton index={0} />
              <RequestCardSkeleton index={1} />
              <RequestCardSkeleton index={2} />
              <RequestCardSkeleton index={3} />
            </View>
          ) : (
            <Text style={styles.empty}>{t('requestsList.empty')}</Text>
          )
        }
        renderItem={({ item }) => {
          const st = getStatusPresentation(item.status || '', userRole, userSiteIds, item.notifications ?? null, t)
          const urg =
            item.urgency_level && item.urgency_level !== 'normal'
              ? getUrgencyPresentation(item.urgency_level, t)
              : null
          const blockedPo = userRole === 'purchasing_officer' && item.status === 'depoda mevcut değil'
          let prof = item.profiles
          if (Array.isArray(prof) && prof.length) prof = prof[0]
          const displayName = prof && !Array.isArray(prof) ? prof.full_name || prof.email || '' : ''
          const showSmSend = showSiteManagerCardSend(
            userRole,
            listView,
            item.status,
            profile?.department,
            item.it_workflow_applies
          )
          const deliveryStatus = item.status === 'sipariş verildi' ? calculateMaterialDeliveryStatus(item) : null
          return (
            <View style={[statsCardSurface.listItem, styles.cardShell, blockedPo && styles.cardDisabled]}>
              <Pressable
                style={({ pressed }) => [styles.cardTap, pressed && !blockedPo && styles.cardPressed]}
                onPress={() => {
                  if (openKebabId !== null) {
                    setOpenKebabId(null)
                    return
                  }
                  handleRowPress(item)
                }}
                disabled={blockedPo}
              >
                <View style={styles.cardMain}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.badgeCluster}>
                      {deliveryStatus ? (
                        <View
                          style={[
                            styles.badge,
                            styles.deliveryBadge,
                            { backgroundColor: deliveryStatus.bg },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: deliveryStatus.color }]}>
                            {deliveryStatus.label}
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: st.bg, borderColor: st.borderColor || 'transparent' },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      )}
                      {urg ? (
                        <View style={[styles.badge, { backgroundColor: urg.bg }]}>
                          <Text style={[styles.badgeText, { color: urg.color }]}>{urg.label}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.cardTopRight}>
                      <Text style={styles.cardDate}>{formatRequestListDate(item.created_at, dateLocale)}</Text>
                      <View style={styles.kebabContainer}>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation()
                            setOpenKebabId(openKebabId === item.id ? null : item.id)
                          }}
                          style={styles.kebabBtn}
                        >
                          <MaterialIcons name="more-vert" size={20} color="#6b7280" />
                        </Pressable>
                        {openKebabId === item.id && (
                          <View style={styles.kebabMenu}>
                            {item.status === 'satın almaya gönderildi' || item.status === 'sipariş verildi' ? (
                              <View style={[styles.kebabMenuItem, styles.kebabMenuItemDisabled]}>
                                <MaterialIcons name="delete" size={18} color="#d1d5db" />
                                <Text style={styles.kebabMenuItemTextDisabled}>Sil</Text>
                              </View>
                            ) : (
                              <Pressable
                                style={styles.kebabMenuItem}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  setOpenKebabId(null)
                                  Alert.alert(
                                    'Talebi Sil',
                                    'Bu talebi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
                                    [
                                      { text: 'İptal', style: 'cancel' },
                                      {
                                        text: 'Sil',
                                        style: 'destructive',
                                        onPress: () => void handleDeleteRequest(item.id),
                                      },
                                    ]
                                  )
                                }}
                              >
                                <MaterialIcons name="delete" size={18} color={stats.error} />
                                <Text style={styles.kebabMenuItemText}>Sil</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {st.extraBadges.map((b) => (
                    <View key={b.label} style={[styles.badge, { backgroundColor: b.bg, marginTop: 6 }]}>
                      <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
                    </View>
                  ))}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title || t('common.dash')}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.request_number}
                    {item.sites && !Array.isArray(item.sites) && item.sites.name ? ` · ${item.sites.name}` : ''}
                  </Text>
                  {displayName ? (
                    <View style={styles.personRow}>
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{personInitials(displayName)}</Text>
                      </View>
                      <Text style={styles.personName} numberOfLines={1}>
                        {displayName}
                      </Text>
                    </View>
                  ) : null}
                  {userRole === 'purchasing_officer' &&
                  item.unordered_materials_count &&
                  item.unordered_materials_count > 0 ? (
                    <Text style={styles.unorderedHint}>
                      {t('requestsList.unorderedHint', { count: item.unordered_materials_count })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {showSmSend ? (
                <View style={styles.cardActionBand}>
                  <Pressable
                    style={[styles.cardSendBtn, sendBusyId !== null && styles.cardSendBtnDisabled]}
                    disabled={sendBusyId !== null}
                    onPress={() => void handleSiteManagerQuickSend(item)}
                  >
                    {sendBusyId === item.id ? (
                      <ActivityIndicator color={stats.onPrimary} size="small" />
                    ) : (
                      <Text style={styles.cardSendBtnText}>{siteManagerQuickSendLabel(item.status, listView, t)}</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        }}
      />

      <SwipeDismissSheet
        visible={statusModalOpen}
        onRequestClose={() => setStatusModalOpen(false)}
        title={t('requestsList.modalStatus')}
        fitContent
        maxHeightRatio={0.7}
      >
        <View style={styles.modalContent}>
          <Pressable
            style={[styles.modalRow, statusFilter === 'all' && styles.modalRowSelected]}
            onPress={() => {
              setStatusFilter('all')
              setStatusModalOpen(false)
              setPage(1)
            }}
          >
            <Text style={[styles.modalRowText, statusFilter === 'all' && styles.modalRowTextSelected]}>
              {t('common.all')}
            </Text>
            {statusFilter === 'all' && (
              <MaterialIcons name="check" size={20} color="#01E884" />
            )}
          </Pressable>
          {REQUEST_STATUS_FILTER_OPTIONS.map((s) => {
            const isSelected = statusFilter === s
            return (
              <Pressable
                key={s}
                style={[styles.modalRow, isSelected && styles.modalRowSelected]}
                onPress={() => {
                  setStatusFilter(s)
                  setStatusModalOpen(false)
                  setPage(1)
                }}
              >
                <Text style={[styles.modalRowText, isSelected && styles.modalRowTextSelected]}>
                  {getStatusPresentation(s, userRole, userSiteIds, undefined, t).label}
                </Text>
                {isSelected && (
                  <MaterialIcons name="check" size={20} color="#01E884" />
                )}
              </Pressable>
            )
          })}
        </View>
      </SwipeDismissSheet>

      <SwipeDismissSheet
        visible={locationModalOpen}
        onRequestClose={() => setLocationModalOpen(false)}
        title={t('requestsList.modalLocation')}
        fitContent
        maxHeightRatio={0.7}
      >
        <View style={styles.modalContent}>
          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            <Pressable
              style={[styles.modalRow, locationFilter === 'all' && styles.modalRowSelected]}
              onPress={() => {
                setLocationFilter('all')
                setLocationModalOpen(false)
                setPage(1)
              }}
            >
              <Text style={[styles.modalRowText, locationFilter === 'all' && styles.modalRowTextSelected]}>
                {t('common.all')}
              </Text>
              {locationFilter === 'all' && (
                <MaterialIcons name="check" size={20} color="#01E884" />
              )}
            </Pressable>
            {(sitesData ?? []).map((s) => {
              const isSelected = locationFilter === s.id
              return (
                <Pressable
                  key={s.id}
                  style={[styles.modalRow, isSelected && styles.modalRowSelected]}
                  onPress={() => {
                    setLocationFilter(s.id)
                    setLocationModalOpen(false)
                    setPage(1)
                  }}
                >
                  <Text style={[styles.modalRowText, isSelected && styles.modalRowTextSelected]}>
                    {s.name}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check" size={20} color="#01E884" />
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </SwipeDismissSheet>

      {/* Site Oluşturma Modal */}
      <Modal
        visible={siteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSiteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.siteModalContent}>
            <Text style={styles.siteModalTitle}>{t('site.createSite')}</Text>
            <Text style={styles.siteModalSubtitle}>{t('site.createSiteSubtitle')}</Text>
            
            <TextInput
              style={styles.siteModalInput}
              placeholder={t('site.namePlaceholder')}
              placeholderTextColor="#9ca3af"
              value={newSiteName}
              onChangeText={setNewSiteName}
              editable={!creatingSite}
              autoFocus
            />

            <View style={styles.siteModalButtons}>
              <Pressable
                style={styles.siteModalCancelBtn}
                onPress={() => {
                  setSiteModalOpen(false)
                  setNewSiteName('')
                }}
                disabled={creatingSite}
              >
                <Text style={styles.siteModalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              
              <Pressable
                style={[styles.siteModalCreateBtn, creatingSite && styles.btnDisabled]}
                onPress={handleCreateSite}
                disabled={creatingSite}
              >
                {creatingSite ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.siteModalCreateText}>{t('site.create')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stats.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerOuter: {
    paddingHorizontal: stats.marginMobile,
    paddingTop: 4,
    gap: 16,
  },
  welcomeLine: { ...statsType.bodyMd, color: stats.onSurfaceVariant },
  welcomeName: { fontFamily: statsFont.semibold, color: stats.onSurface },
  bannerDanger: {
    backgroundColor: stats.errorContainer,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.22)',
    borderRadius: 24,
    padding: 14,
    ...(stats.shadowSm ?? {}),
  },
  bannerDangerTitle: { fontFamily: statsFont.bold, fontSize: 14, color: stats.error },
  bannerDangerBody: { marginTop: 4, ...statsType.bodyMd, color: stats.onErrorContainer },
  bannerInfo: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.22)',
    borderRadius: 24,
    padding: 14,
    ...(stats.shadowSm ?? {}),
  },
  bannerInfoTitle: { fontFamily: statsFont.bold, fontSize: 14, color: '#1d4ed8' },
  bannerInfoBody: { marginTop: 4, ...statsType.bodyMd, color: '#1e40af' },
  bannerButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: statsFont.semibold,
  },
  bannerOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 24,
    padding: 12,
  },
  bannerOkTitleLg: { fontFamily: statsFont.semibold, fontSize: 16, color: '#191c1c' },
  bannerOkSub: { marginTop: 2, ...statsType.labelSm, color: '#6b7280' },
  bannerBtn: {
    borderWidth: 1,
    borderColor: '#191c1c',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  bannerBtnText: { ...statsType.labelMd, color: '#191c1c' },
  introBlock: { marginBottom: 2 },
  pageTitle: {
    ...statsType.headlineLgMobile,
    color: stats.onSurface,
    /** Özel font gecikirse bile başlık kalın kalsın */
    fontWeight: '700',
  },
  statsWrap: { gap: 8, marginHorizontal: -8 },
  monthlyWrapper: {
    gap: 10,
    paddingHorizontal: 8,
  },
  monthlyCard: {
    backgroundColor: '#000000',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  monthlyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthlyTitle: {
    fontFamily: statsFont.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: '#191c1c',
  },
  monthlyTotal: {
    ...statsType.labelSm,
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7280',
  },
  monthBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 160,
  },
  monthColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  monthBarPill: {
    width: '100%',
    borderRadius: 999,
    minHeight: 8,
  },
  monthLabel: {
    ...statsType.labelSm,
    fontSize: 12,
    lineHeight: 14,
    color: '#d1d5db',
  },
  monthLabelHi: {
    fontFamily: statsFont.bold,
    color: '#01E884',
  },
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#ffffff', ...(stats.shadowSm ?? {}) },
  tabItActive: { backgroundColor: '#ffffff', ...(stats.shadowSm ?? {}) },
  tabText: { ...statsType.labelMd, color: '#6b7280' },
  tabTextActive: { color: '#191c1c' },
  tabItInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itTabTextActive: { color: '#191c1c' },
  itDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: stats.error,
  },
  smTabRow: { flexDirection: 'row', gap: 8 },
  smTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  smTabOn: { backgroundColor: '#191c1c', borderColor: '#191c1c' },
  smTabText: { ...statsType.labelMd, fontSize: 13, color: '#6b7280' },
  smTabTextOn: { color: '#ffffff' },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 6,
    height: 56,
  },
  searchIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f0fdf4',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 0,
    paddingRight: 12,
    textAlignVertical: 'center',
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(65, 73, 62, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: 220,
  },
  filterPillAccent: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  filterPillMuted: { ...statsType.labelMd, color: '#94a3af' },
  filterPillValue: { ...statsType.labelMd, color: '#1e293b', flexShrink: 1 },
  filterPillValueOn: { color: '#191c1c' },
  filterPillOverdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterPillOverdueOn: {
    backgroundColor: 'rgba(255, 218, 214, 0.65)',
    borderColor: 'rgba(186, 26, 26, 0.35)',
  },
  filterOverdueText: { ...statsType.labelMd, color: stats.onErrorContainer },
  filterOverdueTextOn: { color: stats.error },
  filterPillGhost: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterGhostText: {
    fontFamily: statsFont.semibold,
    fontSize: 12,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  resultCount: { ...statsType.labelSm, color: stats.onSurfaceVariant, marginBottom: 4 },
  cardShell: {
    marginHorizontal: stats.marginMobile,
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 24,
    borderColor: '#e5e7eb',
  },
  cardTap: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
  },
  cardPressed: { opacity: 0.92 },
  cardDisabled: { opacity: 0.72 },
  cardActionBand: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: stats.outlineVariant,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    backgroundColor: stats.surfaceContainerLow,
  },
  cardSendBtn: {
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#01E884',
    ...(stats.shadowSm ?? {}),
  },
  cardSendBtnDisabled: { opacity: 0.65 },
  cardSendBtnText: {
    fontFamily: statsFont.semibold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: stats.onPrimary,
  },
  cardMain: { gap: 2 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  badgeCluster: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: { ...statsType.labelSm, color: stats.onSurfaceVariant },
  kebabContainer: {
    position: 'relative',
  },
  kebabBtn: {
    padding: 4,
  },
  kebabMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  kebabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kebabMenuItemText: {
    ...statsType.bodyMd,
    color: stats.error,
    fontFamily: statsFont.semibold,
  },
  kebabMenuItemDisabled: {
    opacity: 0.5,
  },
  kebabMenuItemTextDisabled: {
    ...statsType.bodyMd,
    color: '#d1d5db',
    fontFamily: statsFont.semibold,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deliveryBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: statsFont.semibold,
    fontSize: 11,
    lineHeight: 14,
  },
  cardTitle: {
    ...statsType.bodyLg,
    fontFamily: statsFont.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.24,
    color: stats.onSurface,
    marginTop: 10,
  },
  cardMeta: { ...statsType.labelMd, color: stats.onSurfaceVariant, marginTop: 4 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  personAvatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontFamily: statsFont.bold,
    fontSize: 9,
    color: '#374151',
  },
  personName: { ...statsType.labelSm, color: stats.onSurface, flex: 1 },
  unorderedHint: { marginTop: 6, ...statsType.labelMd, color: '#c2410c' },
  empty: { textAlign: 'center', marginTop: 32, ...statsType.bodyMd, color: stats.onSurfaceVariant, paddingHorizontal: 24 },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24 + ISLAND_BOTTOM_BAR_CONTENT_INSET,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: stats.marginMobile,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: stats.surfaceContainerLowest,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...(stats.shadowSm ?? {}),
  },
  pageBtn: { padding: 8 },
  pageBtnText: { ...statsType.labelMd, color: '#374151' },
  pageBtnTextDisabled: { color: '#d1d5db' },
  pageInfo: { ...statsType.bodyMd, color: stats.onSurfaceVariant, flex: 1, textAlign: 'center' },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalScrollView: {
    maxHeight: 350,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stats.outlineVariant,
  },
  modalRowSelected: {
    backgroundColor: 'rgba(1, 232, 132, 0.08)',
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  modalRowText: { 
    ...statsType.bodyMd, 
    color: stats.onSurface,
    fontSize: 16,
    flex: 1,
  },
  modalRowTextSelected: {
    fontFamily: statsFont.semibold,
    color: '#01E884',
  },
  modalClose: { marginTop: 12, padding: 14, alignItems: 'center' },
  modalCloseText: { ...statsType.labelMd, color: '#374151', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  siteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  siteModalTitle: {
    fontSize: 20,
    fontFamily: statsFont.bold,
    color: stats.onSurface,
    marginBottom: 8,
  },
  siteModalSubtitle: {
    fontSize: 14,
    color: stats.onSurfaceVariant,
    marginBottom: 20,
  },
  siteModalInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111827',
    marginBottom: 20,
  },
  siteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  siteModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  siteModalCancelText: {
    fontSize: 15,
    fontFamily: statsFont.semibold,
    color: '#6b7280',
  },
  siteModalCreateBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  siteModalCreateText: {
    fontSize: 15,
    fontFamily: statsFont.semibold,
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.65,
  },
})
