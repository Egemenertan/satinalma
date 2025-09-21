'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Camera, FileImage, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface DeliveryConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  requestId: string
  deliveryDate: string
  onSuccess: () => void
}

export default function DeliveryConfirmationModal({
  isOpen,
  onClose,
  orderId,
  requestId,
  deliveryDate,
  onSuccess
}: DeliveryConfirmationModalProps) {
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const supabase = createClient()

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        showToast('Sadece resim dosyaları yükleyebilirsiniz', 'error')
        return false
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showToast(`${file.name} dosyası çok büyük (maksimum 10MB)`, 'error')
        return false
      }
      return true
    })

    if (validFiles.length + photos.length > 5) {
      showToast('Maksimum 5 fotoğraf yükleyebilirsiniz', 'error')
      return
    }

    // Add new files to existing ones
    setPhotos(prev => [...prev, ...validFiles])
    
    // Create preview URLs
    const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file))
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls])
  }

  const removePhoto = (index: number) => {
    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(photoPreviewUrls[index])
    
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const uploadPhotosToSupabase = async (): Promise<string[]> => {
    const uploadedUrls: string[] = []

    for (const photo of photos) {
      const fileName = `delivery-receipts/${orderId}/${Date.now()}-${photo.name}`
      
      const { data, error } = await supabase.storage
        .from('satinalma')
        .upload(fileName, photo)

      if (error) {
        throw new Error(`Fotoğraf yüklenirken hata oluştu: ${error.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('satinalma')
        .getPublicUrl(fileName)

      uploadedUrls.push(publicUrl)
    }

    return uploadedUrls
  }

  const handleConfirmDelivery = async () => {
    try {
      setUploading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      // Upload photos first
      let photoUrls: string[] = []
      if (photos.length > 0) {
        photoUrls = await uploadPhotosToSupabase()
      }

      // Update order with delivery confirmation
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivery_receipt_photos: photoUrls,
          delivered_at: new Date().toISOString(),
          received_by: user.id,
          delivery_notes: notes.trim() || null
        })
        .eq('id', orderId)

      if (orderError) {
        throw new Error(`Teslimat kaydedilirken hata oluştu: ${orderError.message}`)
      }

      // Update purchase request status to 'teslim alındı'
      const { error: requestError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'teslim alındı'
        })
        .eq('id', requestId)

      if (requestError) {
        throw new Error(`Talep durumu güncellenirken hata oluştu: ${requestError.message}`)
      }

      showToast('Teslimat başarıyla kaydedildi!', 'success')
      onSuccess()
      onClose()
      
      // Reset form
      setNotes('')
      setPhotos([])
      setPhotoPreviewUrls([])
      
    } catch (error) {
      console.error('Error confirming delivery:', error)
      showToast(
        error instanceof Error ? error.message : 'Teslimat kaydedilirken hata oluştu',
        'error'
      )
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    // Clean up preview URLs
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url))
    setPhotoPreviewUrls([])
    setPhotos([])
    setNotes('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-medium text-gray-900">
            Teslimat Onayı
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Delivery Date Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Teslimat Tarihi</p>
            <p className="text-lg font-medium text-gray-900">
              {new Date(deliveryDate).toLocaleDateString('tr-TR')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Bugün teslimat alındığını onaylıyorsunuz
            </p>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-900">
              İrsaliye Fotoğrafları
              <span className="text-red-500 ml-1">*</span>
            </Label>
            
            {/* Upload Button */}
            <div className="flex flex-col gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors bg-white"
                disabled={uploading || photos.length >= 5}
              >
                <div className="flex items-center gap-2 text-gray-600">
                  <Camera className="h-5 w-5" />
                  <span>
                    {photos.length >= 5 
                      ? 'Maksimum 5 fotoğraf yükleyebilirsiniz' 
                      : 'İrsaliye fotoğrafı ekle'}
                  </span>
                </div>
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* Photo Previews */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`İrsaliye fotoğrafı ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200"
                      disabled={uploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">
              • En fazla 5 fotoğraf yükleyebilirsiniz
              • Maksimum dosya boyutu: 10MB
              • Desteklenen formatlar: JPG, PNG, WEBP
            </p>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="delivery-notes" className="text-sm font-medium text-gray-900">
              Teslimat Notları (Opsiyonel)
            </Label>
            <Textarea
              id="delivery-notes"
              placeholder="Teslimat ile ilgili özel notlarınızı buraya yazabilirsiniz..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] bg-white border-gray-200"
              disabled={uploading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={uploading}
            >
              İptal
            </Button>
            <Button
              onClick={handleConfirmDelivery}
              disabled={uploading || photos.length === 0}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Teslimatı Onayla'
              )}
            </Button>
          </div>

          {photos.length === 0 && (
            <p className="text-sm text-gray-600 text-center pt-2">
              Teslimatı onaylamak için en az 1 irsaliye fotoğrafı yüklemeniz gerekiyor.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
