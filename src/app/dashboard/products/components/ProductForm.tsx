/**
 * ProductForm Component
 * Ürün ekleme ve düzenleme formu
 */

'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useBrands } from '@/app/dashboard/brands/hooks'
import { useCategories } from '../hooks'
import type { ProductWithDetails } from '@/services/products.service'

interface ProductFormProps {
  product?: ProductWithDetails | null
  onSubmit: (data: any) => void
  onCancel: () => void
  isSaving: boolean
}

export function ProductForm({ product, onSubmit, onCancel, isSaving }: ProductFormProps) {
  const { data: brandsData } = useBrands()
  const brands = brandsData?.brands || []
  const { data: categories } = useCategories()

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    brand_id: product?.brand_id || '',
    category_id: product?.category_id || '',
    product_type: product?.product_type || '',
    sku: product?.sku || '',
    unit: product?.unit || 'adet',
    unit_price: product?.unit_price || '',
    currency: product?.currency || 'TRY',
    is_active: product?.is_active ?? true,
  })

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        brand_id: product.brand_id || '',
        category_id: product.category_id || '',
        product_type: product.product_type || '',
        sku: product.sku || '',
        unit: product.unit || 'adet',
        unit_price: product.unit_price || '',
        currency: product.currency || 'TRY',
        is_active: product.is_active ?? true,
      })
    }
  }, [product])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-5">
        {/* Ürün Adı */}
        <div className="col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="name" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Ürün Adı *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Örn: Akıllı Telefon XYZ"
            required
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
          />
        </div>

        {/* Marka */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="brand_id" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Marka
          </Label>
          <Select
            value={formData.brand_id || 'none'}
            onValueChange={(value) => handleChange('brand_id', value === 'none' ? '' : value)}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue placeholder="Marka seçin" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">Belirtilmemiş</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SKU */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="sku" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            SKU (Stok Kodu)
          </Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => handleChange('sku', e.target.value)}
            placeholder="Örn: XYZ-123"
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
          />
        </div>

        {/* Kategori */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="category_id" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Kategori
          </Label>
          <Select
            value={formData.category_id || 'none'}
            onValueChange={(value) => handleChange('category_id', value === 'none' ? '' : value)}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue placeholder="Kategori seçin" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">Belirtilmemiş</SelectItem>
              {(categories || []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ürün Tipi */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="product_type" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Ürün Tipi
          </Label>
          <Input
            id="product_type"
            value={formData.product_type}
            onChange={(e) => handleChange('product_type', e.target.value)}
            placeholder="Örn: Elektronik, Aksesuar"
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
          />
        </div>

        {/* Birim */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="unit" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Birim *
          </Label>
          <Select
            value={formData.unit}
            onValueChange={(value) => handleChange('unit', value)}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue placeholder="Birim seçin" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="adet">Adet</SelectItem>
              <SelectItem value="kg">Kilogram</SelectItem>
              <SelectItem value="lt">Litre</SelectItem>
              <SelectItem value="m">Metre</SelectItem>
              <SelectItem value="m2">Metrekare</SelectItem>
              <SelectItem value="m3">Metreküp</SelectItem>
              <SelectItem value="paket">Paket</SelectItem>
              <SelectItem value="kutu">Kutu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Birim Fiyat */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="unit_price" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Birim Fiyat
          </Label>
          <Input
            id="unit_price"
            type="number"
            step="0.01"
            value={formData.unit_price}
            onChange={(e) => handleChange('unit_price', e.target.value)}
            placeholder="0.00"
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
          />
        </div>

        {/* Para Birimi */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="currency" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Para Birimi
          </Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => handleChange('currency', value)}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="TRY">TRY (₺)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Açıklama */}
        <div className="col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="description" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Açıklama
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Ürün hakkında detaylı açıklama..."
            rows={4}
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl resize-none"
          />
        </div>

        {/* Aktif/Pasif */}
        <div className="col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm flex items-center justify-between">
          <Label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Ürün Aktif
          </Label>
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => handleChange('is_active', checked)}
          />
        </div>
      </div>

      {/* Actions - Apple Style */}
      <div className="flex items-center justify-end gap-3 pt-8">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-full px-8 py-6 border-gray-300 hover:bg-gray-50 font-medium"
        >
          İptal
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="rounded-full px-8 py-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all font-medium"
        >
          {isSaving ? 'Kaydediliyor...' : product ? 'Güncelle' : 'Ürün Ekle'}
        </Button>
      </div>
    </form>
  )
}

