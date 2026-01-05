/**
 * ProductFilters Component
 * Arama, marka, fiyat filtreleme
 */

'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, Filter } from 'lucide-react'
import { useBrandsWithProductCount } from '@/app/dashboard/brands/hooks'

interface ProductFiltersProps {
  searchTerm: string
  brandId: string
  isActive: boolean | undefined
  onSearchChange: (value: string) => void
  onBrandChange: (value: string) => void
  onIsActiveChange: (value: boolean | undefined) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function ProductFilters({
  searchTerm,
  brandId,
  isActive,
  onSearchChange,
  onBrandChange,
  onIsActiveChange,
  onClearFilters,
  hasActiveFilters,
}: ProductFiltersProps) {
  const { data: brands } = useBrandsWithProductCount()

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Ürün adı veya SKU ile ara..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-2xl border-gray-200 bg-white"
        />
      </div>

      {/* Brand Filter */}
      <Select value={brandId} onValueChange={onBrandChange}>
        <SelectTrigger className="w-full sm:w-48 rounded-2xl border-gray-200 bg-white">
          <SelectValue placeholder="Marka Seç" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Tüm Markalar</SelectItem>
          {brands?.map((brand) => (
            <SelectItem key={brand.id} value={brand.id}>
              {brand.name} ({brand.product_count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select 
        value={isActive === undefined ? 'all' : isActive ? 'active' : 'inactive'} 
        onValueChange={(value) => {
          if (value === 'all') onIsActiveChange(undefined)
          else if (value === 'active') onIsActiveChange(true)
          else onIsActiveChange(false)
        }}
      >
        <SelectTrigger className="w-full sm:w-40 rounded-2xl border-gray-200 bg-white">
          <SelectValue placeholder="Durum" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Tümü</SelectItem>
          <SelectItem value="active">Aktif</SelectItem>
          <SelectItem value="inactive">Pasif</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="rounded-2xl border-gray-200 bg-white hover:bg-gray-50"
        >
          <X className="w-4 h-4 mr-2" />
          Temizle
        </Button>
      )}
    </div>
  )
}




