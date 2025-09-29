'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Camera, FileImage, Loader2, Package } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface DeliveryConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  materialItem?: any
  materialOrders?: any[]
  shipmentData?: {[key: string]: any}
  onSuccess: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
  orderId?: string
  requestId?: string
}

export default function DeliveryConfirmationModal({
  isOpen,
  onClose,
  materialItem,
  materialOrders = [],
  shipmentData = {},
  onSuccess,
  showToast,
  orderId,
  requestId
}: DeliveryConfirmationModalProps) {
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [deliveredQuantity, setDeliveredQuantity] = useState<number>(0)
  const [maxQuantity, setMaxQuantity] = useState<number>(0)
  const [remainingQuantity, setRemainingQuantity] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Miktar hesaplamalarını yap
  useEffect(() => {
    if (materialItem && isOpen) {
      // Sipariş edilen toplam miktarı hesapla
      const totalOrderedQuantity = materialOrders
        .filter(order => order.material_item_id === materialItem.id)
        .reduce((sum, order) => sum + (order.quantity || 0), 0)

      // Zaten teslim alınan miktarı hesapla (shipmentData'dan)
      const materialShipments = shipmentData[materialItem.id]
      const alreadyDeliveredQuantity = materialShipments ? materialShipments.total_shipped : 0

      // Kalan miktarı hesapla
      const remaining = totalOrderedQuantity - alreadyDeliveredQuantity

      setMaxQuantity(totalOrderedQuantity)
      setRemainingQuantity(remaining)
      setDeliveredQuantity(Math.min(remaining, 1)) // Default olarak 1 veya kalan miktar

      console.log('📦 Miktar hesaplamaları:', {
        materialItem: materialItem.item_name,
        totalOrdered: totalOrderedQuantity,
        alreadyDelivered: alreadyDeliveredQuantity,
        remaining: remaining
      })
    }
  }, [materialItem, materialOrders, shipmentData, isOpen])

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
      const fileName = `delivery-receipts/material-${materialItem?.id}/${Date.now()}-${photo.name}`
      
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

      // Validasyonlar
      if (deliveredQuantity <= 0) {
        throw new Error('Teslim alınan miktar 0\'dan büyük olmalıdır')
      }

      if (deliveredQuantity > remainingQuantity) {
        throw new Error(`Teslim alınan miktar kalan miktardan (${remainingQuantity}) fazla olamaz`)
      }

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

      // Shipment kaydı oluştur (kısmi teslimat için)
      console.log('📦 Shipment kaydı oluşturuluyor:', {
        materialItemId: materialItem.id,
        deliveredQuantity: deliveredQuantity,
        requestId: requestId
      })

      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          purchase_request_id: requestId,
          purchase_request_item_id: materialItem.id,
          shipped_quantity: deliveredQuantity,
          shipped_at: new Date().toISOString(),
          shipped_by: user.id,
          delivery_receipt_photos: photoUrls,
          notes: notes.trim() || null,
          status: 'delivered'
        })

      if (shipmentError) {
        throw new Error(`Teslimat kaydı oluşturulurken hata oluştu: ${shipmentError.message}`)
      }

      console.log('✅ Shipment kaydı başarıyla oluşturuldu')

      // Update order with delivery confirmation (sadece gerçek order ID varsa)
      if (orderId && orderId !== 'temp-order-id') {
        console.log('📦 Order güncelleniyor:', orderId)
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
        console.log('✅ Order başarıyla güncellendi')
      } else {
        console.log('⚠️ Geçici order ID kullanıldığı için order güncellenmedi')
      }

      // Update purchase request status to 'teslim alındı' using secure function
      console.log('📋 Purchase request status güncelleniyor...')
      
      const { data: updateResult, error: requestError } = await supabase
        .rpc('update_delivery_status_by_site_personnel', {
          request_id: requestId,
          delivery_notes: notes.trim() || null
        })

      if (requestError) {
        throw new Error(`Talep durumu güncellenirken hata oluştu: ${requestError.message}`)
      }
      
      if (!updateResult) {
        throw new Error('Talep durumu güncellenemedi')
      }
      
      console.log('✅ Purchase request status başarıyla güncellendi')

      showToast(
        `${materialItem.item_name} için ${deliveredQuantity} ${materialItem.unit || 'adet'} teslimat kaydedildi!`, 
        'success'
      )
      onSuccess()
      onClose()
      
      // Reset form
      setNotes('')
      setPhotos([])
      setPhotoPreviewUrls([])
      setDeliveredQuantity(0)
      setMaxQuantity(0)
      setRemainingQuantity(0)
      
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
    setDeliveredQuantity(0)
    setMaxQuantity(0)
    setRemainingQuantity(0)
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
          {/* Material Info */}
          {materialItem && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-gray-600" />
                <p className="text-sm font-medium text-gray-900">Malzeme Bilgisi</p>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">{materialItem.item_name}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Sipariş Edilen:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {maxQuantity} {materialItem.unit || 'adet'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Kalan Miktar:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {remainingQuantity} {materialItem.unit || 'adet'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-3">
            <Label htmlFor="delivered-quantity" className="text-sm font-medium text-gray-900">
              Teslim Alınan Miktar
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="delivered-quantity"
                type="number"
                min="0.1"
                max={remainingQuantity}
                step="0.1"
                value={deliveredQuantity}
                onChange={(e) => setDeliveredQuantity(Number(e.target.value))}
                className="bg-white border-gray-200 pr-16"
                placeholder="Miktar girin"
                disabled={uploading}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                {materialItem?.unit || 'adet'}
              </div>
            </div>
            {deliveredQuantity > remainingQuantity && (
              <p className="text-sm text-red-600">
                Teslim alınan miktar kalan miktardan ({remainingQuantity}) fazla olamaz
              </p>
            )}
            <p className="text-xs text-gray-500">
              Kısmi teslimat yapabilirsiniz. Kalan miktar için daha sonra yeni teslimat kaydı oluşturabilirsiniz.
            </p>
          </div>

          {/* Delivery Date Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Teslimat Tarihi</p>
            <p className="text-lg font-medium text-gray-900">
              {new Date().toLocaleDateString('tr-TR')}
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
              disabled={
                uploading || 
                photos.length === 0 || 
                deliveredQuantity <= 0 || 
                deliveredQuantity > remainingQuantity
              }
              className="flex-1 bg-gray-800 hover:bg-gray-900 text-white"
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

          {(photos.length === 0 || deliveredQuantity <= 0 || deliveredQuantity > remainingQuantity) && (
            <div className="text-sm text-gray-600 text-center pt-2 space-y-1">
              {photos.length === 0 && (
                <p>• En az 1 irsaliye fotoğrafı yüklemeniz gerekiyor</p>
              )}
              {deliveredQuantity <= 0 && (
                <p>• Teslim alınan miktar 0'dan büyük olmalı</p>
              )}
              {deliveredQuantity > remainingQuantity && (
                <p>• Teslim alınan miktar kalan miktardan fazla olamaz</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
