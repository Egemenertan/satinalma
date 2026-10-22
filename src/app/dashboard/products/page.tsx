/**
 * Products Page
 * Ürün Yönetimi Sayfası - Minimal, clean layout
 * Depo görünürlüğü warehouse_access ile (talep rolleri ayrı)
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchAllFilteredProductIds } from '@/services/products.service'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Package, Boxes, Wrench, ClipboardCheck, UserPlus, ChevronDown, Truck } from 'lucide-react'
import { useProducts, useProductModal, useProductFilters, useCreateProduct, useUpdateProduct, useProductsInsights } from './hooks'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import useSWR from 'swr'
import {
  WAREHOUSE_ACCESS_SWR_KEY,
  EMPTY_WAREHOUSE_ACCESS_SCOPE,
  fetchMyWarehouseAccessScope,
} from '@/lib/warehouse-access'
import {
  ProductFilters,
  ProductsTable,
  ProductModal,
  ProductsInsights,
} from './components'
import BulkZimmetModal from '@/components/BulkZimmetModal'
import { ZimmetReportModal } from './components/ZimmetReportModal'
import { TerminationModal } from './components/TerminationModal'
import { OperationsDialog } from './components/OperationsDialog'

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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false)
  const [showBulkZimmetModal, setShowBulkZimmetModal] = useState(false)
  const [showBulkTeslimModal, setShowBulkTeslimModal] = useState(false)
  const [showZimmetReportModal, setShowZimmetReportModal] = useState(false)
  const [showTerminationModal, setShowTerminationModal] = useState(false)
  const [showOperationsMenu, setShowOperationsMenu] = useState(false)
  const supabase = createClient()

  const {
    searchTerm,
    zimmetOwner,
    brandId,
    siteId,
    productType,
    statusFilter,
    currentPage,
    pageSize,
    filters: baseFilters,
    hasActiveFilters,
    setSearchTerm,
    setZimmetOwner,
    setBrandId,
    setSiteId,
    setProductType,
    setStatusFilter,
    setCurrentPage,
    clearFilters,
  } = useProductFilters()

  const { data: warehouseAccessData } = useSWR(
    WAREHOUSE_ACCESS_SWR_KEY,
    fetchMyWarehouseAccessScope,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
      fallbackData: EMPTY_WAREHOUSE_ACCESS_SCOPE,
    }
  )
  const warehouseAccess = warehouseAccessData ?? EMPTY_WAREHOUSE_ACCESS_SCOPE

  const managesViewedWarehouse = useMemo(() => {
    if (!warehouseAccess.loaded || warehouseAccess.canManageAll) return false
    const managed = new Set(warehouseAccess.manageWarehouseIds)
    if (managed.size === 0) return false
    if (siteId) return managed.has(siteId)
    return (
      warehouseAccess.warehouseIds.length > 0 &&
      warehouseAccess.warehouseIds.every((id) => managed.has(id))
    )
  }, [warehouseAccess, siteId])

  const filters = useMemo(() => {
    if (!warehouseAccess.loaded) return baseFilters
    if (warehouseAccess.canManageAll) return baseFilters
    return {
      ...baseFilters,
      allowedWarehouseIds: warehouseAccess.warehouseIds,
      // Görüntüleme yetkisinde liste, zimmeti olan ürünleri de kapsar.
      // Depoyu yöneten kullanıcı tabloda fiziksel stok adedini görür.
      useDepotZimmetQty: true,
      includeUnstockedCatalog: warehouseAccess.operateWarehouseIds.length > 0,
    }
  }, [baseFilters, warehouseAccess])

  useEffect(() => {
    if (!warehouseAccess.loaded || !warehouseAccess.isRestricted) return
    const allowed = warehouseAccess.warehouseIds
    if (allowed.length === 0) return
    if (siteId && allowed.includes(siteId)) return
    setSiteId(allowed[0])
  }, [warehouseAccess.loaded, warehouseAccess.isRestricted, warehouseAccess.warehouseIds, siteId, setSiteId])

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

        const warehouseIds = visibleSites.map((site) => site.id)
        const { data: stockData } = warehouseIds.length
          ? await supabase
              .from('warehouse_stock')
              .select('warehouse_id, quantity')
              .in('warehouse_id', warehouseIds)
          : { data: [] as { warehouse_id: string; quantity: number | null }[] }

        const stockByWarehouse = new Map<string, { productCount: number; totalQuantity: number }>()
        for (const row of stockData || []) {
          const current = stockByWarehouse.get(row.warehouse_id) || {
            productCount: 0,
            totalQuantity: 0,
          }
          current.productCount += 1
          current.totalQuantity += Number(row.quantity || 0)
          stockByWarehouse.set(row.warehouse_id, current)
        }

        const sitesWithStock = visibleSites.map((site) => {
          const stock = stockByWarehouse.get(site.id)
          return {
            site,
            productCount: stock?.productCount || 0,
            totalQuantity: stock?.totalQuantity || 0,
          }
        })

        setSites(sitesWithStock)
      } catch (error) {
        console.error('Sites yüklenirken hata:', error)
      } finally {
        setLoadingSites(false)
      }
    }

    loadSites()
  }, [warehouseAccess, supabase])

  const { data: productsData, isLoading, isFetching } = useProducts(
    filters,
    currentPage,
    pageSize,
    warehouseAccess.loaded
  )

  const insightsSiteKey = siteId?.trim()
    ? siteId
    : warehouseAccess.isRestricted && warehouseAccess.warehouseIds[0]
      ? warehouseAccess.warehouseIds[0]
      : undefined
  const {
    data: productsInsights,
    isLoading: insightsLoading,
    error: insightsError,
  } = useProductsInsights(
    insightsSiteKey,
    warehouseAccess.loaded && (!warehouseAccess.isRestricted || Boolean(insightsSiteKey))
  )

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
  }

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  const products = productsData?.products || []
  const totalCount = productsData?.totalCount || 0
  const totalPages = productsData?.totalPages || 1

  const isRestrictedView = warehouseAccess.isRestricted && warehouseAccess.warehouseIds.length > 0
  const canManageProducts = warehouseAccess.canManageProducts
  const canCreateProduct =
    canManageProducts || warehouseAccess.manageWarehouseIds.length > 0
  // Tam stok işlemi yalnızca tüm depoları yöneten kullanıcıda.
  // Belirli depoyu yöneten kullanıcı yalnızca o depoya stok girişi yapar.
  const canOperateStock = warehouseAccess.canManageAll
  const operatesViewedWarehouse = useMemo(() => {
    if (!warehouseAccess.loaded || warehouseAccess.canManageAll) return false
    const operated = new Set(warehouseAccess.operateWarehouseIds)
    if (operated.size === 0) return false
    if (siteId) return operated.has(siteId)
    return (
      warehouseAccess.warehouseIds.length > 0 &&
      warehouseAccess.warehouseIds.every((id) => operated.has(id))
    )
  }, [warehouseAccess, siteId])
  const canReceiveInbound =
    !warehouseAccess.canManageAll && managesViewedWarehouse && !operatesViewedWarehouse
  const showDepotSwitcher = warehouseAccess.canManageAll || warehouseAccess.warehouseIds.length > 1

  const handleOpenCreateModal = () => {
    setModalMode('create')
    openModal(null)
  }

  const handleOpenViewModal = (productId: string) => {
    setModalMode('view')
    window.setTimeout(() => openModal(productId), 0)
  }

  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedProducts(selectedIds)
    setShowBulkActions(selectedIds.length > 0)
  }

  const narrowedByFilter = Boolean(
    searchTerm.trim() ||
      zimmetOwner ||
      (brandId && brandId !== 'all') ||
      productType ||
      statusFilter !== 'active' ||
      (!isRestrictedView && siteId)
  )
  const allFilteredSelected =
    totalCount > 0 &&
    selectedProducts.length === totalCount &&
    products.every((product) => selectedProducts.includes(product.id))

  const handleSelectAllFiltered = async () => {
    if (allFilteredSelected) {
      setSelectedProducts([])
      setShowBulkActions(false)
      return
    }
    setSelectingAllFiltered(true)
    try {
      const ids = await fetchAllFilteredProductIds(filters)
      setSelectedProducts(ids)
      setShowBulkActions(ids.length > 0)
    } catch (error) {
      console.error('Filtredeki ürünler seçilemedi:', error)
      showToast('Filtredeki ürünler seçilemedi', 'error')
    } finally {
      setSelectingAllFiltered(false)
    }
  }

  const handleBulkStockOperations = () => {
    if (selectedProducts.length === 0) return
    setShowBulkZimmetModal(true)
  }

  const handleBulkZimmetSuccess = () => {
    setShowBulkZimmetModal(false)
    setShowBulkTeslimModal(false)
    setSelectedProducts([])
    setShowBulkActions(false)
    queryClient.invalidateQueries({ queryKey: ['products'] })
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
        const created = await createMutation.mutateAsync(productData)

        if (serial_numbers && serial_numbers.trim()) {
          const serialCount = serial_numbers.split(',').filter((s: string) => s.trim()).length
          showToast(`Ürün ve ${serialCount} seri numarası başarıyla oluşturuldu!`, 'success')
        } else {
          showToast('Ürün başarıyla oluşturuldu!', 'success')
        }

        if (canReceiveInbound && created?.id) {
          setModalMode('view')
          openModal(created.id, 'movements')
          return
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
          <h1 className="text-4xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">
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
          {warehouseAccess.loaded && canCreateProduct && (
            <Button
              onClick={handleOpenCreateModal}
              className="h-10 rounded-sm px-4 text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-900"
            >
              <Plus className="h-4 w-4" />
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
            <h2 className="text-sm font-medium text-gray-500">Depolar</h2>
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
          <h2 className="text-sm font-medium text-gray-500">Ürün Tipi</h2>
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
                  type="button"
                  onClick={() => setShowOperationsMenu(true)}
                  className="h-10 rounded-sm bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-900"
                >
                  İşlemler
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ProductFilters
              searchTerm={searchTerm}
              zimmetOwner={zimmetOwner}
              brandId={brandId}
              statusFilter={statusFilter}
              onSearchChange={setSearchTerm}
              onZimmetOwnerChange={setZimmetOwner}
              onBrandChange={setBrandId}
              onStatusFilterChange={setStatusFilter}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
              searching={isFetching && Boolean(searchTerm.trim())}
              warehouseIds={filters.siteId ? [filters.siteId] : filters.allowedWarehouseIds}
            />
            {canOperateStock && narrowedByFilter && totalCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                <p className="text-sm text-gray-600">
                  Filtrede <span className="font-medium text-gray-900">{totalCount}</span> ürün var
                  {allFilteredSelected ? '. Hepsi seçili.' : '.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectAllFiltered}
                  disabled={selectingAllFiltered}
                  className="h-9 rounded-xl border-gray-200 bg-white"
                >
                  {selectingAllFiltered ? 'Seçiliyor...' : allFilteredSelected ? 'Seçimi kaldır' : 'Tümünü seç'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <ProductsTable
            products={products}
            isLoading={!warehouseAccess.loaded || isLoading}
            onProductClick={handleOpenViewModal}
            selectedSiteId={siteId}
            selectedProducts={selectedProducts}
            onSelectionChange={canOperateStock ? handleSelectionChange : undefined}
            ownWarehouseView={isRestrictedView}
            ownWarehouseQuantity={managesViewedWarehouse ? 'stock' : 'zimmet'}
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
        defaultWarehouseId={siteId || undefined}
        canOperateStock={canOperateStock}
        inboundOnly={canReceiveInbound}
        depotOperate={operatesViewedWarehouse}
        inboundWarehouseIds={
          operatesViewedWarehouse
            ? warehouseAccess.operateWarehouseIds
            : canReceiveInbound
              ? warehouseAccess.manageWarehouseIds
              : undefined
        }
        scopeWarehouseIds={isRestrictedView ? warehouseAccess.warehouseIds : undefined}
      />

      {canOperateStock && showBulkActions && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 lg:left-[calc(50%+2.75rem)]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
            <div className="flex min-w-0 items-center gap-2 pl-2">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-950 px-2 text-xs font-semibold text-white">
                {selectedProducts.length}
              </span>
              <span className="truncate text-sm font-medium text-gray-900">
                ürün seçili
                {allFilteredSelected && totalCount > products.length
                  ? ' · filtredeki hepsi'
                  : selectedProducts.some((id) => !products.some((product) => product.id === id))
                    ? ' · diğerleri de duruyor'
                    : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedProducts([])
                  setShowBulkActions(false)
                }}
                className="h-10 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-950"
              >
                Temizle
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedProducts.length === 0) return
                  setShowBulkTeslimModal(true)
                }}
                className="h-10 rounded-xl border-gray-200 bg-white"
              >
                <Truck className="mr-2 h-4 w-4" />
                Toplu teslim
              </Button>
              <Button
                onClick={handleBulkStockOperations}
                className="h-10 rounded-xl bg-neutral-950 px-4 text-white hover:bg-neutral-800"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Toplu zimmet
              </Button>
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
      <BulkZimmetModal
        mode="teslim"
        open={showBulkTeslimModal}
        onOpenChange={setShowBulkTeslimModal}
        onSuccess={handleBulkZimmetSuccess}
        showToast={showToast}
        selectedProductIds={selectedProducts}
      />

      <OperationsDialog
        open={showOperationsMenu}
        onOpenChange={setShowOperationsMenu}
        showToast={showToast}
        onTerminate={() => {
          setShowOperationsMenu(false)
          window.setTimeout(() => setShowTerminationModal(true), 180)
        }}
        onReport={() => {
          setShowOperationsMenu(false)
          window.setTimeout(() => setShowZimmetReportModal(true), 180)
        }}
      />

      <ZimmetReportModal
        open={showZimmetReportModal}
        onOpenChange={setShowZimmetReportModal}
        showToast={showToast}
        sourceWarehouseId={siteId || undefined}
        warehouseLabel={siteId ? sites.find((s) => s.site.id === siteId)?.site.name : undefined}
      />

      <TerminationModal
        open={showTerminationModal}
        onOpenChange={setShowTerminationModal}
        showToast={showToast}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
        }}
      />
    </div>
  )
}
