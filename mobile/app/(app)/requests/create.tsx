import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CategoryTabsRn } from '../../../src/components/create/CategoryTabsRn'
import { CartBottomBarRn, CartDrawerRn } from '../../../src/components/create/CartRn'
import { CategoryTabSkeleton, MaterialCardSkeleton } from '../../../src/components/common/SkeletonLoader'
import type { MaterialCategory } from '../../../src/components/create/createTypes'
import { CreateMaterialModalRn } from '../../../src/components/create/CreateMaterialModalRn'
import { MaterialCardRn } from '../../../src/components/create/MaterialCardRn'
import {
  MaterialDetailModalRn,
  type CartItemRn,
  type MaterialItemRn,
} from '../../../src/components/create/MaterialDetailModalRn'
import { MaterialSearchBarRn } from '../../../src/components/create/MaterialSearchBarRn'
import { SPECIAL_SITE_ID } from '../../../src/lib/constants'
import { createMultiMaterialPurchaseRequest } from '../../../src/lib/createPurchaseRequest'
import {
  loadPersistedCreateDraftCart,
  savePersistedCreateDraftCart,
} from '../../../src/lib/createDraftCartStorage'
import type { LocalMaterialCandidate } from '../../../src/lib/materialSearch'
import type { ProfileRow } from '../../../src/lib/purchaseRequestsQuery'
import { supabase } from '../../../src/lib/supabase'
import { uploadPurchaseMaterialImages } from '../../../src/lib/uploadMaterialImages'
import { useAuth } from '../../../src/providers/AuthProvider'
import { ISLAND_CART_BAR_CLEARANCE } from '../../../src/components/island/islandTokens'

type Site = { id: string; name: string; image_url: string | null }

const REQUIRES_SITE = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici']

const HYGIENE_DEFAULT_CATEGORY = 'Hijyen ve Temizlik' as const

const OFFICE_CATEGORY_KEYWORDS = ['hijyen', 'kirtasiye', 'mutfak', 'ofis ekipman', 'promosyon', 'reklam'] as const

const normalizeCategoryName = (value: string): string =>
  value
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')

function isOfficeCategory(categoryName: string): boolean {
  const normalized = normalizeCategoryName(categoryName)
  return OFFICE_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function resolveUserSiteIds(profile: ProfileRow): string[] {
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

export default function CreateRequestScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()

  const [checking, setChecking] = useState(true)
  const [pageStep, setPageStep] = useState<'site-selection' | 'shopping'>('shopping')
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [isGenelMerkezUser, setIsGenelMerkezUser] = useState(false)
  const [hasHygieneDefaultSite, setHasHygieneDefaultSite] = useState(false)

  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subCategories, setSubCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [materials, setMaterials] = useState<MaterialItemRn[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [localCreatedMaterials, setLocalCreatedMaterials] = useState<LocalMaterialCandidate[]>([])

  const [cart, setCart] = useState<CartItemRn[]>([])
  /** AsyncStorage’tan sepet okunana kadar true değil — boş array diske yazılıp taslağı silmesin */
  const [cartHydrated, setCartHydrated] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItemRn | null>(null)
  const [editCartItem, setEditCartItem] = useState<CartItemRn | null>(null)
  const [editCartIndex, setEditCartIndex] = useState(-1)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalSeed, setCreateModalSeed] = useState({ class: '', group: '', item_name: '' })

  /** İki RN Modal üst üste olunca düzenle detayı açılmıyor; drawer kapanınca kısa gecikmeyle aç. */
  const detailOpenAfterCartCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Sepet kalıcılığı: hesap değişince bellekteki sepet sıfırlanır */
  const prevCartUserIdRef = useRef<string | undefined>(undefined)

  function clearDetailOpenAfterCartTimer() {
    if (detailOpenAfterCartCloseRef.current) {
      clearTimeout(detailOpenAfterCartCloseRef.current)
      detailOpenAfterCartCloseRef.current = null
    }
  }

  useEffect(() => {
    return () => clearDetailOpenAfterCartTimer()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setCartHydrated(false)
      setCart([])
      prevCartUserIdRef.current = undefined
      return
    }
    let cancelled = false
    setCartHydrated(false)
    const switchedAccount =
      prevCartUserIdRef.current !== undefined && prevCartUserIdRef.current !== user.id
    prevCartUserIdRef.current = user.id
    if (switchedAccount) {
      setCart([])
    }
    void loadPersistedCreateDraftCart(user.id).then((loaded) => {
      if (cancelled) return
      setCart((prev) => {
        if (prev.length > 0) return prev
        return loaded && loaded.length > 0 ? loaded : []
      })
      setCartHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !cartHydrated) return
    void savePersistedCreateDraftCart(user.id, cart)
  }, [user?.id, cart, cartHydrated])

  // Kullanıcı GMO'ya erişebiliyorsa (site_id listesinde varsa) TÜM kategorileri görebilir
  const userHasGmoAccess = hasHygieneDefaultSite
  // Seçili site GMO ise sadece ofis kategorileri göster
  const selectedSiteIsGmo = selectedSite?.id === SPECIAL_SITE_ID || selectedSite?.name === 'Genel Merkez Ofisi'

  const filteredCategories = useMemo(() => {
    // Kullanıcı GMO'ya erişebiliyorsa TÜM kategorileri göster
    if (userHasGmoAccess) {
      return categories
    }
    // GMO erişimi yoksa, seçili site'a göre filtrele
    return categories.filter((category) => {
      if (isOfficeCategory(category.name)) {
        return selectedSiteIsGmo
      }
      return !selectedSiteIsGmo
    })
  }, [categories, userHasGmoAccess, selectedSiteIsGmo])

  const allowedSearchCategories = useMemo(() => {
    // GMO erişimi varsa ve GMO seçiliyse sadece ofis kategorilerinde ara
    // GMO erişimi varsa ama başka site seçiliyse, sadece ofis olmayan kategorilerde ara
    // GMO erişimi yoksa filteredCategories zaten doğru
    if (userHasGmoAccess) {
      if (selectedSiteIsGmo) {
        return filteredCategories.filter((c) => isOfficeCategory(c.name)).map((c) => c.name)
      }
      return filteredCategories.filter((c) => !isOfficeCategory(c.name)).map((c) => c.name)
    }
    return filteredCategories.map((c) => c.name)
  }, [filteredCategories, userHasGmoAccess, selectedSiteIsGmo])

  const loadSitesAndCategories = useCallback(async () => {
    if (!profile || !user) return
    const ids = resolveUserSiteIds(profile)
    const requires = REQUIRES_SITE.includes(profile.role ?? '')
    if (requires && ids.length === 0) {
      Alert.alert(t('createRequest.noSiteTitle'), t('createRequest.noSiteBody'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ])
      setChecking(false)
      return
    }

    setHasHygieneDefaultSite(ids.includes(SPECIAL_SITE_ID))

    if (ids.length === 1) {
      const { data } = await supabase.from('sites').select('id, name, image_url').eq('id', ids[0]).maybeSingle()
      if (data) {
        setSelectedSite(data as Site)
        setIsGenelMerkezUser(data.name === 'Genel Merkez Ofisi')
      }
    } else if (ids.length > 1) {
      const { data } = await supabase.from('sites').select('id, name, image_url').in('id', ids).order('name')
      setSites((data as Site[]) ?? [])
      setPageStep('site-selection')
    } else {
      setSelectedSite(null)
    }

    setCategoriesLoading(true)
    const { data: cats } = await supabase.from('material_categories').select('id, name').order('name')
    setCategories((cats as MaterialCategory[]) ?? [])
    setCategoriesLoading(false)
    setChecking(false)
  }, [profile, user, router, t])

  useEffect(() => {
    void loadSitesAndCategories()
  }, [loadSitesAndCategories])

  useEffect(() => {
    if (filteredCategories.length === 0) return
    const still = Boolean(selectedCategory) && filteredCategories.some((c) => c.name === selectedCategory)
    if (still) return
    // GMO seçiliyse Hijyen kategorisini default yap
    if (selectedSiteIsGmo) {
      const hygiene = filteredCategories.find((c) => c.name === HYGIENE_DEFAULT_CATEGORY)
      if (hygiene) {
        setSelectedCategory(hygiene.name)
        return
      }
    }
    setSelectedCategory(filteredCategories[0].name)
  }, [filteredCategories, selectedSiteIsGmo, selectedCategory])

  useEffect(() => {
    if (!selectedCategory) {
      setSubCategories([])
      setSelectedSubCategory('')
      setMaterials([])
      return
    }
    void (async () => {
      setMaterialsLoading(true)
      const { data } = await supabase.from('all_materials').select('group').eq('class', selectedCategory).order('group')
      const uniq = [...new Set((data ?? []).map((r: { group: string }) => r.group).filter(Boolean))] as string[]
      const groups: { id: string; name: string }[] = uniq.map((name, index) => ({
        id: `group-${index}`,
        name,
      }))
      setSubCategories(groups)
      setSelectedSubCategory('')
      setMaterialsLoading(false)
    })()
  }, [selectedCategory])

  useEffect(() => {
    if (!selectedCategory) {
      setMaterials([])
      return
    }
    if (selectedSubCategory) {
      void (async () => {
        setMaterialsLoading(true)
        const { data, error } = await supabase
          .from('all_materials')
          .select('id, item_name, class, group')
          .eq('class', selectedCategory)
          .eq('group', selectedSubCategory)
          .order('item_name')
        setMaterialsLoading(false)
        if (error) {
          setMaterials([])
          return
        }
        setMaterials(
          (data ?? []).map((row: { id: string; item_name: string; class: string; group: string }) => ({
            id: row.id,
            name: row.item_name,
            class: row.class,
            group: row.group,
          }))
        )
      })()
      return
    }
    void (async () => {
      setMaterialsLoading(true)
      const { data, error } = await supabase
        .from('all_materials')
        .select('id, item_name, class, group')
        .eq('class', selectedCategory)
        .order('item_name')
        .limit(50)
      setMaterialsLoading(false)
      if (error) {
        setMaterials([])
        return
      }
      setMaterials(
        (data ?? []).map((row: { id: string; item_name: string; class: string; group: string }) => ({
          id: row.id,
          name: row.item_name,
          class: row.class,
          group: row.group,
        }))
      )
    })()
  }, [selectedCategory, selectedSubCategory])

  function handleSearchResult(result: { class: string; group: string; item_name: string }) {
    clearDetailOpenAfterCartTimer()
    setSelectedCategory(result.class)
    setSelectedSubCategory(result.group)
    const item: MaterialItemRn = {
      id: `search-${Date.now()}`,
      name: result.item_name,
      class: result.class,
      group: result.group,
    }
    setSelectedMaterial(item)
    setEditCartItem(null)
    setEditCartIndex(-1)
    setDetailOpen(true)
    setSearchQuery('')
  }

  function openDetail(item: MaterialItemRn) {
    clearDetailOpenAfterCartTimer()
    setSelectedMaterial(item)
    setEditCartItem(null)
    setEditCartIndex(-1)
    setDetailOpen(true)
  }

  function getCartQuantity(itemName: string): number {
    const cartItem = cart.find((c) => c.material_item_name === itemName)
    return cartItem ? parseInt(cartItem.quantity.replace(',', '.')) || 0 : 0
  }

  function handleUpdateQuantity(item: MaterialItemRn, delta: number) {
    setCart((prev) => {
      const index = prev.findIndex((c) => c.material_item_name === item.name)
      if (index === -1) return prev

      const current = prev[index]
      const currentQty = parseInt(current.quantity.replace(',', '.')) || 0
      const newQty = Math.max(0, currentQty + delta)

      if (newQty === 0) {
        return prev.filter((_, i) => i !== index)
      }

      const updated = [...prev]
      updated[index] = { ...current, quantity: String(newQty) }
      return updated
    })
  }

  function handleUpdateUnit(itemId: string, unit: string) {
    setCart((prev) => {
      const index = prev.findIndex((c) => c.id === itemId)
      if (index === -1) return prev

      const updated = [...prev]
      updated[index] = { ...updated[index], unit }
      return updated
    })
  }

  function handleUpdateItem(itemId: string, updates: Partial<CartItemRn>) {
    setCart((prev) => {
      const index = prev.findIndex((c) => c.id === itemId)
      if (index === -1) return prev

      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      return updated
    })
  }

  function openCreateMaterial(prefillName?: boolean) {
    setCreateModalSeed({
      class: selectedCategory,
      group: selectedSubCategory,
      item_name: prefillName ? searchQuery.trim() : '',
    })
    setCreateModalOpen(true)
  }

  async function handleSubmitCart() {
    if (!user || !profile) return
    if (!selectedSite) {
      Alert.alert(t('createRequest.pickSiteTitle'), t('createRequest.pickSiteBody'))
      return
    }
    if (cart.length === 0) return

    const errors: string[] = []
    cart.forEach((item, index) => {
      const label = item.material_name || t('createRequest.productN', { n: index + 1 })
      if (!item.unit) errors.push(t('createRequest.validationUnit', { label }))
      if (!item.quantity) errors.push(t('createRequest.validationQty', { label }))
      if (!item.delivery_date) errors.push(t('createRequest.validationDelivery', { label }))
      if (!item.purpose) errors.push(t('createRequest.validationPurpose', { label }))
      const qty = parseFloat(item.quantity.replace(',', '.'))
      if (isNaN(qty) || qty <= 0) errors.push(t('createRequest.validationQtyInvalid', { label }))
    })
    if (errors.length) {
      Alert.alert(t('createRequest.missingLine'), errors[0])
      return
    }

    setSubmitting(true)
    try {
      const materialsPayload = await Promise.all(
        cart.map(async (material) => {
          let imageUrls: string[] = []
          if (material.pendingImageUris.length > 0) {
            imageUrls = await uploadPurchaseMaterialImages(supabase, material.id, material.pendingImageUris)
          }
          const quantity = parseFloat(material.quantity.replace(',', '.'))
          return {
            material_name: material.material_name,
            quantity: Math.round(quantity),
            unit: material.unit,
            brand: material.brand || undefined,
            material_class: material.material_class,
            material_group: material.material_group,
            material_item_name: material.material_item_name,
            specifications: material.specifications || undefined,
            purpose: material.purpose,
            delivery_date: material.delivery_date.trim(),
            image_urls: imageUrls.length ? imageUrls : undefined,
          }
        })
      )

      const res = await createMultiMaterialPurchaseRequest(supabase, user, profile, {
        site_id: selectedSite.id,
        site_name: selectedSite.name,
        materials: materialsPayload,
      })

      if (!res.success) {
        Alert.alert(t('common.error'), res.error)
        return
      }

      setCart([])
      setCartDrawerOpen(false)
      Alert.alert(t('createRequest.createdTitle'), t('createRequest.createdBody', { number: res.requestNumber }), [
        { text: t('requestsList.tabRequests'), onPress: () => router.back() },
        { text: t('common.detail'), onPress: () => router.replace(`/(app)/requests/${res.requestId}`) },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('createRequest.createFail')
      Alert.alert(t('common.error'), msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleMaterialCreated(material: { class: string; group: string; item_name: string }) {
    const key = `${material.class}|${material.group}|${material.item_name}`.toLocaleLowerCase('tr-TR').trim()
    setLocalCreatedMaterials((prev) => {
      const exists = prev.some(
        (item) =>
          `${item.class}|${item.group}|${item.item_name}`.toLocaleLowerCase('tr-TR').trim() === key
      )
      if (exists) return prev
      return [material, ...prev].slice(0, 100)
    })

    const created: MaterialItemRn = {
      id: `new-${Date.now()}`,
      name: material.item_name,
      class: material.class || selectedCategory || 'Genel',
      group: material.group || selectedSubCategory || '',
    }
    setSelectedCategory(created.class || selectedCategory)
    setSelectedSubCategory(created.group || '')

    // Malzemeleri yükle
    if (material.class && material.group) {
      void (async () => {
        setMaterialsLoading(true)
        const { data } = await supabase
          .from('all_materials')
          .select('id, item_name, class, group')
          .eq('class', material.class)
          .eq('group', material.group)
          .order('item_name')
        setMaterialsLoading(false)
        setMaterials(
          (data ?? []).map((row: { id: string; item_name: string; class: string; group: string }) => ({
            id: row.id,
            name: row.item_name,
            class: row.class,
            group: row.group,
          }))
        )
      })()
    }

    // Alert göster, kullanıcı OK'a basınca detay modalını aç
    Alert.alert(
      t('createRequest.materialAddedTitle'),
      t('createRequest.materialAddedBody', { name: material.item_name }),
      [
        {
          text: t('common.ok'),
          onPress: () => {
            setSelectedMaterial(created)
            setEditCartItem(null)
            setEditCartIndex(-1)
            clearDetailOpenAfterCartTimer()
            setDetailOpen(true)
          },
        },
      ]
    )
  }

  if (!profile || !user) return null

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#01E884" />
        <Text style={styles.muted}>{t('createRequest.loading')}</Text>
      </View>
    )
  }

  if (pageStep === 'site-selection' && sites.length > 0 && !selectedSite) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.siteTitle}>{t('createRequest.siteTitle')}</Text>
        <Text style={styles.siteSub}>{t('createRequest.siteSub')}</Text>
        <View style={styles.siteGrid}>
          {sites.map((s) => (
            <Pressable
              key={s.id}
              style={styles.siteCard}
              onPress={() => {
                setSelectedSite(s)
                setIsGenelMerkezUser(s.name === 'Genel Merkez Ofisi')
                setPageStep('shopping')
              }}
            >
              {s.image_url ? (
                <Image
                  source={{ uri: s.image_url }}
                  style={styles.siteCardImageFull}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.siteCardPlaceholderBg}>
                  <Text style={styles.siteCardPlaceholderLetter}>
                    {s.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.siteCardOverlay}>
                <Text style={styles.siteCardTextOverlay}>{s.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    )
  }

  /** Sepet çubuğu + alt ada: içerik kaydırılırken son tutamağı kapatmasın */
  const floatingCartFooter =
    insets.bottom + ISLAND_CART_BAR_CLEARANCE + 56

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ padding: 16, paddingBottom: floatingCartFooter }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.pageHeader}>
          {selectedSite ? (
            <Text style={styles.siteNameHeading} numberOfLines={2}>
              {selectedSite.name}
            </Text>
          ) : (
            <Text style={styles.warn}>{t('createRequest.noSiteOfficeWarn')}</Text>
          )}
        </View>

        <MaterialSearchBarRn
          supabase={supabase}
          value={searchQuery}
          onChange={setSearchQuery}
          restrictToStationery={selectedSiteIsGmo}
          allowedCategoryNames={allowedSearchCategories}
          localCreatedMaterials={localCreatedMaterials}
          onResultClick={handleSearchResult}
          onCreateNewClick={() => openCreateMaterial(true)}
        />

        {categoriesLoading ? (
          <CategoryTabSkeleton />
        ) : (
          <CategoryTabsRn
            categories={filteredCategories}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            subCategories={subCategories}
            selectedSubCategory={selectedSubCategory}
            onSubCategorySelect={setSelectedSubCategory}
            isLoading={categoriesLoading}
          />
        )}

        {materialsLoading ? (
          <View style={styles.grid}>
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
          </View>
        ) : materials.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>{t('createRequest.emptyProductsTitle')}</Text>
            <Text style={styles.emptySub}>{t('createRequest.emptyProductsSub')}</Text>
            <Pressable style={styles.emptyBtn} onPress={() => openCreateMaterial(false)}>
              <Text style={styles.emptyBtnText}>{t('createRequest.addNewMaterialBtn')}</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Pressable style={styles.newCardWide} onPress={() => openCreateMaterial(false)}>
              <Text style={styles.newCardPlus}>＋</Text>
              <Text style={styles.newCardText}>{t('createRequest.newMaterialShort')}</Text>
            </Pressable>
            <View style={styles.grid}>
              {materials.map((item) => (
                <MaterialCardRn
                  key={item.id}
                  item={item}
                  cartQuantity={getCartQuantity(item.name)}
                  onUpdateQuantity={handleUpdateQuantity}
                  onOpenDetail={openDetail}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <CartBottomBarRn count={cart.length} onOpenCart={() => setCartDrawerOpen(true)} />

      <CartDrawerRn
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        items={cart}
        onRemove={(id) => setCart((c) => c.filter((x) => x.id !== id))}
        onEdit={(item, index) => {
          clearDetailOpenAfterCartTimer()
          setSelectedMaterial({
            id: item.id,
            name: item.material_item_name,
            class: item.material_class,
            group: item.material_group,
          })
          setEditCartItem(item)
          setEditCartIndex(index)
          setCartDrawerOpen(false)
          detailOpenAfterCartCloseRef.current = setTimeout(() => {
            detailOpenAfterCartCloseRef.current = null
            setDetailOpen(true)
          }, 400)
        }}
        onUpdateUnit={handleUpdateUnit}
        onUpdateItem={handleUpdateItem}
        onSubmit={() => void handleSubmitCart()}
        submitting={submitting}
      />

      <MaterialDetailModalRn
        visible={detailOpen}
        item={selectedMaterial}
        materialClass={selectedMaterial?.class || selectedCategory}
        materialGroup={selectedMaterial?.group || selectedSubCategory}
        editItem={editCartItem}
        editIndex={editCartIndex}
        onClose={() => {
          clearDetailOpenAfterCartTimer()
          setDetailOpen(false)
          setEditCartItem(null)
          setEditCartIndex(-1)
        }}
        onAdd={(line) => setCart((prev) => [...prev, line])}
        onUpdate={(index, line) => {
          setCart((prev) => {
            const next = [...prev]
            next[index] = line
            return next
          })
        }}
      />

      <CreateMaterialModalRn
        supabase={supabase}
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialClass={createModalSeed.class}
        initialGroup={createModalSeed.group}
        initialItemName={createModalSeed.item_name}
        restrictToStationery={selectedSiteIsGmo}
        onCreated={handleMaterialCreated}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#ffffff' },
  root: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  muted: { marginTop: 8, color: '#6b7280', fontSize: 14 },
  pageHeader: {
    paddingBottom: 12,
    marginBottom: 2,
  },
  siteTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  siteSub: { fontSize: 15, color: '#6b7280', marginBottom: 20 },
  backLink: { marginBottom: 16 },
  backLinkText: { fontSize: 16, color: '#01E884', fontWeight: '600' },
  siteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  siteCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#d1d5db',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'flex-end',
  },
  siteCardImageFull: {
    ...StyleSheet.absoluteFillObject,
  },
  siteCardPlaceholderBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  siteCardPlaceholderLetter: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
    opacity: 0.6,
  },
  siteCardOverlay: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  siteCardTextOverlay: {
    fontWeight: '700',
    fontSize: 15,
    color: '#ffffff',
  },
  siteNameHeading: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  warn: { color: '#b45309', fontWeight: '600', fontSize: 14, lineHeight: 20 },
  loadingBlock: { alignItems: 'center', paddingVertical: 48 },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 14, color: '#6b7280', marginTop: 8, marginBottom: 20, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { fontWeight: '700', color: '#111827', fontSize: 15 },
  newCardWide: {
    width: '100%',
    minHeight: 70,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#00c853',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 12,
    padding: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  newCard: {
    width: '48%',
    minHeight: 108,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#00c853',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    padding: 14,
  },
  newCardPlus: { fontSize: 26, fontWeight: '400', color: '#00c853' },
  newCardText: { fontWeight: '600', color: '#111827', marginTop: 6, fontSize: 14 },
  matCard: {
    width: '48%',
    minHeight: 108,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  matCardInCart: {
    borderColor: '#01E884',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    shadowColor: '#01E884',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  matName: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  matSub: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  inCartTag: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ecfdf5',
  },
})