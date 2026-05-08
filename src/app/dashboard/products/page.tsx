/**
 * Products Page
 * Ürün Yönetimi Sayfası - Minimal, clean layout
 */

'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Package, Boxes, Wrench, ClipboardCheck, UserPlus, FileSpreadsheet } from 'lucide-react'
import { useProducts, useProductModal, useProductFilters, useCreateProduct, useUpdateProduct, useProductsInsights } from './hooks'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import {
  ProductFilters,
  ProductsTable,
  ProductModal,
  ProductsInsights,
} from './components'
import BulkZimmetModal from '@/components/BulkZimmetModal'
import { ZimmetReportModal } from './components/ZimmetReportModal'

interface Site {
  id: string
  name: string
  image_url: string | null
}

interface SiteStock {
  site: Site
  productCount: number
  totalQuantity: number
}

export default function ProductsPage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view')
  const [sites, setSites] = useState<SiteStock[]>([])
  const [loadingSites, setLoadingSites] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [userSiteId, setUserSiteId] = useState<string>('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showBulkZimmetModal, setShowBulkZimmetModal] = useState(false)
  const [showZimmetReportModal, setShowZimmetReportModal] = useState(false)
  const supabase = createClient()
  
  // Hooks
  const {
    searchTerm,
    brandId,
    siteId,
    productType,
    statusFilter,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    setSearchTerm,
    setBrandId,
    setSiteId,
    setProductType,
    setStatusFilter,
    setCurrentPage,
    clearFilters,
  } = useProductFilters()
  
  // Kullanıcı bilgilerini ve rolünü al
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, site_id')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role || '')
          
          // Eğer warehouse_manager, santiye_depo veya purchasing_officer ise
          if (profile.role === 'warehouse_manager' || profile.role === 'santiye_depo' || profile.role === 'purchasing_officer') {
            // site_id varsa ve boş değilse, ilk site_id'yi al
            if (profile.site_id && profile.site_id.length > 0) {
              const firstSiteId = profile.site_id[0]
              setUserSiteId(firstSiteId)
              setSiteId(firstSiteId) // Otomatik olarak siteyi filtrele
            }
            // site_id yoksa veya boşsa, tüm depoları göster (userSiteId boş kalır)
          }
        }
      }
    }
    
    fetchUserInfo()
  }, [])

  // Load sites with stock info
  useEffect(() => {
    const loadSites = async () => {
      try {
        const { data: sitesData, error } = await supabase
          .from('sites')
          .select('id, name, image_url')
          .order('name')
        
        if (error) throw error
        
        // Her site için stok bilgilerini al
        const sitesWithStock = await Promise.all(
          (sitesData || []).map(async (site) => {
            const { data: stockData } = await supabase
              .from('warehouse_stock')
              .select('quantity')
              .eq('warehouse_id', site.id)
            
            const productCount = stockData?.length || 0
            const totalQuantity = stockData?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0
            
            return {
              site,
              productCount,
              totalQuantity
            }
          })
        )
        
        // Tüm siteleri göster (IT depo dahil)
        // Eğer warehouse_manager, santiye_depo veya purchasing_officer ise VE userSiteId varsa sadece kendi sitesini göster
        // userSiteId yoksa (site_id boş) tüm siteleri göster
        if ((userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId) {
          setSites(sitesWithStock.filter(s => s.site.id === userSiteId))
        } else {
          setSites(sitesWithStock)
        }
      } catch (error) {
        console.error('Sites yüklenirken hata:', error)
      } finally {
        setLoadingSites(false)
      }
    }
    
    loadSites()
  }, [userRole, userSiteId])

  const { data: productsData, isLoading } = useProducts(filters, currentPage, pageSize)

  const insightsSiteKey = siteId?.trim() ? siteId : undefined
  const {
    data: productsInsights,
    isLoading: insightsLoading,
    error: insightsError,
  } = useProductsInsights(insightsSiteKey)
  
  const {
    isOpen: isModalOpen,
    selectedProductId,
    activeTab,
    openModal,
    closeModal: originalCloseModal,
    changeTab,
  } = useProductModal()

  // Modal kapatıldığında seçimleri temizle
  const closeModal = () => {
    originalCloseModal()
    setSelectedProducts([])
    setShowBulkActions(false)
  }

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  const products = productsData?.products || []
  const totalCount = productsData?.totalCount || 0
  const totalPages = productsData?.totalPages || 1

  // Handlers
  const handleOpenCreateModal = () => {
    setModalMode('create')
    openModal(null)
  }

  const handleOpenViewModal = (productId: string) => {
    setModalMode('view')
    openModal(productId)
  }

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedProducts(selectedIds)
    setShowBulkActions(selectedIds.length > 0)
  }

  const handleBulkStockOperations = () => {
    if (selectedProducts.length === 0) return
    
    // Toplu zimmet modal'ını aç
    setShowBulkZimmetModal(true)
  }

  const handleBulkZimmetSuccess = () => {
    setShowBulkZimmetModal(false)
    setSelectedProducts([])
    setShowBulkActions(false)
    showToast('Toplu zimmet işlemi başarıyla tamamlandı!', 'success')
    queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
  }

  const handleClearFilters = () => {
    clearFilters()
    // Warehouse manager, purchasing officer ve santiye_depo için site_id'yi koru
    if ((userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId) {
      setSiteId(userSiteId)
    }
    // Product type'ı da temizle
    setProductType('')
  }

  const handleSaveProduct = async (data: any) => {
    try {
      // Seri numaralarını ayır
      const { serial_numbers, ...productData } = data
      
      // Seri numarası varsa has_serial'ı true yap ve açıklamaya ekle
      if (serial_numbers && serial_numbers.trim()) {
        productData.has_serial = true
        
        const serialNumbersList = serial_numbers
          .split(',')
          .map((sn: string) => sn.trim())
          .filter((sn: string) => sn.length > 0)
        
        // Seri numaralarını açıklamaya ekle
        const serialNumbersText = `\n\n--- Seri Numaraları ---\n${serialNumbersList.join('\n')}`
        productData.description = (productData.description || '') + serialNumbersText
      }
      
      if (modalMode === 'create') {
        await createMutation.mutateAsync(productData)
        
        if (serial_numbers && serial_numbers.trim()) {
          const serialCount = serial_numbers.split(',').filter((s: string) => s.trim()).length
          showToast(`Ürün ve ${serialCount} seri numarası başarıyla oluşturuldu!`, 'success')
        } else {
          showToast('Ürün başarıyla oluşturuldu!', 'success')
        }
      } else {
        await updateMutation.mutateAsync({ id: selectedProductId!, updates: productData })
        showToast('Ürün başarıyla güncellendi!', 'success')
      }
      closeModal()
    } catch (error) {
      console.error('Save error:', error)
      showToast('İşlem sırasında hata oluştu', 'error')
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">Stok Yönetimi</h1>
          <p className="text-gray-600 text-base mt-4">
            {(userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId ? 'Deponuzdaki ürünleri görüntüleyin' : 'Tüm ürünleri görüntüleyin ve yönetin'}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 px-4 py-2">
            {totalCount} Ürün
          </Badge>
          {/* Yeni Ürün Ekle butonu sadece santiye_depo için gizli */}
          {userRole && userRole !== 'santiye_depo' && (
            <Button
              onClick={handleOpenCreateModal}
              className="px-8 py-6 rounded-full font-medium text-md bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-3" />
              Yeni Ürün Ekle
            </Button>
          )}
        </div>
      </div>

      <ProductsInsights
        bundle={productsInsights}
        loading={insightsLoading}
        error={insightsError instanceof Error ? insightsError : undefined}
        warehouseName={
          insightsSiteKey ? sites.find(s => s.site.id === insightsSiteKey)?.site.name : undefined
        }
      />

      {/* Site Filters - Elegant Image-based */}
      {/* Warehouse manager, santiye depo ve purchasing officer kullanıcıları için site seçim butonlarını gizle - SADECE site_id varsa */}
      {userRole && !((userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId) && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-gray-400" />
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Depolar</h2>
          </div>

          {loadingSites ? (
            <div className="-mx-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-2 scrollbar-hide">
              <div className="flex w-max flex-col gap-2.5">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSiteId('')
                      setCurrentPage(1)
                    }}
                    className={`inline-flex shrink-0 items-center gap-3 rounded-md border px-4 py-2.5 text-left transition-colors ${
                      !siteId
                        ? 'border-gray-900 bg-gray-50 text-gray-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/80'
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                      <Package className={`h-5 w-5 ${!siteId ? 'text-gray-900' : 'text-gray-500'}`} />
                    </span>
                    <span className="min-w-[5.5rem]">
                      <span className="block text-base font-medium leading-snug">Envanter</span>
                      <span className="text-sm leading-snug text-gray-500">{totalCount} ürün</span>
                    </span>
                  </button>
                  <span className="inline-flex shrink-0 items-center rounded-md border border-dashed border-gray-200 px-4 text-sm text-gray-400">
                    Yükleniyor…
                  </span>
                </div>
              </div>
            </div>
          ) : (
            (() => {
              type DepotChip =
                | { kind: 'all' }
                | { kind: 'site'; site: SiteStock['site']; productCount: number; totalQuantity: number }
              const chips: DepotChip[] = [
                { kind: 'all' },
                ...sites.map((s) => ({
                  kind: 'site' as const,
                  site: s.site,
                  productCount: s.productCount,
                  totalQuantity: s.totalQuantity,
                })),
              ]
              const firstRowLen = Math.ceil(chips.length / 2)
              const row1 = chips.slice(0, firstRowLen)
              const row2 = chips.slice(firstRowLen)

              const chipClass = (selected: boolean, isSite: boolean) =>
                `inline-flex shrink-0 max-w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-md border px-4 py-2.5 text-left transition-colors ${
                  selected
                    ? isSite
                      ? 'border-primary-600 bg-primary-50/60 text-gray-900'
                      : 'border-gray-900 bg-gray-50 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/80'
                }`

              const renderChip = (chip: DepotChip) => {
                if (chip.kind === 'all') {
                  return (
                    <button
                      key="all"
                      type="button"
                      onClick={() => {
                        setSiteId('')
                        setCurrentPage(1)
                      }}
                      className={chipClass(!siteId, false)}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                        <Package className={`h-5 w-5 ${!siteId ? 'text-gray-900' : 'text-gray-500'}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-medium leading-snug">Envanter</span>
                        <span className="text-sm leading-snug text-gray-500">{totalCount} ürün</span>
                      </span>
                    </button>
                  )
                }
                const selected = siteId === chip.site.id
                return (
                  <button
                    key={chip.site.id}
                    type="button"
                    onClick={() => {
                      setSiteId(chip.site.id)
                      setCurrentPage(1)
                    }}
                    className={chipClass(selected, true)}
                  >
                    {chip.site.image_url ? (
                      <img
                        src={chip.site.image_url}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${
                          selected ? 'border-primary-200 bg-white' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-base font-medium leading-snug">{chip.site.name}</span>
                      <span className="text-sm leading-snug text-gray-500">
                        {chip.productCount} ürün · {chip.totalQuantity} adet
                      </span>
                    </span>
                  </button>
                )
              }

              return (
                <div className="-mx-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-2 scrollbar-hide">
                  <div className="flex w-max flex-col gap-2.5">
                    <div className="flex gap-3">{row1.map((c) => renderChip(c))}</div>
                    {row2.length > 0 ? <div className="flex gap-3">{row2.map((c) => renderChip(c))}</div> : null}
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* Product Type Filters */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 shrink-0 text-gray-400" />
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Ürün tipleri</h2>
        </div>

        <div className="inline-flex flex-wrap gap-1.5 rounded-md border border-gray-200 bg-gray-50/80 p-1">
          <button
            type="button"
            onClick={() => {
              setProductType('')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !productType
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="h-4 w-4 shrink-0 opacity-70" />
            Tümü
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('demirbas')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              productType === 'demirbas'
                ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wrench className="h-4 w-4 shrink-0 opacity-70" />
            Demirbaş
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('sarf_malzeme')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              productType === 'sarf_malzeme'
                ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Boxes className="h-4 w-4 shrink-0 opacity-70" />
            Sarf malzeme
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('kontrol_sarf')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              productType === 'kontrol_sarf'
                ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0 opacity-70" />
            Kontrol Sarf
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl">
        <CardHeader className="pb-6 pt-8 px-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  {(userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId ? 'Depo Ürün Kataloğu' : 'Ürün Kataloğu'}
                  {siteId && !((userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId) && (
                    <span className="ml-2 text-primary-600">
                      - {sites.find(s => s.site.id === siteId)?.site.name}
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {(userRole === 'warehouse_manager' || userRole === 'santiye_depo' || userRole === 'purchasing_officer') && userSiteId ? (
                    <>
                      <span className="font-medium">{sites.find(s => s.site.id === siteId)?.site.name || 'Deponuzda'}</span> {totalCount} ürün mevcut
                    </>
                  ) : siteId ? (
                    <>
                      <span className="font-medium">{sites.find(s => s.site.id === siteId)?.site.name}</span> deposunda {totalCount} ürün listeleniyor
                    </>
                  ) : (
                    <>Toplam {totalCount} ürün listeleniyor</>
                  )}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  onClick={() => setShowZimmetReportModal(true)}
                  variant="outline"
                  className="rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Zimmet Raporu
                </Button>
              </div>
            </div>

            {/* Filters */}
            <ProductFilters
              searchTerm={searchTerm}
              brandId={brandId}
              statusFilter={statusFilter}
              onSearchChange={setSearchTerm}
              onBrandChange={setBrandId}
              onStatusFilterChange={setStatusFilter}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {/* Products Table */}
          <ProductsTable
            products={products}
            isLoading={isLoading}
            onProductClick={handleOpenViewModal}
            selectedSiteId={siteId}
            selectedProducts={selectedProducts}
            onSelectionChange={handleSelectionChange}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-2xl px-6 py-5"
              >
                Önceki
              </Button>
              <div className="flex items-center gap-3">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      onClick={() => setCurrentPage(page)}
                      className="rounded-2xl w-12 h-12 p-0"
                    >
                      {page}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-2xl px-6 py-5"
              >
                Sonraki
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        productId={selectedProductId}
        activeTab={activeTab}
        mode={modalMode}
        onClose={closeModal}
        onTabChange={changeTab}
        onSave={handleSaveProduct}
        isSaving={isSaving}
        selectedProductIds={selectedProducts}
      />

      {/* Bottom Action Bar - Toplu İşlemler */}
      {showBulkActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-2xl z-50 border-t border-gray-700">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                  <span className="text-sm font-semibold">
                    {selectedProducts.length} ürün seçildi
                  </span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedProducts([])
                    setShowBulkActions(false)
                  }}
                  className="text-white hover:bg-white/10 rounded-full"
                >
                  Seçimi Temizle
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBulkStockOperations}
                  className="bg-white text-gray-900 hover:bg-gray-100 rounded-full px-8 py-6 font-semibold shadow-lg"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Toplu Zimmet Oluştur
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Zimmet Modal */}
      <BulkZimmetModal
        open={showBulkZimmetModal}
        onOpenChange={setShowBulkZimmetModal}
        onSuccess={handleBulkZimmetSuccess}
        showToast={showToast}
        selectedProductIds={selectedProducts}
      />

      <ZimmetReportModal
        open={showZimmetReportModal}
        onOpenChange={setShowZimmetReportModal}
        showToast={showToast}
        sourceWarehouseId={siteId || undefined}
        warehouseLabel={
          siteId ? sites.find((s) => s.site.id === siteId)?.site.name : undefined
        }
      />
    </div>
  )
}

