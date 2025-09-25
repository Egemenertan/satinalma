'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Camera, FileImage, Loader2, Check, Package } from 'lucide-react'

interface MaterialDeliveryModalProps {
  isOpen: boolean
  onClose: () => void
  materialItem?: any
  materialOrders?: any[]
  onSuccess: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
}

export default function MaterialDeliveryModal({
  isOpen,
  onClose,
  materialItem,
  materialOrders = [],
  onSuccess,
  showToast
}: MaterialDeliveryModalProps) {
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [orderPhotos, setOrderPhotos] = useState<{[orderId: string]: File[]}>({})
  const [orderPhotoPreviewUrls, setOrderPhotoPreviewUrls] = useState<{[orderId: string]: string[]}>({})
  const fileInputRefs = useRef<{[orderId: string]: HTMLInputElement | null}>({})
  const supabase = createClient()

  // Initialize selected orders when modal opens
  useEffect(() => {
    if (isOpen && materialOrders.length > 0) {
      // By default, select all undelivered orders
      const undeliveredOrders = materialOrders.filter(order => !order.is_delivered)
      setSelectedOrders(undeliveredOrders.map(order => order.id))
    }
  }, [isOpen, materialOrders])

  const handleOrderPhotoUpload = (orderId: string, event: React.ChangeEvent<HTMLInputElement>) => {
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

    if (validFiles.length > 0) {
      setOrderPhotos(prev => ({
        ...prev,
        [orderId]: [...(prev[orderId] || []), ...validFiles].slice(0, 5)
      }))
      
      // Create preview URLs
      const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file))
      setOrderPhotoPreviewUrls(prev => ({
        ...prev,
        [orderId]: [...(prev[orderId] || []), ...newPreviewUrls].slice(0, 5)
      }))
    }
  }

  const removeOrderPhoto = (orderId: string, index: number) => {
    // Cleanup preview URL
    const previewUrls = orderPhotoPreviewUrls[orderId] || []
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index])
    }
    
    setOrderPhotos(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).filter((_, i) => i !== index)
    }))
    
    setOrderPhotoPreviewUrls(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).filter((_, i) => i !== index)
    }))
  }

  // Basit fotoğraf upload fonksiyonu
  const uploadPhotoToSupabase = async (file: File, orderId: string): Promise<string> => {
    const timestamp = Date.now()
    const fileName = `delivery-receipts/order-${orderId}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    try {
      // Invoices bucket'ı kullan (mevcut olduğunu biliyoruz)
      const { data, error } = await supabase.storage
        .from('invoices')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        throw new Error(`Fotoğraf yüklenirken hata oluştu: ${error.message}`)
      }

      // Public URL al
      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error('❌ Fotoğraf upload hatası:', error)
      throw error
    }
  }

  const handleConfirmDelivery = async () => {
    if (!materialItem) {
      showToast('Malzeme bilgisi bulunamadı', 'error')
      return
    }

    if (selectedOrders.length === 0) {
      showToast('Lütfen teslim alınacak siparişleri seçin', 'error')
      return
    }

    try {
      setUploading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      console.log('💾 Basit teslimat onayı başlıyor:', {
        selectedOrders: selectedOrders.length,
        userId: user.id,
        materialName: materialItem.item_name
      })

      // MCP fonksiyonu kullanarak teslimat onayı (fotoğraf upload dahil)
      for (const orderId of selectedOrders) {
        const order = materialOrders.find(o => o.id === orderId)
        if (!order) continue

        console.log(`📦 Sipariş ${orderId} teslimat olarak işaretleniyor...`)

        // Bu sipariş için fotoğrafları yükle
        let photoUrls: string[] = []
        const orderPhotoList = orderPhotos[orderId] || []
        
        if (orderPhotoList.length > 0) {
          console.log(`📸 Sipariş ${orderId} için ${orderPhotoList.length} fotoğraf yükleniyor...`)
          
          for (const photo of orderPhotoList) {
            try {
              const photoUrl = await uploadPhotoToSupabase(photo, orderId)
              photoUrls.push(photoUrl)
              console.log(`✅ Fotoğraf yüklendi: ${photoUrl}`)
            } catch (photoError) {
              console.error(`❌ Fotoğraf yükleme hatası:`, photoError)
              // Fotoğraf hatası teslimatı durdurmasın, sadece uyarı ver
              showToast(`Fotoğraf yüklenirken hata oluştu: ${photoError}`, 'error')
            }
          }
        }

        // RPC fonksiyonu ile güncelleme (fotoğraf URL'leri dahil)
        const { data: result, error: rpcError } = await supabase
          .rpc('confirm_order_delivery', {
            p_order_id: orderId,
            p_user_id: user.id,
            p_notes: notes || null,
            p_photo_urls: photoUrls.length > 0 ? photoUrls : null
          })

        if (rpcError) {
          console.error('❌ RPC hatası:', rpcError)
          throw new Error(`Sipariş güncellenirken hata oluştu: ${rpcError.message}`)
        }

        if (result && result.length > 0 && !result[0].success) {
          console.error('❌ Fonksiyon hatası:', result[0].message)
          throw new Error(`Sipariş güncellenirken hata oluştu: ${result[0].message}`)
        }

        console.log(`✅ Sipariş ${orderId} başarıyla güncellendi`, {
          result,
          photoCount: photoUrls.length,
          photoUrls
        })
      }

      const totalOrders = selectedOrders.length
      
      showToast(
        `${materialItem.item_name} için ${totalOrders} sipariş teslimatı onaylandı`, 
        'success'
      )
      
      // Reset form
      setNotes('')
      setOrderPhotos({})
      setOrderPhotoPreviewUrls({})
      setSelectedOrders([])
      
      // Call success callback and close modal
      onSuccess()
      onClose()

    } catch (error) {
      console.error('❌ Teslimat onayı hatası:', error)
      showToast(
        error instanceof Error ? error.message : 'Teslimat onaylanırken bir hata oluştu',
        'error'
      )
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    // Clean up all preview URLs
    Object.values(orderPhotoPreviewUrls).flat().forEach(url => URL.revokeObjectURL(url))
    setOrderPhotoPreviewUrls({})
    setOrderPhotos({})
    setNotes('')
    setSelectedOrders([])
    onClose()
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  if (!materialItem) return null

  const undeliveredOrders = materialOrders.filter(order => !order.is_delivered)
  const deliveredOrders = materialOrders.filter(order => order.is_delivered)
  

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-medium text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            {materialItem.item_name} - Teslimat Onayı
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Material Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Malzeme Bilgisi</span>
            </div>
            <p className="text-lg font-medium text-blue-900">{materialItem.item_name}</p>
            <p className="text-sm text-blue-700">
              Birim: {materialItem.unit} | 
              Kalan Miktar: {(materialItem.quantity || 0).toFixed(2)} {materialItem.unit}
            </p>
          </div>

          {/* Order Selection - Individual Orders */}
          {undeliveredOrders.length > 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium text-gray-900">
                Teslim Alınacak Siparişler
                <span className="text-red-500 ml-1">*</span>
              </Label>
              
              <div className="space-y-3 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
                {undeliveredOrders.map((order: any, index: number) => (
                  <div key={order.id} className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                    {/* Order Header with Supplier Info */}
                    <div className="flex items-start gap-3 mb-4">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            Sipariş #{(index + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="text-sm font-semibold text-gray-700">
                            {(order.quantity || 0)} {materialItem.unit}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="text-xs text-gray-500">Teslimat Tarihi:</span>
                            <div className="font-medium">
                              {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Tedarikçi:</span>
                            <div className="font-medium text-blue-700">{order.supplier?.name || 'Bilinmeyen Tedarikçi'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Individual Order Photo Upload */}
                    <div className="space-y-3 ml-6">
                      <Label className="text-sm font-medium text-purple-700">
                        Bu Sipariş için İrsaliye Fotoğrafları
                      </Label>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRefs.current[order.id]?.click()}
                        className="w-full h-10 border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors bg-purple-50"
                        disabled={uploading || (orderPhotos[order.id]?.length || 0) >= 5}
                      >
                        <div className="flex items-center gap-2 text-purple-600">
                          <Camera className="h-4 w-4" />
                          <span className="text-sm">
                            {(orderPhotos[order.id]?.length || 0) >= 5 
                              ? 'Maksimum 5 fotoğraf' 
                              : 'İrsaliye fotoğrafı ekle'}
                          </span>
                        </div>
                      </Button>

                      <input
                        ref={(el) => { fileInputRefs.current[order.id] = el }}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleOrderPhotoUpload(order.id, e)}
                      />

                      {/* Photo Previews */}
                      {orderPhotos[order.id] && orderPhotos[order.id].length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {(orderPhotoPreviewUrls[order.id] || []).map((url, photoIndex) => (
                            <div key={photoIndex} className="relative group">
                              <img
                                src={url}
                                alt={`Sipariş ${order.id} irsaliye ${photoIndex + 1}`}
                                className="w-full h-16 object-cover rounded-lg border border-gray-200"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => removeOrderPhoto(order.id, photoIndex)}
                                className="absolute top-0.5 right-0.5 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-2 w-2" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedOrders.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <strong>{selectedOrders.length}</strong> sipariş seçildi. 
                    Toplam miktar: <strong>
                      {undeliveredOrders
                        .filter(order => selectedOrders.includes(order.id))
                        .reduce((sum, order) => sum + (order.quantity || 0), 0)
                        .toFixed(2)
                      } {materialItem.unit}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Already Delivered Orders */}
          {deliveredOrders.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Daha Önce Teslim Alınan Siparişler
              </Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {deliveredOrders.map((order: any, index: number) => (
                  <div key={order.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-green-900">
                            Sipariş #{(index + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="text-sm font-semibold text-green-700">
                            {(order.quantity || 0)} {materialItem.unit}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                          <div>
                            <span className="text-green-600">Teslim alındı:</span>
                            <div className="font-medium">
                              {order.delivery_confirmed_at 
                                ? new Date(order.delivery_confirmed_at).toLocaleDateString('tr-TR') 
                                : 'Tarih belirtilmedi'
                              }
                            </div>
                          </div>
                          <div>
                            <span className="text-green-600">Tedarikçi:</span>
                            <div className="font-medium">{order.supplier?.name || 'Bilinmeyen Tedarikçi'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Orders Message */}
          {undeliveredOrders.length === 0 && deliveredOrders.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-600">Bu malzeme için henüz sipariş verilmemiş.</p>
            </div>
          )}


          {/* Notes Section */}
          {undeliveredOrders.length > 0 && (
            <div className="space-y-3">
              <Label htmlFor="delivery-notes" className="text-sm font-medium text-gray-900">
                Teslimat Notları (İsteğe Bağlı)
              </Label>
              <Textarea
                id="delivery-notes"
                placeholder="Teslimat ile ilgili not ekleyebilirsiniz..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={uploading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {undeliveredOrders.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={uploading}
                  className="flex-1"
                >
                  İptal
                </Button>
                
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={uploading || selectedOrders.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Teslimatı Onayla ({selectedOrders.length})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Kapat
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
