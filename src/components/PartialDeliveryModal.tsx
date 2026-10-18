'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Camera, FileImage, Loader2, Package, Check, AlertCircle, Scan } from 'lucide-react'
import DocumentScanner from '@/components/DocumentScanner'

interface PartialDeliveryModalProps {
  isOpen: boolean
  onClose: () => void
  order: any // Sipariş bilgisi
  materialItem?: any // Malzeme bilgisi
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export default function PartialDeliveryModal({
  isOpen,
  onClose,
  order,
  materialItem,
  onSuccess,
  showToast
}: PartialDeliveryModalProps) {
  const [deliveredQuantity, setDeliveredQuantity] = useState<string>('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [qualityCheck, setQualityCheck] = useState(true)
  const [damageNotes, setDamageNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [orderDeliveries, setOrderDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]) // Mevcut fotoğraf URL'leri
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null) // Düzenlenen teslimat ID'si
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  
  // Mobil cihaz kontrolü
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  // Edit mode kontrolü
  const isEditMode = order?.isEditMode === true

  // Modal açıldığında mevcut teslimatları yükle
  useEffect(() => {
    if (isOpen && order?.id) {
      loadOrderDeliveries()
    }
  }, [isOpen, order?.id])

  const loadOrderDeliveries = async () => {
    if (!order?.id) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('order_deliveries')
        .select(`
          *,
          profiles:received_by (
            full_name
          )
        `)
        .eq('order_id', order.id)
        .order('delivered_at', { ascending: false })

      if (error) throw error
      setOrderDeliveries(data || [])
      
      // Edit mode ise, en son teslimatı yükle
      if (isEditMode && data && data.length > 0) {
        const lastDelivery = data[0] // En son teslimat
        loadDeliveryForEdit(lastDelivery)
      }
    } catch (error) {
      console.error('Teslimat geçmişi yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Düzenleme için teslimat verilerini yükle
  const loadDeliveryForEdit = (delivery: any) => {
    setSelectedDeliveryId(delivery.id)
    setDeliveredQuantity(delivery.delivered_quantity.toString())
    setDeliveryNotes(delivery.delivery_notes || '')
    setQualityCheck(delivery.quality_check !== false) // Default true
    setDamageNotes(delivery.damage_notes || '')
    
    // Mevcut fotoğraf URL'lerini yükle
    if (delivery.delivery_photos && Array.isArray(delivery.delivery_photos)) {
      setExistingPhotoUrls(delivery.delivery_photos)
    }
  }

  // Toplam teslim alınan miktar
  const totalDelivered = orderDeliveries.reduce((sum, delivery) => 
    sum + (delivery.delivered_quantity || 0), 0
  )
  
  // İade edilen miktar
  const returnedQuantity = order?.returned_quantity || 0
  
  // Kalan miktar (sipariş miktarı - teslim alınan - iade edilen)
  const remainingQuantity = (order?.quantity || 0) - totalDelivered - returnedQuantity
  
  // Maksimum teslim alınabilecek miktar
  const maxDeliverable = Math.max(0, remainingQuantity)

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newFiles = Array.from(files).slice(0, 5 - photos.length)
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      }
    })

    setPhotos(prev => [...prev, ...newFiles])
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls])
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }
  
  // Mevcut fotoğrafı kaldır
  const removeExistingPhoto = (index: number) => {
    setExistingPhotoUrls(prev => prev.filter((_, i) => i !== index))
  }

  const triggerCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // Mobil cihazlarda kamerayı direkt aç
    input.setAttribute('capture', 'environment')
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) {
        handlePhotoUpload({ target } as any)
      }
    }
    input.click()
  }
  
  // Handle scanner complete
  const handleScanComplete = (files: File[]) => {
    if (files.length + photos.length > 5) {
      showToast('Maksimum 5 fotoğraf yükleyebilirsiniz', 'error')
      return
    }

    const newPreviewUrls: string[] = []
    files.forEach(file => {
      const previewUrl = URL.createObjectURL(file)
      newPreviewUrls.push(previewUrl)
    })

    setPhotos(prev => [...prev, ...files])
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls])
    setIsScannerOpen(false)
  }

  const uploadPhotosToSupabase = async (): Promise<string[]> => {
    if (photos.length === 0) return []

    const uploadedUrls: string[] = []
    
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      const fileExt = file.name.split('.').pop()
      const fileName = `order_deliveries/${order.id}_${Date.now()}_${i}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('satinalma')
        .upload(fileName, file)

      if (error) {
        throw new Error(`Fotoğraf yüklenirken hata oluştu: ${error.message}`)
      }

      const { data: urlData } = supabase.storage
        .from('satinalma')
        .getPublicUrl(fileName)

      uploadedUrls.push(urlData.publicUrl)
    }
    
    return uploadedUrls
  }

  const handleConfirmDelivery = async () => {
    try {
      setUploading(true)

      // Validasyonlar
      const quantity = parseFloat(deliveredQuantity)
      if (!deliveredQuantity || quantity <= 0) {
        throw new Error('Geçerli bir miktar girin')
      }

      // En az 1 fotoğraf zorunlu (mevcut veya yeni)
      const totalPhotos = existingPhotoUrls.length + photos.length
      if (totalPhotos === 0) {
        throw new Error('En az 1 irsaliye fotoğrafı olmalıdır')
      }

      // Edit mode değilse miktar kontrolü yap
      if (!isEditMode && quantity > maxDeliverable) {
        throw new Error(`Maksimum ${maxDeliverable} ${materialItem?.unit || 'adet'} teslim alabilirsiniz`)
      }

      // Kullanıcıyı al
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      // Yeni fotoğrafları yükle
      const newPhotoUrls = await uploadPhotosToSupabase()
      
      // Tüm fotoğraf URL'lerini birleştir (mevcut + yeni)
      const allPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls]

      if (isEditMode && selectedDeliveryId) {
        // Edit mode: Mevcut teslimatı güncelle
        console.log('📝 Teslimat güncelleniyor:', {
          deliveryId: selectedDeliveryId,
          delivered_quantity: quantity,
          delivery_notes: deliveryNotes.trim() || null,
          delivery_photos: allPhotoUrls,
          quality_check: qualityCheck,
          damage_notes: damageNotes.trim() || null
        })
        
        const { error: updateError } = await supabase
          .from('order_deliveries')
          .update({
            delivered_quantity: quantity,
            delivery_notes: deliveryNotes.trim() || null,
            delivery_photos: allPhotoUrls,
            quality_check: qualityCheck,
            damage_notes: damageNotes.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDeliveryId)

        if (updateError) {
          throw new Error(`Teslimat güncelleme başarısız: ${updateError.message}`)
        }

        showToast('Teslimat bilgileri başarıyla güncellendi!', 'success')
      } else {
        // Normal mode: Yeni teslimat kaydı oluştur
        console.log('🔍 create_order_delivery parametreleri:', {
          p_order_id: order.id,
          p_delivered_quantity: quantity,
          p_received_by: user.id,
          p_delivery_notes: deliveryNotes.trim() || null,
          p_delivery_photos: allPhotoUrls,
          p_quality_check: qualityCheck,
          p_damage_notes: damageNotes.trim() || null
        })
        
        const { data, error } = await supabase
          .rpc('create_order_delivery', {
            p_order_id: order.id,
            p_delivered_quantity: quantity,
            p_received_by: user.id,
            p_delivery_notes: deliveryNotes.trim() || null,
            p_delivery_photos: allPhotoUrls,
            p_quality_check: qualityCheck,
            p_damage_notes: damageNotes.trim() || null
          })

        if (error) {
          throw new Error(`Teslim alma işlemi başarısız: ${error.message}`)
        }

        const result = data as any
        if (!result.success) {
          throw new Error(result.error || 'Teslim alma işlemi başarısız')
        }

        const newRemaining = result.remaining_quantity || 0
        const isCompleted = newRemaining <= 0
        const orderStatus = result.order_status || 'pending'
        
        console.log('✅ Teslim alma sonucu:', {
          orderId: order.id,
          newRemaining,
          isCompleted,
          orderStatus,
          totalDelivered: result.total_delivered
        })

        showToast(
          isCompleted 
            ? `${materialItem?.item_name || 'Sipariş'} tamamen teslim alındı!`
            : `${quantity} ${materialItem?.unit || 'adet'} teslim alındı. Kalan: ${newRemaining} ${materialItem?.unit || 'adet'}`,
          'success'
        )
      }

      // Cache'i temizle ki tabloda güncel status gözüksün
      try {
        const { invalidatePurchaseRequestsCache } = await import('@/lib/cache')
        invalidatePurchaseRequestsCache()
        
        // SWR cache'ini de manuel olarak temizle
        const { mutate } = await import('swr')
        mutate('purchase_requests_stats')
        mutate('pending_requests_count')
        
        // Tüm purchase_requests cache'lerini temizle
        mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
        
        // Ek cache temizleme - tüm SWR cache'ini temizle
        mutate(() => true, undefined, { revalidate: true })
        
        console.log('✅ Cache temizlendi ve status güncellendi')
        
        // Kısa bir bekleme sonrası tekrar temizle
        setTimeout(() => {
          mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
          console.log('🔄 Cache ikinci kez temizlendi')
        }, 1000)
        
      } catch (error) {
        console.error('Cache temizleme hatası:', error)
      }

      onSuccess()
      handleClose()
      
    } catch (error: any) {
      console.error('Teslim alma hatası:', error)
      showToast(error.message || 'Teslim alma işlemi başarısız', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    // Cleanup
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url))
    setPhotoPreviewUrls([])
    setPhotos([])
    setDeliveredQuantity('')
    setDeliveryNotes('')
    setDamageNotes('')
    setQualityCheck(true)
    setOrderDeliveries([])
    setExistingPhotoUrls([])
    setSelectedDeliveryId(null)
    onClose()
  }

  if (!order) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            {isEditMode ? 'Teslimat Bilgilerini Düzenle' : 'Kademeli Teslim Alma'}
          </DialogTitle>
          <div className="text-sm text-gray-600">
            {materialItem?.item_name || 'Sipariş'} • {order.suppliers?.name || 'Tedarikçi'}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sipariş Özeti */}
          <div className="bg-gray-50 rounded-3xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Sipariş Bilgileri</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Toplam Sipariş:</span>
                <p className="font-semibold text-gray-900">
                  {order.quantity} {materialItem?.unit || 'adet'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Teslim Alınan:</span>
                <p className="font-semibold text-green-600">
                  {totalDelivered.toFixed(2)} {materialItem?.unit || 'adet'}
                </p>
              </div>
              {returnedQuantity > 0 && (
                <div>
                  <span className="text-gray-600">İade Edilen:</span>
                  <p className="font-semibold text-orange-600">
                    {returnedQuantity.toFixed(2)} {materialItem?.unit || 'adet'}
                  </p>
                </div>
              )}
              <div>
                <span className="text-gray-600">Teslim Alınabilir:</span>
                <p className="font-semibold text-blue-600">
                  {remainingQuantity.toFixed(2)} {materialItem?.unit || 'adet'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Durum:</span>
                <Badge className={`text-xs ${
                  remainingQuantity <= 0 
                    ? 'bg-green-100 text-green-700' 
                    : totalDelivered > 0 
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                }`}>
                  {remainingQuantity <= 0 ? 'Tamamlandı' : totalDelivered > 0 ? 'Kısmi' : 'Bekliyor'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Teslim Alma Formu */}
          {(remainingQuantity > 0 || isEditMode) && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">
                {isEditMode ? 'Teslimat Bilgileri' : 'Yeni Teslim Alma'}
              </h4>
              
              {/* Miktar Girişi */}
              <div>
                <Label htmlFor="quantity" className="text-sm font-medium">
                  Teslim Alınan Miktar *
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxDeliverable}
                    value={deliveredQuantity}
                    onChange={(e) => setDeliveredQuantity(e.target.value)}
                    placeholder="Miktar girin"
                    className="flex-1"
                  />
                  <div className="flex items-center px-3 bg-gray-50 border rounded-md">
                    <span className="text-sm text-gray-600">{materialItem?.unit || 'adet'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maksimum: {maxDeliverable} {materialItem?.unit || 'adet'}
                </p>
              </div>

              {/* Kalite Kontrolü */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="quality"
                  checked={qualityCheck}
                  onChange={(e) => setQualityCheck(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="quality" className="text-sm">
                  Kalite kontrolü geçti
                </Label>
              </div>

              {/* Hasar Notları (kalite kontrolü geçmezse) */}
              {!qualityCheck && (
                <div>
                  <Label htmlFor="damage" className="text-sm font-medium">
                    Hasar/Problem Açıklaması
                  </Label>
                  <Textarea
                    id="damage"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Hasarı veya problemi detaylandırın..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
              )}

              {/* Notlar */}
              <div>
                <Label htmlFor="notes" className="text-sm font-medium">
                  Teslimat Notları
                </Label>
                <Textarea
                  id="notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Teslimat ile ilgili notlar..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Teslim Alma Geçmişi */}
          {orderDeliveries.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Teslim Alma Geçmişi</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderDeliveries.map((delivery, index) => (
                  <div key={delivery.id} className="bg-green-50 border border-green-200 rounded-3xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {delivery.delivered_quantity} {materialItem?.unit || 'adet'}
                        </span>
                      </div>
                      <span className="text-xs text-green-600">
                        {new Date(delivery.delivered_at).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    {delivery.delivery_notes && (
                      <p className="text-xs text-green-700">{delivery.delivery_notes}</p>
                    )}
                    {delivery.profiles?.full_name && (
                      <p className="text-xs text-green-600">
                        Teslim alan: {delivery.profiles.full_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* İrsaliye Fotoğrafları - En Altta */}
          {(remainingQuantity > 0 || isEditMode) && (
            <div>
                <Label className="text-sm font-medium mb-3 block">
                  Teslimat Fotoğrafları <span className="text-red-500">*</span>
                </Label>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerCameraCapture}
                    disabled={(existingPhotoUrls.length + photos.length) >= 10}
                    className="h-12 border-dashed"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Kamera
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={(existingPhotoUrls.length + photos.length) >= 10}
                    className="h-12 border-dashed"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Dosya Seç
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Mevcut Fotoğraflar (Edit Mode) */}
                {isEditMode && existingPhotoUrls.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block text-blue-600">
                      Mevcut İrsaliye Fotoğrafları
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {existingPhotoUrls.map((url, index) => (
                        <div key={`existing-${index}`} className="relative aspect-square">
                          <img
                            src={url}
                            alt={`Mevcut Fotoğraf ${index + 1}`}
                            className="w-full h-full object-cover rounded-3xl border border-blue-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              const img = new Image()
                              img.src = url
                              img.onload = () => {
                                const w = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
                                if (w) {
                                  w.document.write(`
                                    <html>
                                      <head>
                                        <title>İrsaliye Fotoğrafı ${index + 1}</title>
                                        <style>
                                          body { margin:0; background:#000; display:flex; align-items:center; justify-content:center; min-height:100vh; }
                                          img { max-width:100%; max-height:100vh; object-fit:contain; cursor:zoom-in; }
                                          img.zoomed { max-width:none; cursor:zoom-out; }
                                        </style>
                                      </head>
                                      <body>
                                        <img src="${url}" alt="İrsaliye Fotoğrafı ${index + 1}" onclick="this.classList.toggle('zoomed')" />
                                      </body>
                                    </html>
                                  `)
                                  w.document.close()
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeExistingPhoto(index)
                            }}
                            className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-400 text-black rounded-full z-10"
                            title="Fotoğrafı kaldır"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yeni Fotoğraf Önizlemeleri */}
                {photos.length > 0 && (
                  <div>
                    {isEditMode && (
                      <Label className="text-sm font-medium mb-2 block text-green-600">
                        Yeni Eklenecek Fotoğraflar
                      </Label>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={url}
                            alt={`Fotoğraf ${index + 1}`}
                            className="w-full h-full object-cover rounded-3xl border border-green-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              const img = new Image()
                              img.src = url
                              img.onload = () => {
                                const w = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
                                if (w) {
                                  w.document.write(`
                                    <html>
                                      <head>
                                        <title>Yeni Fotoğraf ${index + 1}</title>
                                        <style>
                                          body { margin:0; background:#000; display:flex; align-items:center; justify-content:center; min-height:100vh; }
                                          img { max-width:100%; max-height:100vh; object-fit:contain; cursor:zoom-in; }
                                          img.zoomed { max-width:none; cursor:zoom-out; }
                                        </style>
                                      </head>
                                      <body>
                                        <img src="${url}" alt="Yeni Fotoğraf ${index + 1}" onclick="this.classList.toggle('zoomed')" />
                                      </body>
                                    </html>
                                  `)
                                  w.document.close()
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removePhoto(index)
                            }}
                            className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-400 text-black rounded-full z-10"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2">
                  {isEditMode 
                    ? `Toplam: ${existingPhotoUrls.length + photos.length}/10 fotoğraf • En az 1 fotoğraf zorunlu`
                    : `${photos.length}/5 fotoğraf yüklendi • En az 1 fotoğraf zorunlu`
                  }
                </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            İptal
          </Button>
          
          {(remainingQuantity > 0 || isEditMode) && (
            <Button
              onClick={handleConfirmDelivery}
              disabled={
                !deliveredQuantity || 
                parseFloat(deliveredQuantity) <= 0 || 
                uploading || 
                (existingPhotoUrls.length + photos.length) === 0
              }
              className={isEditMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Güncelleniyor...' : 'Kaydediliyor...'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Güncelle' : 'Teslim Alındı Kaydet'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Document Scanner */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScanComplete}
        maxPages={5}
        title="Teslimat Belgesi Tara"
        description="Teslimat belgesini kamera ile tarayın, otomatik olarak iyileştirilecektir"
      />
    </Dialog>
  )
}
