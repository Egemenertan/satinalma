'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { createMultiMaterialPurchaseRequest } from '@/lib/actions'
import { 
  ArrowLeft, 
  Loader2,
  Package
} from 'lucide-react'
import { CreateMaterialModal } from '@/components/CreateMaterialModal'
import { MaterialSearchBar } from '@/components/MaterialSearchBar'
import { ProductSearchBar } from '@/components/ProductSearchBar'
import { SPECIAL_SITE_ID, SPECIAL_SITE_PRODUCT_CATEGORIES } from '@/lib/constants'

import {
  CategoryTabs,
  MaterialCard,
  NewMaterialCard,
  MaterialDetailModal,
  CartBottomBar,
  CartDrawer
} from './components'

import type { 
  CartItem, 
  MaterialCategory, 
  MaterialGroup, 
  MaterialItem, 
  Site,
  PageStep,
  ModalState
} from './types'

export default function CreatePurchaseRequestPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const supabase = createClient()
  
  // Page state
  const [pageStep, setPageStep] = useState<PageStep>('shopping')
  const [loading, setLoading] = useState(false)
  const [isCheckingSite, setIsCheckingSite] = useState(true)
  
  // Site state
  const [sites, setSites] = useState<Site[]>([])
  const [userSite, setUserSite] = useState<Site | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [siteImages, setSiteImages] = useState<Record<string, string>>({})
  
  // User type state
  const [isGenelMerkezUser, setIsGenelMerkezUser] = useState(false)
  const [isSpecialSiteUser, setIsSpecialSiteUser] = useState(false)
  
  // Category state
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subCategories, setSubCategories] = useState<MaterialGroup[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false)
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Modal state
  const [modalState, setModalState] = useState<ModalState>({ type: null })
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null)
  const [editingCartIndex, setEditingCartIndex] = useState<number>(-1)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  
  // Create Material Modal
  const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false)
  const [createMaterialData, setCreateMaterialData] = useState({
    class: '',
    group: '',
    item_name: ''
  })

  // Fetch initial data
  useEffect(() => {
    fetchUserAndSites()
    fetchCategories()
  }, [])

  // Fetch sub-categories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubCategories(selectedCategory)
      setSelectedSubCategory('')
      setMaterials([])
    }
  }, [selectedCategory])

  // Fetch materials when sub-category changes
  useEffect(() => {
    if (selectedCategory && selectedSubCategory) {
      fetchMaterials(selectedCategory, selectedSubCategory)
    } else if (selectedCategory && !selectedSubCategory && subCategories.length > 0) {
      // Fetch all materials for the category
      fetchAllMaterialsForCategory(selectedCategory)
    }
  }, [selectedSubCategory, selectedCategory, subCategories])

  const fetchUserAndSites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let userSiteIds: string[] = []
      
      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('site_id, construction_site_id, role')
          .eq('id', user.id)
          .single()

        if (!profileError && profileData) {
          // KRİTİK GÜVENLİK: Site ID kontrolü
          const requiresSiteId = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(profileData.role)
          
          if (profileData.site_id && Array.isArray(profileData.site_id) && profileData.site_id.length > 0) {
            userSiteIds = profileData.site_id
          } else if (profileData.construction_site_id) {
            userSiteIds = [profileData.construction_site_id]
          }
          
          // Eğer site_id zorunlu olan rollerde site ataması yoksa, geri gönder
          if (requiresSiteId && userSiteIds.length === 0) {
            showToast('Site ataması yapılmadan talep oluşturamazsınız. Lütfen yöneticinize başvurun.', 'error')
            router.push('/dashboard/requests')
            return
          }

          if (userSiteIds.length === 1) {
            const { data: siteData, error: siteError } = await supabase
              .from('sites')
              .select('id, name, image_url')
              .eq('id', userSiteIds[0])
              .single()

            if (!siteError && siteData) {
              setUserSite(siteData)
              setSelectedSite(siteData)
              
              if (siteData.id === SPECIAL_SITE_ID) {
                setIsSpecialSiteUser(true)
              }
              
              if (siteData.name === 'Genel Merkez Ofisi') {
                setIsGenelMerkezUser(true)
              }
            }
          } else if (userSiteIds.length > 1) {
            const { data: userSitesData, error: sitesError } = await supabase
              .from('sites')
              .select('id, name, image_url')
              .in('id', userSiteIds)
              .order('name')

            if (!sitesError && userSitesData) {
              setSites(userSitesData)
              setPageStep('site-selection')
              
              const imageMap: Record<string, string> = {}
              userSitesData.forEach((site: Site) => {
                if (site.image_url) {
                  imageMap[site.name] = site.image_url
                }
              })
              setSiteImages(imageMap)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsCheckingSite(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('material_categories')
        .select('*')
        .order('name')

      if (!error && data) {
        setCategories(data)
        if (data.length > 0) {
          setSelectedCategory(data[0].name)
        }
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
        const uniqueGroups = [...new Set(data.map(item => item.group))].filter(Boolean)
        const groups: MaterialGroup[] = uniqueGroups.map((name, index) => ({
          id: `group-${index}`,
          name: name as string
        }))
        setSubCategories(groups)
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
        const items: MaterialItem[] = data.map(item => ({
          id: item.id,
          name: item.item_name,
          class: item.class,
          group: item.group
        }))
        setMaterials(items)
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
        const items: MaterialItem[] = data.map(item => ({
          id: item.id,
          name: item.item_name,
          class: item.class,
          group: item.group
        }))
        setMaterials(items)
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setIsMaterialsLoading(false)
    }
  }

  const handleSiteSelect = (site: Site) => {
    setSelectedSite(site)
    
    if (site.id === SPECIAL_SITE_ID) {
      setIsSpecialSiteUser(true)
    }
    
    if (site.name === 'Genel Merkez Ofisi') {
      setIsGenelMerkezUser(true)
    }
    
    setPageStep('shopping')
  }

  const handleMaterialClick = (item: MaterialItem) => {
    setSelectedMaterial(item)
    setEditingCartItem(null)
    setEditingCartIndex(-1)
    setModalState({ type: 'detail', item })
  }

  const handleAddToCart = (cartItem: CartItem) => {
    setCart(prev => [...prev, cartItem])
    showToast(`${cartItem.material_name} sepete eklendi`, 'success')
    setModalState({ type: null })
  }

  const handleUpdateCartItem = (updatedItem: CartItem) => {
    if (editingCartIndex >= 0) {
      setCart(prev => {
        const newCart = [...prev]
        newCart[editingCartIndex] = updatedItem
        return newCart
      })
      showToast(`${updatedItem.material_name} güncellendi`, 'success')
    }
    setModalState({ type: null })
    setEditingCartItem(null)
    setEditingCartIndex(-1)
  }

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
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

  const handleSearchResultClick = async (result: { class: string; group: string; item_name: string }) => {
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

  const handleProductSelect = (product: any) => {
    const newCartItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      material_class: product.category?.name || 'Genel',
      material_group: product.brand?.name || '',
      material_item_name: product.name,
      material_name: product.name,
      material_description: product.name,
      unit: product.unit || 'adet',
      quantity: '1',
      brand: product.brand?.name || '',
      specifications: '',
      purpose: '',
      delivery_date: '',
      image_urls: [],
      uploaded_images: [],
      image_preview_urls: [],
      product_id: product.id
    }

    // Open modal to complete details
    const materialItem: MaterialItem = {
      id: newCartItem.id,
      name: product.name,
      class: product.category?.name || 'Genel',
      group: product.brand?.name || ''
    }
    setSelectedMaterial(materialItem)
    setEditingCartItem(null)
    setEditingCartIndex(-1)
    setModalState({ type: 'detail', item: materialItem })
    setProductSearchQuery('')
  }

  const uploadImagesForMaterial = async (materialId: string, files: File[]): Promise<string[]> => {
    if (files.length === 0) return []
    
    const uploadedUrls: string[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileExt = file.name.split('.').pop()
      const uniqueId = Math.random().toString(36).substring(2, 15)
      const fileName = `purchase_requests/materials/${materialId}/${Date.now()}_${uniqueId}.${fileExt}`
      
      try {
        const { data, error } = await supabase.storage
          .from('satinalma')
          .upload(fileName, file)

        if (error) throw error

        const { data: urlData } = supabase.storage
          .from('satinalma')
          .getPublicUrl(fileName)

        uploadedUrls.push(urlData.publicUrl)
      } catch (error) {
        console.error('Image upload error:', error)
        throw new Error(`${materialId} malzemesi için resim yüklenirken hata oluştu`)
      }
    }
    
    return uploadedUrls
  }

  const handleSubmit = async () => {
    if (cart.length === 0) {
      showToast('Sepetinizde ürün bulunmuyor', 'error')
      return
    }

    const invalidItems = cart.filter(item => !item.unit || !item.quantity || !item.delivery_date || !item.purpose)
    if (invalidItems.length > 0) {
      showToast('Lütfen tüm ürünlerin detaylarını doldurun', 'error')
      return
    }

    setLoading(true)
    
    try {
      const materialsWithImages = await Promise.all(
        cart.map(async (material) => {
          let imageUrls: string[] = []
          
          if (material.uploaded_images && material.uploaded_images.length > 0) {
            showToast(`${material.material_name} için resimler yükleniyor...`, 'info')
            imageUrls = await uploadImagesForMaterial(material.id, material.uploaded_images)
          }
          
          return {
            material_name: material.material_name,
            quantity: Math.round(parseFloat(material.quantity)),
            unit: material.unit,
            brand: material.brand,
            material_class: material.material_class,
            material_group: material.material_group,
            material_item_name: material.material_item_name,
            specifications: material.specifications,
            purpose: material.purpose,
            delivery_date: material.delivery_date,
            image_urls: imageUrls,
            product_id: material.product_id
          }
        })
      )

      const result = await createMultiMaterialPurchaseRequest({
        materials: materialsWithImages,
        site_id: selectedSite?.id || userSite?.id,
        site_name: selectedSite?.name || userSite?.name,
        specifications: ''
      })

      if (!result.success) {
        showToast(`Hata: ${result.error}`, 'error')
        setLoading(false)
        return
      }

      showToast(result.message || 'Talep başarıyla oluşturuldu!', 'success')
      router.refresh()
      try {
        sessionStorage.setItem('requests_scroll_from_create', '1')
      } catch {
        /* ignore */
      }
      router.push('/dashboard/requests')
      
    } catch (error) {
      console.error('Submit error:', error)
      showToast('Talep oluşturulurken bir hata oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const isItemInCart = (itemName: string) => {
    return cart.some(cartItem => cartItem.material_item_name === itemName)
  }

  const filteredCategories = categories.filter((category) => {
    const officeCategories = [
      'Kırtasiye Malzemeleri',
      'Reklam Ürünleri',
      'Ofis Ekipmanları',
      'Promosyon Ürünleri',
      'Mutfak Malzemeleri',
      'Hijyen ve Temizlik'
    ]
    if (officeCategories.includes(category.name)) {
      return isGenelMerkezUser
    }
    return !isGenelMerkezUser
  })

  // Loading state
  if (isCheckingSite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Site selection step
  if (pageStep === 'site-selection' && sites.length > 0) {
    return (
      <div className="min-h-screen px-4 py-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-5xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-8 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Lokasyon Seçin</h1>
            <p className="text-gray-600">Talep oluşturmak için bir lokasyon seçin</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sites.map((site) => {
              const hasImage = siteImages[site.name]
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSiteSelect(site)}
                  className="aspect-square p-4 rounded-3xl transition-all duration-200 relative overflow-hidden hover:shadow-lg hover:scale-[1.02] group border border-gray-200"
                  style={{
                    backgroundImage: hasImage ? `url(${siteImages[site.name]})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: hasImage ? 'transparent' : '#f9fafb'
                  }}
                >
                  {hasImage ? (
                    <>
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-200" />
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-white transition-all duration-200" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                    <span className={`text-center leading-tight font-semibold block text-base ${hasImage ? 'text-white drop-shadow-lg' : 'text-gray-800'} transition-colors`}>
                      {site.name}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Shopping step (main)
  return (
    <div className="min-h-screen pb-24 bg-gradient-to-br from-gray-50 to-white">
      {/* Search & Categories */}
      <div className="px-4 pt-6">
        {/* Search Bar */}
        <div className="mb-3">
          {isSpecialSiteUser ? (
            <ProductSearchBar
              value={productSearchQuery}
              onChange={setProductSearchQuery}
              onProductSelect={handleProductSelect}
              categoryIds={SPECIAL_SITE_PRODUCT_CATEGORIES as any}
              placeholder="Ürün ara (Bilgisayar, Ofis Malzemeleri, Reklam)..."
              className="w-full"
            />
          ) : (
            <MaterialSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onResultClick={handleSearchResultClick}
              onCreateNewClick={() => {
                setCreateMaterialData({ class: selectedCategory, group: selectedSubCategory, item_name: searchQuery })
                setShowCreateMaterialModal(true)
              }}
              onEnterSearch={() => {}}
              restrictToStationery={isGenelMerkezUser}
              className="w-full"
            />
          )}
        </div>

        {/* Category Tabs */}
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

      {/* Materials Grid */}
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
                variant="outline"
                onClick={() => {
                  setCreateMaterialData({ class: selectedCategory, group: selectedSubCategory, item_name: '' })
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
            {/* New Material Card */}
            <NewMaterialCard
              onClick={() => {
                setCreateMaterialData({ class: selectedCategory, group: selectedSubCategory, item_name: '' })
                setShowCreateMaterialModal(true)
              }}
            />

            {/* Material Cards */}
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

      {/* Cart Bottom Bar */}
      <CartBottomBar
        itemCount={cart.length}
        onViewCart={() => setModalState({ type: 'cart' })}
        onCheckout={() => setModalState({ type: 'cart' })}
        isVisible={true}
      />

      {/* Cart Drawer */}
      <CartDrawer
        open={modalState.type === 'cart'}
        onOpenChange={(open) => !open && setModalState({ type: null })}
        items={cart}
        onRemoveItem={handleRemoveFromCart}
        onEditItem={handleEditCartItem}
        onSubmit={handleSubmit}
        isLoading={loading}
      />

      {/* Material Detail Modal */}
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

      {/* Create Material Modal */}
      <CreateMaterialModal
        open={showCreateMaterialModal}
        onOpenChange={setShowCreateMaterialModal}
        initialClass={createMaterialData.class}
        initialGroup={createMaterialData.group}
        onMaterialCreated={(material) => {
          if (material.class && material.group) {
            fetchMaterials(material.class, material.group)
          }
        }}
      />
    </div>
  )
}
