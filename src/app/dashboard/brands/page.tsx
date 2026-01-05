/**
 * Brands Page
 * Marka Yönetimi Sayfası
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { Plus, Tag } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useBrandsWithProductCount, useBrandFilters, useCreateBrand, useUpdateBrand, useDeleteBrand } from './hooks'
import { BrandCard, BrandFilters, BrandModal } from './components'
import type { BrandWithProductCount } from '@/services/brands.service'

export default function BrandsPage() {
  const { showToast } = useToast()
  
  // Hooks
  const {
    searchTerm,
    isActive,
    filters,
    hasActiveFilters,
    setSearchTerm,
    setIsActive,
    clearFilters,
  } = useBrandFilters()

  const { data: brands, isLoading } = useBrandsWithProductCount(filters)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<BrandWithProductCount | null>(null)

  // Mutations
  const createMutation = useCreateBrand()
  const updateMutation = useUpdateBrand()
  const deleteMutation = useDeleteBrand()

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Handlers
  const handleOpenModal = (brand?: BrandWithProductCount) => {
    setSelectedBrand(brand || null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedBrand(null)
  }

  const handleSave = async (data: any) => {
    try {
      if (selectedBrand) {
        // Update
        await updateMutation.mutateAsync({
          id: selectedBrand.id,
          updates: data,
        })
        showToast('Marka başarıyla güncellendi', 'success')
      } else {
        // Create
        await createMutation.mutateAsync(data)
        showToast('Marka başarıyla oluşturuldu', 'success')
      }
      handleCloseModal()
    } catch (error) {
      console.error('Save error:', error)
      showToast('İşlem sırasında hata oluştu', 'error')
    }
  }

  const handleDelete = async (brandId: string) => {
    if (!confirm('Bu markayı silmek istediğinizden emin misiniz?')) return

    try {
      await deleteMutation.mutateAsync({ id: brandId, hardDelete: false })
      showToast('Marka başarıyla silindi', 'success')
    } catch (error) {
      console.error('Delete error:', error)
      showToast('Silme işlemi sırasında hata oluştu', 'error')
    }
  }

  const totalBrands = brands?.length || 0

  return (
    <div className="space-y-8 px-0 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Marka Yönetimi</h1>
          <p className="text-gray-600 mt-2 text-lg font-light">
            Tüm markaları görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {totalBrands} Marka
          </Badge>
          <Button
            onClick={() => handleOpenModal()}
            className="px-6 py-5 rounded-2xl font-light text-md bg-black text-white hover:bg-gray-900 hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Yeni Marka Ekle
          </Button>
        </div>
      </div>

      {/* Brands Card */}
      <Card className="bg-white border-0 shadow-sm rounded-3xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Marka Kataloğu
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Toplam {totalBrands} marka listeleniyor
                </p>
              </div>
            </div>

            {/* Filters */}
            <BrandFilters
              searchTerm={searchTerm}
              isActive={isActive}
              onSearchChange={setSearchTerm}
              onIsActiveChange={setIsActive}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </CardHeader>

        <CardContent>
          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading size="lg" text="Markalar yükleniyor..." />
            </div>
          ) : !brands || brands.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                <Tag className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Marka Bulunamadı
              </h3>
              <p className="text-gray-600 text-center max-w-md mb-6">
                Henüz hiç marka eklenmemiş veya arama kriterlerine uygun marka bulunmuyor.
              </p>
              <Button
                onClick={() => handleOpenModal()}
                className="rounded-2xl bg-black text-white hover:bg-gray-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                İlk Markayı Ekle
              </Button>
            </div>
          ) : (
            /* Brands Grid */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {brands.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Modal */}
      <BrandModal
        isOpen={isModalOpen}
        brand={selectedBrand}
        onClose={handleCloseModal}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  )
}




