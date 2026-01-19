/**
 * ProductImagesTab Component
 * Ürün resimleri yönetimi - yükleme, silme, önizleme
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, ImageIcon, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ProductImagesTabProps {
  product: any
}

export function ProductImagesTab({ product }: ProductImagesTabProps) {
  const [newImages, setNewImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      alert('Lütfen sadece resim dosyaları seçin')
      return
    }

    const previews = imageFiles.map(file => URL.createObjectURL(file))
    
    setNewImages(prev => [...prev, ...imageFiles])
    setImagePreviewUrls(prev => [...prev, ...previews])
  }

  const removeNewImage = (index: number) => {
    if (imagePreviewUrls[index]) {
      URL.revokeObjectURL(imagePreviewUrls[index])
    }
    
    setNewImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const uploadNewImages = async () => {
    if (!product || newImages.length === 0) return

    setIsUploadingImages(true)
    
    try {
      const supabase = createClient()
      const uploadedUrls: string[] = []

      for (const file of newImages) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${product.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `products/${fileName}`

        const { error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
      }

      const currentImages = product.images || []
      const { error: updateError } = await supabase
        .from('products')
        .update({ images: [...currentImages, ...uploadedUrls] })
        .eq('id', product.id)

      if (updateError) throw updateError

      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
      setNewImages([])
      setImagePreviewUrls([])
      
      alert('✅ Resimler başarıyla yüklendi!')
      window.location.reload()
      
    } catch (error: any) {
      console.error('Image upload error:', error)
      alert(`❌ Hata: ${error.message}`)
    } finally {
      setIsUploadingImages(false)
    }
  }

  const deleteExistingImage = async (imageUrl: string, index: number) => {
    if (!product) return
    
    if (!confirm('Bu resmi silmek istediğinizden emin misiniz?')) return

    try {
      const supabase = createClient()
      
      const urlParts = imageUrl.split('/product-images/')
      if (urlParts.length === 2) {
        const filePath = urlParts[1]
        
        await supabase.storage
          .from('product-images')
          .remove([filePath])
      }

      const currentImages = product.images || []
      const newImagesArray = currentImages.filter((_: any, i: number) => i !== index)
      
      const { error } = await supabase
        .from('products')
        .update({ images: newImagesArray })
        .eq('id', product.id)

      if (error) throw error

      alert('✅ Resim silindi!')
      window.location.reload()
      
    } catch (error: any) {
      console.error('Image delete error:', error)
      alert(`❌ Hata: ${error.message}`)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Ürün Resimleri</h3>
        <label 
          htmlFor="product-image-upload"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-all text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          Resim Ekle
          <input
            id="product-image-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Yeni Yüklenenler */}
      {newImages.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-blue-900">
              {newImages.length} yeni resim seçildi
            </p>
            <Button
              onClick={uploadNewImages}
              disabled={isUploadingImages}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isUploadingImages ? 'Yükleniyor...' : 'Kaydet'}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {imagePreviewUrls.map((url, index) => (
              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-blue-300">
                <img
                  src={url}
                  alt={`Yeni ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeNewImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mevcut Resimler */}
      {product?.images && Array.isArray(product.images) && product.images.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          {product.images.map((image: string, index: number) => (
            <div
              key={index}
              className="relative group aspect-square rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all"
            >
              <img
                src={image}
                alt={`${product.name} - ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => deleteExistingImage(image, index)}
                className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                title="Resmi Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Henüz resim eklenmemiş</p>
          <p className="text-gray-400 text-xs mt-1">Yukarıdaki butonu kullanarak resim ekleyin</p>
        </div>
      )}
    </div>
  )
}
