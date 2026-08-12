/**
 * Products Page
 * Ürün Yönetimi Sayfası - Minimal, clean layout
 * Depo görünürlüğü warehouse_access ile (talep rolleri ayrı)
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Package, Boxes, Wrench, ClipboardCheck, UserPlus, FileSpreadsheet } from 'lucide-react'
import { useProducts, useProductModal, useProductFilters, useCreateProduct, useUpdateProduct, useProductsInsights } from './hooks'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import {
  fetchMyWarehouseAccessScope,
  emptyWarehouseAccessScope,
  type WarehouseAccessScope,
} from '@/lib/warehouse-access'
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
  const [warehouseAccess, setWarehouseAccess] = useState<WarehouseAccessScope>(emptyWarehouseAccessScope())
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showBulkZimmetModal, setShowBulkZimmetModal] = useState(false)
  const [showZimmetReportModal, setShowZimmetReportModal] = useState(false)
  const supabase = createClient()

  const {
    searchTerm,
    brandId,
    siteId,
    productType,
    statusFilter,
    currentPage,
    pageSize,
    filters: baseFilters,
    hasActiveFilters,
    setSearchTerm,
    setBrandId,
    setSiteId,
    setProductType,
    setStatusFilter,
    setCurrentPage,
    clearFilters,
  } = useProductFilters()

  const filters = useMemo(() => {
    if (!warehouseAccess.loaded) return baseFilters
    if (warehouseAccess.canManageAll) return baseFilters
    return {
      ...baseFilters,
      allowedWarehouseIds: warehouseAccess.warehouseIds,
    }
  }, [baseFilters, warehouseAccess])

  useEffect(() => {
    const loadAccess = async () => {
      const scope = await fetchMyWarehouseAccessScope()
      setWarehouseAccess(scope)

      if (scope.isRestricted && scope.warehouseIds.length > 0) {
        setSiteId(scope.warehouseIds[0])
      }
    }

    loadAccess()
  }, [setSiteId])

  useEffect(() => {
    if (!warehouseAccess.loaded) return

    const loadSites = async () => {
      try {
        setLoadingSites(true)
        const { data: sitesData, error } = await supabase
          .from('sites')
          .select('id, name, image_url')
          .order('name')

        if (error) throw error

        let visibleSites = sitesData || []
        if (warehouseAccess.isRestricted) {
          const allowed = new Set(warehouseAccess.warehouseIds)
          visibleSites = visibleSites.filter((s) => allowed.has(s.id))
        }

        const sitesWithStock = await Promise.all(
          visibleSites.map(async (site) => {
            const { data: stockData } = await supabase
              .from('warehouse_stock')
              .select('quantity')
              .eq('warehouse_id', site.id)

            const productCount = stockData?.length || 0
            const totalQuantity =
              stockData?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0

            return {
              site,
              productCount,
              totalQuantity,
            }
          })
        )

        setSites(sitesWithStock)
      } catch (error) {
        console.error('Sites yüklenirken hata:', error)
      } finally {
        setLoadingSites(false)
      }
    }

    loadSites()
  }, [warehouseAccess, supabase])

  const { data: productsData, isLoading } = useProducts(filters, currentPage, pageSize)

  const insightsSiteKey = siteId?.trim()
    ? siteId
    : warehouseAccess.isRestricted && warehouseAccess.warehouseIds[0]
      ? warehouseAccess.warehouseIds[0]
      : undefined
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

  const isRestrictedView = warehouseAccess.isRestricted && warehouseAccess.warehouseIds.length > 0
  const canManageProducts = warehouseAccess.canManageProducts
  const showDepotSwitcher = warehouseAccess.canManageAll || warehouseAccess.warehouseIds.length > 1

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
    if (isRestrictedView) {
      setSiteId(warehouseAccess.warehouseIds[0])
    }
    setProductType('')
  }

  const handleSaveProduct = async (data: any) => {
    try {
      const { serial_numbers, ...productData } = data

      if (serial_numbers && serial_numbers.trim()) {
        productData.has_serial = true

        const serialNumbersList = serial_numbers
          .split(',')
          .map((sn: string) => sn.trim())
          .filter((sn: string) => sn.length > 0)

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">
            Stok Yönetimi
          </h1>
          <p className="text-gray-600 text-base mt-4">
            {isRestrictedView
              ? 'Atandığınız depolardaki ürünleri görüntüleyin'
              : 'Tüm ürünleri görüntüleyin ve yönetin'}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 px-4 py-2">
            {totalCount} Ürün
          </Badge>
          {warehouseAccess.loaded && canManageProducts && (
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
          insightsSiteKey ? sites.find((s) => s.site.id === insightsSiteKey)?.site.name : undefined
        }
      />

      {warehouseAccess.loaded && showDepotSwitcher && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-gray-400" />
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Depolar</h2>
          </div>

          {loadingSites ? (
            <div className="-mx-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-2 scrollbar-hide">
              <div className="flex w-max flex-col gap-2.5">
                <div className="flex gap-3">
                  {warehouseAccess.canManageAll && (
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
                  )}
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
                ...(warehouseAccess.canManageAll ? [{ kind: 'all' as const }] : []),
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
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      {chip.site.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={chip.site.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className={`h-5 w-5 ${selected ? 'text-primary-700' : 'text-gray-500'}`} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium leading-snug">{chip.site.name}</span>
                      <span className="text-sm leading-snug text-gray-500">
                        {chip.productCount} ürün · {Math.round(chip.totalQuantity)} adet
                      </span>
                    </span>
                  </button>
                )
              }

              return (
                <div className="-mx-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-2 scrollbar-hide">
                  <div className="flex w-max flex-col gap-2.5">
                    <div className="flex gap-3">{row1.map(renderChip)}</div>
                    {row2.length > 0 && <div className="flex gap-3">{row2.map(renderChip)}</div>}
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 shrink-0 text-gray-400" />
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Ürün Tipi</h2>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50/80 p-1">
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
                ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="h-4 w-4 shrink-0 opacity-70" />
            Demirbaş
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('sarf')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              productType === 'sarf'
                ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Boxes className="h-4 w-4 shrink-0 opacity-70" />
            Sarf
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('yedek_parca')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              productType === 'yedek_parca'
                ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wrench className="h-4 w-4 shrink-0 opacity-70" />
            Yedek Parça
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

      <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl">
        <CardHeader className="pb-6 pt-8 px-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  {isRestrictedView ? 'Depo Ürün Kataloğu' : 'Ürün Kataloğu'}
                  {siteId && !isRestrictedView && (
                    <span className="ml-2 text-primary-600">
                      - {sites.find((s) => s.site.id === siteId)?.site.name}
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {isRestrictedView ? (
                    <>
                      <span className="font-medium">
                        {sites.find((s) => s.site.id === siteId)?.site.name || 'Deponuzda'}
                      </span>{' '}
                      {totalCount} ürün mevcut
                    </>
                  ) : siteId ? (
                    <>
                      <span className="font-medium">
                        {sites.find((s) => s.site.id === siteId)?.site.name}
                      </span>{' '}
                      deposunda {totalCount} ürün listeleniyor
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
          <ProductsTable
            products={products}
            isLoading={isLoading}
            onProductClick={handleOpenViewModal}
            selectedSiteId={siteId}
            selectedProducts={selectedProducts}
            onSelectionChange={handleSelectionChange}
          />

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

      {showBulkActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-2xl z-50 border-t border-gray-700">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                  <span className="text-sm font-semibold">{selectedProducts.length} ürün seçildi</span>
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
        warehouseLabel={siteId ? sites.find((s) => s.site.id === siteId)?.site.name : undefined}
      />
    </div>
  )
}
