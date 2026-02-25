/**
 * Products Page
 * Ürün Yönetimi Sayfası - Minimal, clean layout
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Package } from 'lucide-react'
import { useProducts, useProductModal, useProductFilters, useCreateProduct, useUpdateProduct } from './hooks'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import {
  ProductStatsCards,
  ProductFilters,
  ProductsTable,
  ProductModal,
} from './components'

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
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view')
  const [sites, setSites] = useState<SiteStock[]>([])
  const [loadingSites, setLoadingSites] = useState(true)
  const supabase = createClient()
  
  // Hooks
  const {
    searchTerm,
    brandId,
    siteId,
    isActive,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    setSearchTerm,
    setBrandId,
    setSiteId,
    setIsActive,
    setCurrentPage,
    clearFilters,
  } = useProductFilters()
  
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
        
        // Sadece stoğu olan siteleri göster
        setSites(sitesWithStock.filter(s => s.productCount > 0))
      } catch (error) {
        console.error('Sites yüklenirken hata:', error)
      } finally {
        setLoadingSites(false)
      }
    }
    
    loadSites()
  }, [])

  const { data: productsData, isLoading } = useProducts(filters, currentPage, pageSize)
  
  const {
    isOpen: isModalOpen,
    selectedProductId,
    activeTab,
    openModal,
    closeModal,
    changeTab,
  } = useProductModal()

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

  const handleSaveProduct = async (data: any) => {
    try {
      if (modalMode === 'create') {
        await createMutation.mutateAsync(data)
        showToast('Ürün başarıyla oluşturuldu!', 'success')
      } else {
        await updateMutation.mutateAsync({ id: selectedProductId!, updates: data })
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
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Ürün Yönetimi</h1>
          <p className="text-gray-600 text-lg font-light">
            Tüm ürünleri görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 px-4 py-2">
            {totalCount} Ürün
          </Badge>
          <Button
            onClick={handleOpenCreateModal}
            className="px-8 py-6 rounded-full font-medium text-md bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-3" />
            Yeni Ürün Ekle
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <ProductStatsCards />

      {/* Site Filters - Elegant Image-based */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-600">Depolar</h2>
        </div>
        
        <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide px-1">
          {/* Tümü Butonu */}
          <button
            onClick={() => {
              setSiteId('')
              setCurrentPage(1)
            }}
            className="group relative flex-shrink-0"
          >
            <div className="w-56 h-56 rounded-3xl overflow-hidden transition-all duration-200">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Package className={`w-14 h-14 mb-3 ${!siteId ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <p className={`text-lg font-semibold ${!siteId ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                  Tümü
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {totalCount} ürün
                </p>
              </div>
            </div>
            {!siteId && (
              <div className="absolute -bottom-3 left-0 right-0 h-1 bg-gray-900 rounded-full" />
            )}
          </button>

          {/* Site Butonları */}
          {loadingSites ? (
            <div className="flex items-center justify-center w-full py-20">
              <div className="text-sm text-gray-400">Yükleniyor...</div>
            </div>
          ) : (
            sites.map(({ site, productCount, totalQuantity }) => (
              <button
                key={site.id}
                onClick={() => {
                  setSiteId(site.id)
                  setCurrentPage(1)
                }}
                className="group relative flex-shrink-0"
              >
                <div className="w-56 h-56 rounded-3xl overflow-hidden transition-all duration-200">
                  {/* Görsel veya Placeholder */}
                  {site.image_url ? (
                    <>
                      <img 
                        src={site.image_url} 
                        alt={site.name}
                        className="absolute inset-0 w-full h-full object-cover rounded-3xl"
                      />
                      <div className={`absolute inset-0 transition-all duration-200 rounded-3xl ${
                        siteId === site.id 
                          ? 'bg-gradient-to-t from-black/80 via-black/30 to-transparent' 
                          : 'bg-gradient-to-t from-black/60 via-black/20 to-transparent group-hover:from-black/70'
                      }`} />
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl" />
                      <Building2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 text-gray-300 opacity-40" />
                    </>
                  )}
                  
                  {/* Site Bilgileri */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className={`text-base font-semibold leading-tight line-clamp-2 mb-2 ${
                      site.image_url ? 'text-white' : 'text-gray-900'
                    }`}>
                      {site.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${site.image_url ? 'text-white/80' : 'text-gray-600'}`}>
                        {productCount} ürün
                      </p>
                      <span className={`text-sm ${site.image_url ? 'text-white/40' : 'text-gray-300'}`}>•</span>
                      <p className={`text-sm ${site.image_url ? 'text-white/60' : 'text-gray-400'}`}>
                        {totalQuantity} adet
                      </p>
                    </div>
                  </div>
                </div>
                {siteId === site.id && (
                  <div className="absolute -bottom-3 left-0 right-0 h-1 bg-blue-600 rounded-full" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Products Table Card */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl">
        <CardHeader className="pb-6 pt-8 px-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  Ürün Kataloğu
                  {siteId && (
                    <span className="ml-2 text-blue-600">
                      - {sites.find(s => s.site.id === siteId)?.site.name}
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {siteId ? (
                    <>
                      <span className="font-medium">{sites.find(s => s.site.id === siteId)?.site.name}</span> deposunda {totalCount} ürün listeleniyor
                    </>
                  ) : (
                    <>Toplam {totalCount} ürün listeleniyor</>
                  )}
                </p>
              </div>
            </div>

            {/* Filters */}
            <ProductFilters
              searchTerm={searchTerm}
              brandId={brandId}
              isActive={isActive}
              onSearchChange={setSearchTerm}
              onBrandChange={setBrandId}
              onIsActiveChange={setIsActive}
              onClearFilters={clearFilters}
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
      />
    </div>
  )
}

