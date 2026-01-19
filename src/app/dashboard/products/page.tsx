/**
 * Products Page
 * Ürün Yönetimi Sayfası - Minimal, clean layout
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { useProducts, useProductModal, useProductFilters, useCreateProduct, useUpdateProduct } from './hooks'
import { useToast } from '@/components/ui/toast'
import {
  ProductStatsCards,
  ProductFilters,
  ProductsTable,
  ProductModal,
} from './components'

export default function ProductsPage() {
  const { showToast } = useToast()
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view')
  
  // Hooks
  const {
    searchTerm,
    brandId,
    isActive,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    setSearchTerm,
    setBrandId,
    setIsActive,
    setCurrentPage,
    clearFilters,
  } = useProductFilters()

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
    <div className="space-y-8 px-0 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Ürün Yönetimi</h1>
          <p className="text-gray-600 mt-2 text-lg font-light">
            Tüm ürünleri görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {totalCount} Ürün
          </Badge>
          <Button
            onClick={handleOpenCreateModal}
            className="px-8 py-6 rounded-full font-medium text-md bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Yeni Ürün Ekle
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <ProductStatsCards />

      {/* Products Table Card */}
      <Card className="bg-white border-0 shadow-sm rounded-3xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Ürün Kataloğu
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Toplam {totalCount} ürün listeleniyor
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

        <CardContent>
          {/* Products Table */}
          <ProductsTable
            products={products}
            isLoading={isLoading}
            onProductClick={handleOpenViewModal}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-2xl"
              >
                Önceki
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      onClick={() => setCurrentPage(page)}
                      className="rounded-2xl w-10 h-10 p-0"
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
                className="rounded-2xl"
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

