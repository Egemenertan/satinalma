/**
 * BrandModal Component
 * Create/Edit marka formu
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Upload, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { uploadBrandLogo, deleteBrandLogo } from '@/services/brands.service'
import type { BrandWithProductCount } from '@/services/brands.service'

interface BrandModalProps {
  isOpen: boolean
  brand: BrandWithProductCount | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
  isSaving: boolean
}

export function BrandModal({ isOpen, brand, onClose, onSave, isSaving }: BrandModalProps) {
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    logo_url: '',
    is_active: true,
  })
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name,
        description: brand.description || '',
        website: brand.website || '',
        logo_url: brand.logo_url || '',
        is_active: brand.is_active,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        website: '',
        logo_url: '',
        is_active: true,
      })
    }
  }, [brand])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingLogo(true)
    try {
      // Önce eski logoyu sil
      if (formData.logo_url && brand?.id) {
        await deleteBrandLogo(formData.logo_url)
      }

      // Yeni logoyu yükle (geçici ID kullan)
      const tempId = brand?.id || `temp-${Date.now()}`
      const url = await uploadBrandLogo(file, tempId)
      
      setFormData(prev => ({ ...prev, logo_url: url }))
      showToast('Logo başarıyla yüklendi', 'success')
    } catch (error) {
      console.error('Logo upload error:', error)
      showToast('Logo yüklenirken hata oluştu', 'error')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (formData.logo_url) {
      try {
        await deleteBrandLogo(formData.logo_url)
        setFormData(prev => ({ ...prev, logo_url: '' }))
        showToast('Logo kaldırıldı', 'success')
      } catch (error) {
        console.error('Logo delete error:', error)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      showToast('Marka adı gereklidir', 'error')
      return
    }

    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white rounded-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {brand ? 'Marka Düzenle' : 'Yeni Marka Ekle'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Logo Upload */}
            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                {formData.logo_url ? (
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-50">
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                    disabled={isUploadingLogo}
                  />
                  <label htmlFor="logo-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={isUploadingLogo}
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      {isUploadingLogo ? 'Yükleniyor...' : 'Logo Seç'}
                    </Button>
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    PNG, JPG veya WEBP (Maks. 2MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Marka Adı */}
            <div>
              <Label htmlFor="name">Marka Adı *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-2 rounded-2xl"
                placeholder="Örn: Apple, Samsung"
                required
              />
            </div>

            {/* Açıklama */}
            <div>
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-2 rounded-2xl"
                placeholder="Marka hakkında kısa bilgi..."
                rows={3}
              />
            </div>

            {/* Website */}
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="mt-2 rounded-2xl"
                placeholder="https://example.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-2xl"
              disabled={isSaving}
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="rounded-2xl bg-black text-white hover:bg-gray-900"
              disabled={isSaving}
            >
              {isSaving ? 'Kaydediliyor...' : brand ? 'Güncelle' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

