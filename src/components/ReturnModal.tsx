'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RotateCcw, AlertTriangle, Camera, Upload, X, Image, Scan } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { softDeletePurchaseRequest } from '@/lib/softDeletePurchaseRequest'
import DocumentScanner from '@/components/DocumentScanner'

interface ReturnModalProps {
  isOpen: boolean
  onClose: () => void
  order: any
  materialItem: any
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export default function ReturnModal({
  isOpen,
  onClose,
  order,
  materialItem,
  onSuccess,
  showToast
}: ReturnModalProps) {
  const [returnQuantity, setReturnQuantity] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [reorderRequested, setReorderRequested] = useState<boolean | null>(null) // null = seçilmedi, true = evet, false = hayır
  const [isProcessing, setIsProcessing] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const supabase = createClient()
  
  // Mobil cihaz kontrolü
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  // Mevcut iade edilmiş miktar ve kalan miktar hesapla
  const currentReturnedQuantity = order?.returned_quantity || 0
  const orderQuantity = order?.quantity || 0
  const deliveredQuantity = order?.total_delivered || order?.delivered_quantity || 0
  // İade edilebilir miktar = Kalan miktar (Sipariş - Teslim alınan - İade edilen)
  const remainingQuantity = orderQuantity - deliveredQuantity - currentReturnedQuantity
  const maxReturnableQuantity = Math.max(0, remainingQuantity)

  // Fotoğraf upload fonksiyonları
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newFiles = Array.from(files).slice(0, 5 - photos.length)
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          showToast(`${file.name} dosyası çok büyük (maksimum 10MB)`, 'error')
          return
        }
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      } else {
        showToast('Sadece resim dosyaları yükleyebilirsiniz', 'error')
        return
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
      const fileName = `return_photos/${order.id}_${Date.now()}_${i}.${fileExt}`
      
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

  // Otomatik yeniden sipariş talebi oluşturma fonksiyonu
  const createAutoReorderRequest = async (returnQty: number, originalRequestId: string, originalOrderId: string, userProfile: any, user: any) => {
    try {
      console.log('🔄 Otomatik yeniden sipariş talebi oluşturuluyor:', {
        returnQuantity: returnQty,
        originalRequestId,
        originalOrderId,
        materialName: materialItem?.item_name
      })

      // originalRequestId kontrolü
      if (!originalRequestId || originalRequestId === 'undefined') {
        console.error('❌ originalRequestId geçersiz:', originalRequestId)
        showToast('Orijinal talep ID\'si bulunamadı. Otomatik talep oluşturulamıyor.', 'error')
        return null
      }

      // Orijinal talebi al
      console.log('🔍 Orijinal talep aranıyor:', {
        originalRequestId,
        orderData: {
          orderId: originalOrderId,
          purchaseRequestId: originalRequestId,
          materialItemId: order.material_item_id
        }
      })

      const { data: originalRequest, error: requestError } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', originalRequestId)
        .single()

      if (requestError) {
        console.error('❌ Orijinal talep bulunamadı - Detaylı hata:', {
          error: requestError,
          message: requestError.message,
          details: requestError.details,
          hint: requestError.hint,
          code: requestError.code,
          originalRequestId
        })
        showToast(`Orijinal talep bulunamadı: ${requestError.message}`, 'error')
        return
      }

      if (!originalRequest) {
        console.error('❌ Orijinal talep bulunamadı - Veri döndürülmedi:', {
          originalRequestId,
          queryResult: { data: originalRequest, error: requestError }
        })
        showToast('Orijinal talep bulunamadı: Veri döndürülmedi', 'error')
        return
      }

      console.log('✅ Orijinal talep bulundu:', {
        id: originalRequest.id,
        title: originalRequest.title,
        status: originalRequest.status,
        siteId: originalRequest.site_id
      })

      // Yeni talep oluştur - "iade nedeniyle sipariş" statusu ile
      // Normal talep numarası formatını kullan
      const now = new Date()
      const requestNumber = `REQ-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      
      const newRequestData = {
        request_number: requestNumber, // Normal talep numarası formatı
        title: `İade Nedeniyle Yeniden Sipariş - ${materialItem?.item_name}`,
        description: `${materialItem?.item_name} malzemesi için iade nedeniyle otomatik oluşturulan yeniden sipariş talebi. Orijinal talep: #${originalRequestId.toString().slice(-8)}`,
        department: originalRequest.department || 'Satın Alma',
        total_amount: 0, // Başlangıçta 0, teklif gelince güncellenecek
        currency: originalRequest.currency || 'TRY',
        urgency_level: originalRequest.urgency_level || 'normal',
        site_id: originalRequest.site_id,
        site_name: originalRequest.site_name,
        requested_by: user.id,
        status: 'iade nedeniyle sipariş',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        original_request_id: originalRequestId, // Hangi talepten türetildiğini takip et
        return_order_id: originalOrderId // Hangi sipariş iadesinden kaynaklandığını takip et
      }

      console.log('🔄 Yeni talep verisi:', newRequestData)

      const { data: newRequest, error: newRequestError } = await supabase
        .from('purchase_requests')
        .insert(newRequestData)
        .select()
        .single()

      if (newRequestError) {
        console.error('❌ Yeni talep oluşturulamadı - Detaylı hata:', {
          error: newRequestError,
          message: newRequestError.message,
          details: newRequestError.details,
          hint: newRequestError.hint,
          code: newRequestError.code
        })
        showToast(`Otomatik talep oluşturulamadı: ${newRequestError.message}`, 'error')
        return
      }

      if (!newRequest) {
        console.error('❌ Yeni talep oluşturulamadı - Veri döndürülmedi')
        showToast('Otomatik talep oluşturulamadı: Veri döndürülmedi', 'error')
        return
      }

      console.log('✅ Yeni talep oluşturuldu:', newRequest.id)

      // Malzeme item'ını yeni talebe ekle
      const newItemData = {
        purchase_request_id: newRequest.id,
        item_name: materialItem.item_name,
        description: materialItem.description || `İade nedeniyle yeniden sipariş - ${materialItem.item_name}`,
        quantity: Math.floor(returnQty), // Integer olarak kaydet
        unit: materialItem.unit,
        unit_price: 0, // Başlangıçta 0, teklif gelince güncellenecek
        brand: materialItem.brand || null,
        specifications: materialItem.specifications || null,
        purpose: materialItem.purpose || null,
        delivery_date: materialItem.delivery_date || null,
        image_urls: materialItem.image_urls || null,
        original_quantity: Math.floor(returnQty), // İlk talep miktarı
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('🔄 Yeni malzeme item verisi:', newItemData)

      const { data: newItem, error: newItemError } = await supabase
        .from('purchase_request_items')
        .insert(newItemData)
        .select()
        .single()

      if (newItemError) {
        console.error('❌ Yeni malzeme item oluşturulamadı - Detaylı hata:', {
          error: newItemError,
          message: newItemError.message,
          details: newItemError.details,
          hint: newItemError.hint,
          code: newItemError.code
        })
        showToast(`Malzeme item oluşturulamadı: ${newItemError.message}`, 'error')
        await softDeletePurchaseRequest(supabase, {
          requestId: newRequest.id,
          userId: user.id,
          reason: 'İade yeniden sipariş rollback — kalem oluşturulamadı',
        })
        return
      }

      if (!newItem) {
        console.error('❌ Yeni malzeme item oluşturulamadı - Veri döndürülmedi')
        showToast('Malzeme item oluşturulamadı: Veri döndürülmedi', 'error')
        await softDeletePurchaseRequest(supabase, {
          requestId: newRequest.id,
          userId: user.id,
          reason: 'İade yeniden sipariş rollback — kalem oluşturulamadı',
        })
        return
      }

      console.log('✅ Yeni malzeme item oluşturuldu:', newItem.id)

      // Audit log kaydı oluştur
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert({
          purchase_request_id: newRequest.id,
          action_type: 'auto_reorder_created',
          performed_by: user.id,
          user_role: userProfile?.role || 'santiye_depo',
          description: `İade nedeniyle otomatik yeniden sipariş talebi oluşturuldu. Orijinal talep: #${originalRequestId.toString().slice(-8)}, İade miktarı: ${returnQty} ${materialItem?.unit}`,
          comments: `Orijinal sipariş ID: ${originalOrderId}`,
          metadata: {
            original_request_id: originalRequestId,
            return_order_id: originalOrderId,
            returned_quantity: returnQty,
            material_name: materialItem?.item_name,
            auto_created: true
          }
        })

      if (auditError) {
        console.error('⚠️ Auto reorder audit log hatası - Detaylı:', {
          error: auditError,
          message: auditError.message,
          details: auditError.details,
          hint: auditError.hint,
          code: auditError.code
        })
      }

      showToast(
        `İade nedeniyle otomatik yeniden sipariş talebi oluşturuldu (Talep #${newRequest.id.toString().slice(-8)})`, 
        'info'
      )

      return newRequest.id

    } catch (error: any) {
      console.error('❌ Otomatik yeniden sipariş talebi oluşturma hatası:', error)
      // Bu hata ana işlemi durdurmasın
    }
  }

  const handleReturn = async () => {
    if (!returnQuantity || parseFloat(returnQuantity) <= 0) {
      showToast('Geçerli bir iade miktarı girin', 'error')
      return
    }

    if (!returnNotes.trim()) {
      showToast('İade nedeni girmeniz zorunludur', 'error')
      return
    }

    if (reorderRequested === null) {
      showToast('Lütfen "Yeniden sipariş verilsin mi?" sorusunu yanıtlayın', 'error')
      return
    }

    const returnQty = parseFloat(returnQuantity)
    
    if (returnQty > maxReturnableQuantity) {
      showToast(`Maksimum ${maxReturnableQuantity.toFixed(2)} ${materialItem?.unit} iade edebilirsiniz. (Kalan miktar: ${maxReturnableQuantity.toFixed(2)} ${materialItem?.unit})`, 'error')
      return
    }
    
    if (maxReturnableQuantity <= 0) {
      showToast('İade edilecek kalan miktar yok. Tüm malzeme teslim alındı veya iade edildi.', 'error')
      return
    }

    setIsProcessing(true)
    
    try {
      console.log('🔄 İade işlemi başlıyor:', {
        orderId: order.id,
        purchaseRequestId: order.purchase_request_id,
        materialItemId: order.material_item_id,
        returnQuantity: returnQty,
        currentReturned: currentReturnedQuantity,
        newTotalReturned: currentReturnedQuantity + returnQty,
        photosCount: photos.length,
        reorderRequested,
        orderData: order,
        materialItemData: materialItem
      })

      // Önce fotoğrafları yükle
      let photoUrls: string[] = []
      if (photos.length > 0) {
        console.log('📸 Fotoğraflar yükleniyor...')
        photoUrls = await uploadPhotosToSupabase()
        console.log('✅ Fotoğraflar yüklendi:', photoUrls)
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      // Kullanıcı rolünü kontrol et
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, site_id')
        .eq('id', user.id)
        .single()

      console.log('🔍 İade işlemi kullanıcı bilgileri:', {
        userId: user.id,
        userRole: userProfile?.role,
        siteId: userProfile?.site_id,
        orderId: order.id,
        profileError
      })

      // Orders tablosunda returned_quantity ve reorder_requested'ı güncelle
      const newReturnedQuantity = currentReturnedQuantity + returnQty
      
      console.log('🔄 Orders tablosu güncelleniyor:', {
        orderId: order.id,
        newReturnedQuantity,
        reorderRequested,
        returnNotes: returnNotes.trim(),
        updateData: {
          returned_quantity: newReturnedQuantity,
          reorder_requested: reorderRequested,
          updated_at: new Date().toISOString()
        }
      })
      
      // Sipariş tamamen iade edildi mi kontrol et
      const isFullyReturned = newReturnedQuantity >= order.quantity
      console.log('🔍 İade durumu kontrolü:', {
        newReturnedQuantity,
        orderQuantity: order.quantity,
        isFullyReturned,
        currentStatus: order.status,
        orderId: order.id
      })

      // returned_quantity, reorder_requested ve gerekirse status'u güncelle
      const updateData: any = {
        returned_quantity: newReturnedQuantity,
        reorder_requested: reorderRequested,
        updated_at: new Date().toISOString()
      }

      // Eğer sipariş tamamen iade edildiyse status'u güncelle
      if (isFullyReturned && order.status !== 'iade edildi') {
        updateData.status = 'iade edildi'
        console.log('✅ Sipariş tamamen iade edildi, status güncelleniyor: "iade edildi"')
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id)

      if (updateError) {
        console.error('❌ Orders tablosu güncelleme hatası:', {
          error: updateError,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
          orderId: order.id,
          userId: user.id
        })
        throw new Error(`İade kaydı güncellenemedi: ${updateError.message || 'Bilinmeyen hata'}`)
      }

      console.log('✅ Sipariş başarıyla güncellendi:', {
        orderId: order.id,
        newStatus: isFullyReturned ? 'iade edildi' : order.status,
        newReturnedQuantity,
        isFullyReturned,
        updateData
      })

      // Status'un gerçekten güncellenip güncellenmediğini kontrol et
      console.log('🔍 Status güncellemesi sonrası kontrol yapılıyor...')
      const { data: updatedOrder, error: checkError } = await supabase
        .from('orders')
        .select('id, status, returned_quantity, quantity')
        .eq('id', order.id)
        .single()

      if (checkError) {
        console.error('❌ Status kontrol hatası:', checkError)
      } else {
        console.log('📊 Güncellenmiş sipariş durumu:', {
          orderId: updatedOrder.id,
          currentStatus: updatedOrder.status,
          expectedStatus: isFullyReturned ? 'iade edildi' : order.status,
          returnedQuantity: updatedOrder.returned_quantity,
          totalQuantity: updatedOrder.quantity,
          isFullyReturned: updatedOrder.returned_quantity >= updatedOrder.quantity,
          statusMatches: updatedOrder.status === (isFullyReturned ? 'iade edildi' : order.status)
        })

        if (isFullyReturned && updatedOrder.status !== 'iade edildi') {
          console.warn('⚠️ UYARI: Status beklenen değerde değil, düzeltiliyor!', {
            expected: 'iade edildi',
            actual: updatedOrder.status,
            possibleCause: 'Trigger veya başka bir kod status\'u değiştiriyor olabilir'
          })
          
          // Status'u tekrar güncelle
          const { error: fixError } = await supabase
            .from('orders')
            .update({ 
              status: 'iade edildi',
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
            
          if (fixError) {
            console.error('❌ Status düzeltme hatası:', fixError)
          } else {
            console.log('✅ Status başarıyla "iade edildi" olarak düzeltildi')
          }
        }
      }

      // return_notes'u ayrı olarak güncellemeye çalış (sütun varsa)
      if (returnNotes.trim()) {
        console.log('🔄 return_notes güncelleniyor...')
        const { error: notesError } = await supabase
          .from('orders')
          .update({ return_notes: returnNotes.trim() })
          .eq('id', order.id)

        if (notesError) {
          console.warn('⚠️ return_notes güncellenemedi (sütun yok olabilir):', notesError.message)
          // return_notes hatası ana işlemi durdurmasın
        } else {
          console.log('✅ return_notes başarıyla güncellendi')
        }
      }

      // Eğer reorder_requested true ise otomatik yeniden sipariş talebi oluştur
      let autoReorderCreated = false
      if (reorderRequested === true) {
        console.log('🔄 Otomatik yeniden sipariş talebi oluşturuluyor...')
        
        // purchase_request_id'yi farklı yollardan bul
        let purchaseRequestId = order.purchase_request_id
        
        // Eğer order'da purchase_request_id yoksa, material_item_id üzerinden bul
        if (!purchaseRequestId && order.material_item_id) {
          console.log('🔍 purchase_request_id bulunamadı, material_item_id üzerinden aranıyor...')
          
          const { data: materialItem, error: materialError } = await supabase
            .from('purchase_request_items')
            .select('purchase_request_id')
            .eq('id', order.material_item_id)
            .single()
            
          if (materialItem && !materialError) {
            purchaseRequestId = materialItem.purchase_request_id
            console.log('✅ purchase_request_id material_item üzerinden bulundu:', purchaseRequestId)
          } else {
            console.error('❌ material_item üzerinden purchase_request_id bulunamadı:', materialError)
          }
        }
        
        if (!purchaseRequestId) {
          console.error('❌ purchase_request_id hiçbir yoldan bulunamadı:', {
            orderId: order.id,
            orderData: order,
            materialItemId: order.material_item_id
          })
          showToast('Sipariş talep ID\'si bulunamadı. Otomatik talep oluşturulamıyor.', 'error')
        } else {
          try {
            const newRequestId = await createAutoReorderRequest(
              returnQty, 
              purchaseRequestId, 
              order.id, 
              userProfile, 
              user
            )
            if (newRequestId) {
              autoReorderCreated = true
              console.log('✅ Otomatik talep başarıyla oluşturuldu:', newRequestId)
            } else {
              console.error('❌ Otomatik talep oluşturulamadı - ID döndürülmedi')
              showToast('Otomatik talep oluşturulamadı, ancak iade işlemi tamamlandı', 'error')
            }
          } catch (error: any) {
            console.error('❌ Otomatik talep oluşturma hatası:', error)
            showToast(`Otomatik talep oluşturulamadı: ${error.message}. İade işlemi tamamlandı.`, 'error')
          }
        }
      }

      // Audit log kaydı oluştur (sadece purchase_request_id varsa)
      // purchaseRequestId'yi yukarıda bulduğumuz gibi tekrar bul
      let auditPurchaseRequestId = order.purchase_request_id
      if (!auditPurchaseRequestId && order.material_item_id) {
        const { data: materialItem } = await supabase
          .from('purchase_request_items')
          .select('purchase_request_id')
          .eq('id', order.material_item_id)
          .single()
        auditPurchaseRequestId = materialItem?.purchase_request_id
      }
      
      if (auditPurchaseRequestId) {
        const { error: auditError } = await supabase
          .from('audit_log')
          .insert({
            purchase_request_id: auditPurchaseRequestId,
            action_type: 'material_returned',
            performed_by: user.id,
            user_role: 'santiye_depo',
            description: `${materialItem?.item_name} malzemesi için ${returnQty} ${materialItem?.unit} iade edildi${photoUrls.length > 0 ? ` (${photoUrls.length} fotoğraf eklendi)` : ''}. Yeniden sipariş: ${reorderRequested ? 'İsteniyor (Otomatik talep oluşturuldu)' : 'İstenmiyor'}`,
            comments: returnNotes || null,
            metadata: {
              order_id: order.id,
              material_item_id: order.material_item_id,
              returned_quantity: returnQty,
              total_returned_quantity: newReturnedQuantity,
              supplier_name: order.suppliers?.name || order.supplier?.name,
              return_photos: photoUrls.length > 0 ? photoUrls : null,
              reorder_requested: reorderRequested,
              auto_reorder_created: reorderRequested === true
            }
          })

        if (auditError) {
          console.error('⚠️ Audit log hatası (devam ediliyor) - Detaylı:', {
            error: auditError,
            message: auditError.message,
            details: auditError.details,
            hint: auditError.hint,
            code: auditError.code
          })
        }
      } else {
        console.warn('⚠️ purchase_request_id bulunamadı, audit log kaydı oluşturulamıyor')
      }

      console.log('✅ İade işlemi tamamlandı')
      
      // Başarı mesajını duruma göre ayarla
      let successMessage = `${returnQty} ${materialItem?.unit} başarıyla iade edildi`
      
      // Eğer sipariş tamamen iade edildiyse özel mesaj
      if (isFullyReturned) {
        successMessage = `Sipariş tamamen iade edildi! (${returnQty} ${materialItem?.unit})`
      }
      
      if (reorderRequested === true) {
        if (autoReorderCreated) {
          successMessage += '. Otomatik yeniden sipariş talebi oluşturuldu.'
        } else {
          successMessage += '. Otomatik talep oluşturulamadı, manuel olarak oluşturmanız gerekebilir.'
        }
      }
      
      showToast(successMessage, 'success')
      
      // Modal'ı temizle ve kapat
      setReturnQuantity('')
      setReturnNotes('')
      setReorderRequested(null)
      // Fotoğraf preview URL'lerini temizle
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      setPhotos([])
      setPhotoPreviewUrls([])
      onSuccess()
      onClose()
      
    } catch (error: any) {
      console.error('❌ İade işlemi hatası:', error)
      showToast(error.message || 'İade işlemi başarısız', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setReturnQuantity('')
      setReturnNotes('')
      setReorderRequested(null)
      // Fotoğraf preview URL'lerini temizle
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      setPhotos([])
      setPhotoPreviewUrls([])
      onClose()
    }
  }

  if (!order || !materialItem) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto bg-white mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-900 text-base sm:text-lg">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            Malzeme İadesi
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2 sm:py-4 space-y-3 sm:space-y-4">
          {/* Uyarı Mesajı */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-red-900 mb-1">
                  İade İşlemi
                </h4>
                <p className="text-xs sm:text-sm text-red-800 break-words">
                  <strong className="break-words">{materialItem.item_name}</strong> malzemesi için iade işlemi yapılacaktır. 
                  Sadece henüz teslim alınmamış kalan miktar iade edilebilir.
                </p>
              </div>
            </div>
          </div>

          {/* Sipariş Bilgileri */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div className="sm:col-span-2">
                <span className="text-gray-500">Tedarikçi:</span>
                <div className="font-medium text-gray-900">
                  {order.suppliers?.name || order.supplier?.name || 'Bilinmeyen'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Sipariş Miktarı:</span>
                <div className="font-medium text-gray-900">
                  {orderQuantity.toFixed(2)} {materialItem.unit}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Teslim Alınan:</span>
                <div className="font-medium text-green-600">
                  {deliveredQuantity.toFixed(2)} {materialItem.unit}
                </div>
              </div>
              <div>
                <span className="text-gray-500">İade Edilen:</span>
                <div className="font-medium text-red-600">
                  {currentReturnedQuantity.toFixed(2)} {materialItem.unit}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Kalan Miktar:</span>
                <div className="font-medium text-blue-600 text-base sm:text-lg">
                  {maxReturnableQuantity.toFixed(2)} {materialItem.unit}
                </div>
              </div>
            </div>
          </div>

          {/* İade Miktarı */}
          <div className="space-y-2">
            <Label htmlFor="returnQuantity" className="text-xs sm:text-sm font-medium text-gray-700 break-words">
              İade Miktarı (Max: {maxReturnableQuantity.toFixed(2)} {materialItem.unit})
            </Label>
            <div className="flex gap-2">
              <Input
                id="returnQuantity"
                type="number"
                step="0.01"
                min="0.01"
                max={maxReturnableQuantity}
                value={returnQuantity}
                onChange={(e) => setReturnQuantity(e.target.value)}
                onWheel={(e) => e.preventDefault()}
                placeholder="Miktar"
                className="flex-1 text-sm"
                disabled={isProcessing}
              />
              <div className="flex items-center px-2 sm:px-3 bg-gray-50 rounded-md border min-w-0">
                <span className="text-xs sm:text-sm text-gray-600 truncate">{materialItem.unit}</span>
              </div>
            </div>
          </div>

          {/* İade Notları */}
          <div className="space-y-2">
            <Label htmlFor="returnNotes" className="text-xs sm:text-sm font-medium text-gray-700">
              İade Nedeni / Notlar *
            </Label>
            <Textarea
              id="returnNotes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="İade nedenini yazın..."
              className="min-h-[60px] sm:min-h-[80px] text-sm resize-none"
              disabled={isProcessing}
            />
          </div>

          {/* Yeniden Sipariş Sorusu */}
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Yeniden sipariş verilsin mi? *
            </Label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3 mb-3">
               
                <div className="min-w-0 flex-1">
                 
                  
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant={reorderRequested === true ? "default" : "outline"}
                  onClick={() => setReorderRequested(true)}
                  disabled={isProcessing}
                  className={`flex-1 h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-4 ${
                    reorderRequested === true 
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                      : 'border-green-500 text-gray-700 hover:bg-gray-100 bg-white'
                  }`}
                >
                  <span className="hidden sm:inline"> Evet, yeniden sipariş verilsin</span>
                  <span className="sm:hidden"> Evet</span>
                </Button>
                <Button
                  type="button"
                  variant={reorderRequested === false ? "default" : "outline"}
                  onClick={() => setReorderRequested(false)}
                  disabled={isProcessing}
                  className={`flex-1 h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-4 ${
                    reorderRequested === false 
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' 
                      : 'border-red-500 text-gray-700 hover:bg-gray-100 bg-white'
                  }`}
                >
                  <span className="hidden sm:inline"> Hayır, yeniden sipariş verilmesin</span>
                  <span className="sm:hidden"> Hayır</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Fotoğraf Upload Bölümü */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              İade Fotoğrafları (İsteğe bağlı - Maksimum 5 adet)
            </Label>
            
            {/* Upload Butonları */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.multiple = true
                  input.onchange = (e) => handlePhotoUpload(e as any)
                  input.click()
                }}
                disabled={isProcessing || photos.length >= 5}
                className="flex-1 h-10"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Galeri</span>
                <span className="sm:hidden">Galeriden Seç</span>
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={triggerCameraCapture}
                disabled={isProcessing || photos.length >= 5}
                className="flex-1 h-10"
              >
                <Camera className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Kamera</span>
                <span className="sm:hidden">Kamera Aç</span>
              </Button>
            </div>

            {/* Fotoğraf Önizlemeleri */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={url}
                        alt={`İade fotoğrafı ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePhoto(index)}
                      disabled={isProcessing}
                      className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 p-0 bg-red-500 hover:bg-red-600 text-white border-red-500 rounded-full"
                    >
                      <X className="w-2 h-2 sm:w-3 sm:h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  İade durumunu belgeleyen fotoğraflar ekleyebilirsiniz
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 order-2 sm:order-1 h-9 sm:h-10 text-sm"
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={handleReturn}
            disabled={
              !returnQuantity || 
              parseFloat(returnQuantity || '0') <= 0 || 
              parseFloat(returnQuantity || '0') > maxReturnableQuantity ||
              !returnNotes.trim() ||
              reorderRequested === null ||
              isProcessing
            }
            className="flex-1 bg-red-600 hover:bg-red-700 text-white order-1 sm:order-2 h-9 sm:h-10 text-sm"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                <span className="hidden sm:inline">İşleniyor...</span>
                <span className="sm:hidden">İşleniyor</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                İade Et
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Document Scanner */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScanComplete}
        maxPages={5}
        title="İade Belgesi Tara"
        description="İade belgesini kamera ile tarayın, otomatik olarak iyileştirilecektir"
      />
    </Dialog>
  )
}
