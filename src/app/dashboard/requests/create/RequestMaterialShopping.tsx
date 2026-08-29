'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Loader2, Package } from 'lucide-react'
import { CreateMaterialModal } from '@/components/CreateMaterialModal'
import { MaterialSearchBar } from '@/components/MaterialSearchBar'
import { SPECIAL_SITE_ID } from '@/lib/constants'
import {
  CategoryTabs,
  MaterialCard,
  NewMaterialCard,
  MaterialDetailModal,
  CartBottomBar,
  CartDrawer
} from './components'
import type { CartItem, MaterialCategory, MaterialGroup, MaterialItem, ModalState } from './types'

const HYGIENE_DEFAULT_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7' as const
const HYGIENE_DEFAULT_CATEGORY = 'Hijyen ve Temizlik' as const

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

const OFFICE_CATEGORY_KEYWORDS = [
  'hijyen',
  'kirtasiye',
  'mutfak',
  'ofis ekipman',
  'promosyon',
  'reklam'
] as const

const isOfficeCategory = (categoryName: string): boolean => {
  const normalized = normalizeCategoryName(categoryName)
  return OFFICE_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export type RequestMaterialShoppingProps = {
  initialCart?: CartItem[]
  onConfirm: (cart: CartItem[]) => void | Promise<void>
  onCancel?: () => void
  confirmLabel?: string
  confirmLoadingLabel?: string
  isSubmitting?: boolean
  title?: string
  overlay?: boolean
}

export function RequestMaterialShopping({
  initialCart = [],
  onConfirm,
  onCancel,
  confirmLabel = 'Talebi Gönder',
  confirmLoadingLabel = 'Gönderiliyor...',
  isSubmitting = false,
  title,
  overlay = false
}: RequestMaterialShoppingProps) {
  const { showToast } = useToast()
  const supabase = createClient()

  const [isGenelMerkezUser, setIsGenelMerkezUser] = useState(false)
  const [hasHygieneDefaultSite, setHasHygieneDefaultSite] = useState(false)
  const [hasMultipleSiteTypes, setHasMultipleSiteTypes] = useState(false)
  const hasOfficeCategoryAccess = isGenelMerkezUser || hasHygieneDefaultSite || hasMultipleSiteTypes

  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subCategories, setSubCategories] = useState<MaterialGroup[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false)

  const [cart, setCart] = useState<CartItem[]>(initialCart)
  const [modalState, setModalState] = useState<ModalState>({ type: null })
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null)
  const [editingCartIndex, setEditingCartIndex] = useState(-1)

  const [searchQuery, setSearchQuery] = useState('')
  const [localCreatedMaterials, setLocalCreatedMaterials] = useState<
    Array<{ class: string; group: string; item_name: string }>
  >([])
  const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false)
  const [createMaterialData, setCreateMaterialData] = useState({
    class: '',
    group: '',
    item_name: ''
  })

  useEffect(() => {
    void fetchUserFlags()
    void fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      void fetchSubCategories(selectedCategory)
      setSelectedSubCategory('')
      setMaterials([])
    }
  }, [selectedCategory])

  useEffect(() => {
    if (selectedCategory && selectedSubCategory) {
      void fetchMaterials(selectedCategory, selectedSubCategory)
    } else if (selectedCategory && !selectedSubCategory && subCategories.length > 0) {
      void fetchAllMaterialsForCategory(selectedCategory)
    }
  }, [selectedSubCategory, selectedCategory, subCategories])

  const fetchUserFlags = async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('site_id, construction_site_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) return

      let userSiteIds: string[] = []
      if (profileData.site_id && Array.isArray(profileData.site_id) && profileData.site_id.length > 0) {
        userSiteIds = profileData.site_id
      } else if (profileData.construction_site_id) {
        userSiteIds = [profileData.construction_site_id]
      }

      setHasHygieneDefaultSite(userSiteIds.includes(HYGIENE_DEFAULT_SITE_ID))

      const hasGenelMerkez = userSiteIds.includes(SPECIAL_SITE_ID)
      const hasOtherSites = userSiteIds.some((id) => id !== SPECIAL_SITE_ID)
      if (hasGenelMerkez && hasOtherSites) {
        setHasMultipleSiteTypes(true)
      }

      if (userSiteIds.length === 1) {
        const { data: siteData } = await supabase
          .from('sites')
          .select('id, name')
          .eq('id', userSiteIds[0])
          .single()
        if (siteData?.name === 'Genel Merkez Ofisi') {
          setIsGenelMerkezUser(true)
        }
      } else if (hasGenelMerkez) {
        setIsGenelMerkezUser(true)
      }
    } catch (error) {
      console.error('Error fetching shopping user flags:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('material_categories').select('*').order('name')
      if (!error && data) {
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setIsCategoriesLoading(false)
    }
  }

  const fetchSubCategories = async (categoryName: string) => {
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('group')
        .eq('class', categoryName)
        .order('group')

      if (!error && data) {
        const uniqueGroups = [...new Set(data.map((item) => item.group))].filter(Boolean)
        setSubCategories(
          uniqueGroups.map((name, index) => ({
            id: `group-${index}`,
            name: name as string
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching sub-categories:', error)
    }
  }

  const fetchMaterials = async (categoryName: string, groupName: string) => {
    setIsMaterialsLoading(true)
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('id, item_name, class, group')
        .eq('class', categoryName)
        .eq('group', groupName)
        .order('item_name')

      if (!error && data) {
        setMaterials(
          data.map((item) => ({
            id: item.id,
            name: item.item_name,
            class: item.class,
            group: item.group
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setIsMaterialsLoading(false)
    }
  }

  const fetchAllMaterialsForCategory = async (categoryName: string) => {
    setIsMaterialsLoading(true)
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('id, item_name, class, group')
        .eq('class', categoryName)
        .order('item_name')
        .limit(50)

      if (!error && data) {
        setMaterials(
          data.map((item) => ({
            id: item.id,
            name: item.item_name,
            class: item.class,
            group: item.group
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setIsMaterialsLoading(false)
    }
  }

  const handleMaterialClick = (item: MaterialItem) => {
    setSelectedMaterial(item)
    setEditingCartItem(null)
    setEditingCartIndex(-1)
    setModalState({ type: 'detail', item })
  }

  const handleAddToCart = (cartItem: CartItem) => {
    setCart((prev) => [...prev, cartItem])
    showToast(`${cartItem.material_name} sepete eklendi`, 'success')
    setModalState({ type: null })
  }

  const handleUpdateCartItem = (updatedItem: CartItem) => {
    if (editingCartIndex >= 0) {
      setCart((prev) => {
        const next = [...prev]
        next[editingCartIndex] = updatedItem
        return next
      })
      showToast(`${updatedItem.material_name} güncellendi`, 'success')
    }
    setModalState({ type: null })
    setEditingCartItem(null)
    setEditingCartIndex(-1)
  }

  const handleRemoveFromCart = (id: string, index?: number) => {
    setCart((prev) => {
      if (typeof index === 'number' && index >= 0 && index < prev.length) {
        return prev.filter((_, i) => i !== index)
      }
      return prev.filter((item) => item.id !== id)
    })
    showToast('Ürün sepetten çıkarıldı', 'info')
  }

  const handleEditCartItem = (item: CartItem, index: number) => {
    const materialItem: MaterialItem = {
      id: item.id,
      name: item.material_item_name,
      class: item.material_class,
      group: item.material_group
    }
    setSelectedMaterial(materialItem)
    setEditingCartItem(item)
    setEditingCartIndex(index)
    setModalState({ type: 'detail', item: materialItem, editIndex: index })
  }

  const handleSearchResultClick = (result: { class: string; group: string; item_name: string }) => {
    const newItem: MaterialItem = {
      id: `search-${Date.now()}`,
      name: result.item_name,
      class: result.class,
      group: result.group
    }
    setSelectedMaterial(newItem)
    setSelectedCategory(result.class)
    setSelectedSubCategory(result.group)
    setEditingCartItem(null)
    setEditingCartIndex(-1)
    setModalState({ type: 'detail', item: newItem })
  }

  const handleConfirm = () => {
    if (cart.length === 0) {
      showToast('Sepetinizde ürün bulunmuyor', 'error')
      return
    }

    for (const [index, item] of cart.entries()) {
      const itemName = item.material_name || `Ürün ${index + 1}`
      if (!item.unit) {
        showToast(`${itemName}: Birim seçilmeli`, 'error')
        return
      }
      if (!item.quantity) {
        showToast(`${itemName}: Miktar girilmeli`, 'error')
        return
      }
      if (!item.delivery_date) {
        showToast(`${itemName}: Teslimat tarihi seçilmeli`, 'error')
        return
      }
      if (!item.purpose) {
        showToast(`${itemName}: Kullanım amacı girilmeli`, 'error')
        return
      }
      const qty = parseFloat(item.quantity)
      if (Number.isNaN(qty) || qty <= 0) {
        showToast(`${itemName}: Geçerli bir miktar girilmeli`, 'error')
        return
      }
    }

    void onConfirm(cart)
  }

  const isItemInCart = (itemName: string) =>
    cart.some((cartItem) => cartItem.material_item_name === itemName)

  const filteredCategories = categories.filter((category) => {
    if (hasMultipleSiteTypes) return true
    if (isOfficeCategory(category.name)) return hasOfficeCategoryAccess
    return !hasOfficeCategoryAccess
  })

  const allowedSearchCategories = hasMultipleSiteTypes
    ? filteredCategories.map((category) => category.name)
    : hasOfficeCategoryAccess
      ? filteredCategories.filter((category) => isOfficeCategory(category.name)).map((category) => category.name)
      : filteredCategories.map((category) => category.name)

  useEffect(() => {
    if (filteredCategories.length === 0) return

    const selectedCategoryStillVisible = filteredCategories.some(
      (category) => category.name === selectedCategory
    )
    if (selectedCategoryStillVisible) return

    if (hasHygieneDefaultSite) {
      const hygieneCategory = filteredCategories.find(
        (category) => category.name === HYGIENE_DEFAULT_CATEGORY
      )
      if (hygieneCategory) {
        setSelectedCategory(hygieneCategory.name)
        return
      }
    }

    setSelectedCategory(filteredCategories[0].name)
  }, [filteredCategories, selectedCategory, hasHygieneDefaultSite])

  return (
    <div className={`${overlay ? 'min-h-full' : 'min-h-screen'} pb-24 bg-gradient-to-br from-gray-50 to-white`}>
      {(onCancel || title) && (
        <div className="px-4 pt-5">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="mb-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Vazgeç
            </Button>
          )}
          {title && <h1 className="text-xl font-semibold text-gray-900 mb-1">{title}</h1>}
          <p className="text-sm text-gray-500 mb-2">
            Mevcut kalemler sepette. Yeni ürün ekleyip sepeti onaylayın.
          </p>
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="mb-3">
          <MaterialSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onResultClick={handleSearchResultClick}
            onCreateNewClick={() => {
              setCreateMaterialData({
                class: selectedCategory,
                group: selectedSubCategory,
                item_name: searchQuery
              })
              setShowCreateMaterialModal(true)
            }}
            onEnterSearch={() => {}}
            restrictToStationery={hasOfficeCategoryAccess && !hasMultipleSiteTypes}
            allowedCategoryNames={allowedSearchCategories}
            localCreatedMaterials={localCreatedMaterials}
            className="w-full"
          />
        </div>

        <CategoryTabs
          categories={filteredCategories}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          subCategories={subCategories}
          selectedSubCategory={selectedSubCategory}
          onSubCategorySelect={setSelectedSubCategory}
          isLoading={isCategoriesLoading}
        />
      </div>

      <div className="px-4 py-4">
        {isMaterialsLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Ürünler yükleniyor...</p>
            </div>
          </div>
        ) : materials.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ürün Bulunamadı</h3>
              <p className="text-gray-600 text-sm mb-6">Bu kategoride henüz ürün bulunmuyor</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateMaterialData({
                    class: selectedCategory,
                    group: selectedSubCategory,
                    item_name: ''
                  })
                  setShowCreateMaterialModal(true)
                }}
                className="rounded-2xl border-gray-200 hover:bg-gray-50 transition-all"
              >
                <Package className="w-4 h-4 mr-2" />
                Yeni Malzeme Ekle
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <NewMaterialCard
              onClick={() => {
                setCreateMaterialData({
                  class: selectedCategory,
                  group: selectedSubCategory,
                  item_name: ''
                })
                setShowCreateMaterialModal(true)
              }}
            />
            {materials.map((item) => (
              <MaterialCard
                key={item.id}
                item={item}
                isInCart={isItemInCart(item.name)}
                onClick={() => handleMaterialClick(item)}
              />
            ))}
          </div>
        )}
      </div>

      <CartBottomBar
        itemCount={cart.length}
        onViewCart={() => setModalState({ type: 'cart' })}
        onCheckout={() => setModalState({ type: 'cart' })}
        isVisible={true}
        flushSidebar={overlay}
      />

      <CartDrawer
        open={modalState.type === 'cart'}
        onOpenChange={(open) => !open && setModalState({ type: null })}
        items={cart}
        onRemoveItem={handleRemoveFromCart}
        onEditItem={handleEditCartItem}
        onSubmit={handleConfirm}
        isLoading={isSubmitting}
        submitLabel={confirmLabel}
        submitLoadingLabel={confirmLoadingLabel}
      />

      <MaterialDetailModal
        open={modalState.type === 'detail'}
        onOpenChange={(open) => {
          if (!open) {
            setModalState({ type: null })
            setEditingCartItem(null)
            setEditingCartIndex(-1)
          }
        }}
        item={selectedMaterial}
        materialClass={selectedMaterial?.class || selectedCategory}
        materialGroup={selectedMaterial?.group || selectedSubCategory}
        onAddToCart={handleAddToCart}
        editItem={editingCartItem}
        onUpdateItem={handleUpdateCartItem}
      />

      <CreateMaterialModal
        open={showCreateMaterialModal}
        onOpenChange={setShowCreateMaterialModal}
        initialClass={createMaterialData.class}
        initialGroup={createMaterialData.group}
        restrictToStationery={hasOfficeCategoryAccess && !hasMultipleSiteTypes}
        onMaterialCreated={(material) => {
          setLocalCreatedMaterials((prev) => {
            const key = `${material.class}|${material.group}|${material.item_name}`
              .toLocaleLowerCase('tr-TR')
              .trim()
            const exists = prev.some(
              (item) =>
                `${item.class}|${item.group}|${item.item_name}`.toLocaleLowerCase('tr-TR').trim() === key
            )
            if (exists) return prev
            return [material, ...prev].slice(0, 100)
          })

          const createdMaterial: MaterialItem = {
            id: `new-${Date.now()}`,
            name: material.item_name,
            class: material.class || selectedCategory || 'Genel',
            group: material.group || selectedSubCategory || ''
          }

          setSelectedMaterial(createdMaterial)
          setEditingCartItem(null)
          setEditingCartIndex(-1)
          setModalState({ type: 'detail', item: createdMaterial })
          showToast(`${material.item_name} oluşturuldu. Detayları girip sepete ekleyin.`, 'success')

          if (material.class && material.group) {
            void fetchMaterials(material.class, material.group)
          }
        }}
      />
    </div>
  )
}
