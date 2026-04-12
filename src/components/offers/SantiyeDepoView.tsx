'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Truck, Trash2, FileText, Edit, X } from 'lucide-react'
import { OffersPageProps } from './types'
import DeliveryConfirmationModal from '@/components/DeliveryConfirmationModal'
import PartialDeliveryModal from '@/components/PartialDeliveryModal'
import ReturnModal from '@/components/ReturnModal'
import RequestPDFExportModal from '@/components/RequestPDFExportModal'
import MaterialCard from './MaterialCard'
import WarehouseManagerMaterialCard from './WarehouseManagerMaterialCard'
import StatusSummary from './StatusSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import { useRouter } from 'next/navigation'

interface SantiyeDepoViewProps extends Pick<OffersPageProps, 'request' | 'materialSuppliers' | 'shipmentData' | 'onRefresh' | 'showToast'> {
  materialOrders: any[]
  currentOrder: any
}

export default function SantiyeDepoView({ 
  request, 
  materialSuppliers, 
  materialOrders, 
  shipmentData, 
  currentOrder,
  onRefresh, 
  showToast 
}: SantiyeDepoViewProps) {
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [selectedMaterialForDelivery, setSelectedMaterialForDelivery] = useState<any>(null)
  const [isPartialDeliveryModalOpen, setIsPartialDeliveryModalOpen] = useState(false)
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<any>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null)
  
  // Malzeme silme onayı için state'ler
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any>(null)
  
  // PDF export modal state
  const [showPDFExportModal, setShowPDFExportModal] = useState(false)
  
  // User site check
  const [userSiteId, setUserSiteId] = useState<string | null>(null)
  const [isGenelMerkezUser, setIsGenelMerkezUser] = useState(false)
  const [genelMerkezSiteId, setGenelMerkezSiteId] = useState<string | null>(null)
  
  // Site Manager approval states
  const [siteManagerApproving, setSiteManagerApproving] = useState(false)
  const [siteManagerRejecting, setSiteManagerRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  
  // Product stock information
  const [productStocks, setProductStocks] = useState<{[itemId: string]: {
    totalAvailable: number
    warehouses: Array<{
      name: string
      quantity: number
      conditionBreakdown?: {
        yeni?: number
        kullanılmış?: number
        hek?: number
        arızalı?: number
      }
    }>
  }}>({})
  
  const supabase = createClient()
  const router = useRouter()

  // Fetch product stock information for items that have product_id
  useEffect(() => {
    const fetchProductStocks = async () => {
      if (!request?.purchase_request_items) return
      
      // Only fetch for warehouse_manager role
      if (userRole !== 'warehouse_manager') return
      
      try {
        const stocks: {[itemId: string]: {
          totalAvailable: number
          warehouses: Array<{
            name: string
            quantity: number
            conditionBreakdown?: {
              yeni?: number
              kullanılmış?: number
              hek?: number
              arızalı?: number
            }
          }>
        }} = {}
        
        for (const item of request.purchase_request_items) {
          if ((item as any).product_id) {
            console.log(`🔍 ${item.item_name} için stok sorgulanıyor... (product_id: ${(item as any).product_id})`)
            
            // Fetch all stock records for this product from all warehouses (only unassigned stock)
            const { data: stockData, error } = await supabase
              .from('warehouse_stock')
              .select(`
                quantity,
                condition_breakdown,
                warehouse:sites(name)
              `)
              .eq('product_id', (item as any).product_id)
              .is('user_id', null)
            
            if (error) {
              console.error(`❌ ${item.item_name} stok sorgusu hatası:`, error)
              continue
            }
            
            if (!stockData || stockData.length === 0) {
              console.log(`⚠️ ${item.item_name} için stok kaydı bulunamadı`)
              continue
            }
            
            // Prepare warehouse details with condition breakdown
            const warehouses = stockData
              .filter((s: any) => s.warehouse?.name)
              .map((s: any) => {
                const breakdown = (s.condition_breakdown as any) || {}
                const yeni = parseFloat(breakdown.yeni?.toString() || '0') || 0
                const kullanilmis = parseFloat(breakdown.kullanılmış?.toString() || '0') || 0
                const hek = parseFloat(breakdown.hek?.toString() || '0') || 0
                const arizali = parseFloat(breakdown.arızalı?.toString() || '0') || 0
                
                // Condition breakdown toplamı ile quantity alanından büyük olanı kullan
                const breakdownTotal = yeni + kullanilmis + hek + arizali
                const quantityValue = parseFloat(s.quantity?.toString() || '0') || 0
                const effectiveQuantity = Math.max(breakdownTotal, quantityValue)
                
                return {
                  name: s.warehouse.name,
                  quantity: effectiveQuantity,
                  conditionBreakdown: {
                    yeni: yeni,
                    kullanılmış: kullanilmis,
                    hek: hek,
                    arızalı: arizali,
                  }
                }
              })
              .sort((a, b) => b.quantity - a.quantity) // En çok stok olanlar üstte
            
            // Calculate total stock across all warehouses (condition breakdown toplamlarından)
            const totalQuantity = warehouses.reduce((sum, wh) => {
              return sum + wh.quantity
            }, 0)
            
            stocks[item.id] = {
              totalAvailable: totalQuantity,
              warehouses: warehouses
            }
            
            console.log(`✅ ${item.item_name} stok bilgisi:`)
            console.log(`   📊 Toplam: ${totalQuantity} ${item.unit || 'adet'}`)
            warehouses.forEach(w => {
              console.log(`   └─ ${w.name}: ${w.quantity} ${item.unit || 'adet'}`)
              if (w.conditionBreakdown) {
                console.log(`      • Yeni: ${w.conditionBreakdown.yeni}, Kullanılmış: ${w.conditionBreakdown.kullanılmış}, HEK: ${w.conditionBreakdown.hek}`)
              }
            })
          } else {
            console.log(`⚠️ ${item.item_name} için product_id yok, stok sorgulanamıyor`)
          }
        }
        
        setProductStocks(stocks)
        console.log(`📦 Toplam ${Object.keys(stocks).length} ürün için stok bilgisi yüklendi`)
      } catch (error) {
        console.error('❌ Stok bilgisi alınamadı:', error)
      }
    }
    
    fetchProductStocks()
  }, [request, userRole, supabase])

  // Check if user is from "Genel Merkez Ofisi" site and get user role
  useEffect(() => {
    const checkUserSite = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.log('❌ Kullanıcı bulunamadı')
          return
        }

        console.log('👤 Kullanıcı ID:', user.id)

        // Get user profile with site_id and role
        const { data: profile } = await supabase
          .from('profiles')
          .select('site_id, role')
          .eq('id', user.id)
          .single()

        console.log('📋 Kullanıcı profili:', profile)

        // Kullanıcı rolünü kaydet
        if (profile?.role) {
          setUserRole(profile.role)
          console.log('🔐 Kullanıcı rolü:', profile.role)
        }

        if (profile?.site_id && profile.site_id.length > 0) {
          const firstSiteId = profile.site_id[0]
          setUserSiteId(firstSiteId)
          console.log('🏢 Kullanıcı site ID:', firstSiteId)

          // Get "Genel Merkez Ofisi" site ID
          const { data: genelMerkezSite } = await supabase
            .from('sites')
            .select('id')
            .eq('name', 'Genel Merkez Ofisi')
            .single()

          console.log('🏢 Genel Merkez Ofisi site:', genelMerkezSite)

          if (genelMerkezSite) {
            setGenelMerkezSiteId(genelMerkezSite.id)
            const isGenel = firstSiteId === genelMerkezSite.id
            setIsGenelMerkezUser(isGenel)
            console.log('✅ Site kontrolü tamamlandı:', {
              userSiteId: firstSiteId,
              genelMerkezSiteId: genelMerkezSite.id,
              isGenelMerkezUser: isGenel
            })
          }
        } else {
          console.log('⚠️ Kullanıcının site_id bilgisi yok')
        }
      } catch (error) {
        console.error('❌ User site check error:', error)
      }
    }

    checkUserSite()
  }, [])

  // Takip sistemi gösterilmeli mi kontrolü
  const shouldShowTrackingSystem = () => {
    return request?.status === 'sipariş verildi' || 
           request?.status === 'teslim alındı' || 
           request?.status === 'kısmen teslim alındı' ||
           request?.status === 'iade var'
  }

  // PDF export butonu gösterilmeli mi?
  const shouldShowPDFExportButton = () => {
    const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
    
    // Özel site için: pending, kısmen gönderildi ve sipariş verildi statuslarında göster
    if (isSpecialSite) {
      return request?.status === 'pending' || 
             request?.status === 'kısmen gönderildi' ||
             request?.status === 'sipariş verildi'
    }
    
    // Genel Merkez Ofisi için: pending ve kısmen gönderildi
    return isGenelMerkezUser && (
      request?.status === 'pending' || 
      request?.status === 'kısmen gönderildi'
    )
  }

  // İade nedeniyle sipariş durumunda mı?
  const isReturnReorderStatus = () => {
    return request?.status === 'iade nedeniyle sipariş'
  }

  // Santiye depo yöneticisi kontrolü - rol bazlı
  const isSantiyeDepoYonetici = userRole === 'santiye_depo_yonetici'
  
  // Site Manager düzenleme yetkisi kontrolü (santiye_depo_yonetici rolü için)
  const canEditRequest = () => {
    if (!isSantiyeDepoYonetici) return false
    return request?.status === 'kısmen gönderildi' || request?.status === 'depoda mevcut değil'
  }

  // Edit sayfasına yönlendir
  const handleEditRequest = () => {
    router.push(`/dashboard/requests/${request.id}/edit`)
  }

  // Reddet modalını aç
  const handleRejectClick = () => {
    setRejectionReason('')
    setShowRejectModal(true)
  }

  // Site Manager onay fonksiyonu
  const handleSiteManagerApproval = async () => {
    setSiteManagerApproving(true)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      // Ana depoda stok kontrolü yap
      console.log('🔍 Ana depoda stok kontrolü yapılıyor...')
      const { data: stockCheckData, error: stockCheckError } = await supabase
        .rpc('check_main_warehouse_stock', { request_id_param: request.id })
      
      if (stockCheckError) {
        console.error('❌ Stok kontrolü hatası:', stockCheckError)
        throw new Error('Stok kontrolü yapılamadı: ' + stockCheckError.message)
      }

      // Tüm ürünlerin stokta olup olmadığını kontrol et
      const allItemsInStock = stockCheckData && stockCheckData.length > 0 
        ? stockCheckData.every((item: any) => item.has_stock === true)
        : false

      console.log('📊 Stok Kontrol Sonucu:', {
        totalItems: stockCheckData?.length || 0,
        allItemsInStock,
        details: stockCheckData
      })

      // Özel site ID'si kontrolü
      const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
      const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
      const isAwaitingApproval = request?.status === 'onay_bekliyor'
      
      console.log('🔍 Şantiye Depo Yöneticisi Onay - Durum Analizi:', {
        currentStatus: request?.status,
        siteId: request?.site_id,
        isSpecialSite,
        isAwaitingApproval,
        allItemsInStock
      })
      
      let newStatus = 'satın almaya gönderildi'
      let successMessage = 'Malzemeler satın almaya gönderildi!'
      let historyComment = 'Şantiye Depo Yöneticisi tarafından satın almaya gönderildi'
      
      // Genel Merkez Ofisi için stok kontrolü yaparak karar ver
      if (isSpecialSite && isAwaitingApproval) {
        // Özel site (Genel Merkez Ofisi) için stok kontrolüne göre karar ver
        if (allItemsInStock) {
          newStatus = 'onaylandı'
          successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
          historyComment = 'Şantiye Depo Yöneticisi tarafından onaylandı (Ana depoda stok mevcut)'
          console.log('🔐 Genel Merkez Ofisi - Ana depoda stok mevcut, status: onaylandı')
        } else {
          // Ana depoda stok yoksa direkt satın almaya gönderildi
          newStatus = 'satın almaya gönderildi'
          successMessage = 'Malzemeler satın almaya gönderildi! (Ana depoda stok yok)'
          historyComment = 'Şantiye Depo Yöneticisi tarafından satın almaya gönderildi (Genel Merkez Ofisi - Ana depoda stok yok)'
          console.log('🔐 Genel Merkez Ofisi - Ana depoda stok yok, direkt satın almaya gönderiliyor')
        }
      } else {
        // Normal durum (diğer siteler): Stok kontrolüne göre karar ver
        if (allItemsInStock) {
          newStatus = 'onaylandı'
          successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
          historyComment = 'Şantiye Depo Yöneticisi tarafından onaylandı (Ana depoda stok mevcut)'
          console.log('✅ Ana depoda stok mevcut, status: onaylandı')
        } else {
          // Stok yoksa direkt satın almaya gönderildi
          newStatus = 'satın almaya gönderildi'
          successMessage = 'Malzemeler satın almaya gönderildi! (Ana depoda stok yok)'
          historyComment = 'Şantiye Depo Yöneticisi tarafından satın almaya gönderildi (Ana depoda stok yok)'
          console.log('⚠️ Ana depoda stok yok, direkt satın almaya gönderiliyor')
        }
      }

      // Status güncelle
      console.log('💾 Status güncelleme işlemi başlatılıyor:', {
        requestId: request.id,
        oldStatus: request?.status,
        newStatus: newStatus
      })
      
      const { error: updateError, data: updateData } = await supabase
        .from('purchase_requests')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
        .select()

      if (updateError) {
        console.error('❌ Status güncelleme hatası:', updateError)
        throw new Error('Status güncellenemedi: ' + updateError.message)
      }
      
      console.log('✅ Status başarıyla güncellendi:', {
        requestId: request.id,
        newStatus: updateData?.[0]?.status,
        updateResult: updateData
      })

      // Approval history ekle
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: request.id,
          action: 'approved',
          performed_by: user.id,
          comments: historyComment
        });

      if (historyError) {
        console.error('⚠️ Approval history hatası:', historyError);
      }
      
      // Teams bildirimi gönder (arka planda, hata olsa bile devam et)
      try {
        const { handlePurchaseRequestStatusChange } = await import('../../lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, newStatus, request.status)
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
      }
      
      // Cache'i temizle ve sayfayı yenile
      invalidatePurchaseRequestsCache()
      await onRefresh()
      
      // Başarı mesajını göster
      showToast(successMessage, 'success')
      
    } catch (error: any) {
      console.error('❌ Onay hatası:', error)
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerApproving(false)
    }
  }

  // Site Manager red fonksiyonu
  const handleSiteManagerRejection = async () => {
    if (!rejectionReason.trim()) {
      showToast('Lütfen reddedilme nedenini belirtin', 'error')
      return
    }

    setSiteManagerRejecting(true)
    setShowRejectModal(false)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      // Status güncelle
      const { data: updateResult, error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'reddedildi',
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
        .select();

      if (updateError) {
        console.error('❌ Update hatası:', updateError)
        throw updateError
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Status güncellendi ancak sonuç alınamadı. Sayfayı yenileyip kontrol edin.')
      }

      // Approval history ekle
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: request.id,
          action: 'rejected',
          performed_by: user.id,
          comments: `Şantiye Depo Yöneticisi tarafından reddedildi: ${rejectionReason.trim()}`
        });

      if (historyError) {
        console.error('⚠️ Approval history kaydı eklenirken hata:', historyError);
      }

      showToast('Malzeme talebi reddedildi!', 'success')
      
      // Teams bildirimi gönder
      try {
        const { handlePurchaseRequestStatusChange } = await import('../../lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, 'reddedildi', request.status)
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
      }
      
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
    } catch (error: any) {
      console.error('❌ Red hatası:', error)
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerRejecting(false)
      setRejectionReason('')
    }
  }

  // Site Manager için onay butonu gösterilecek durumlar (santiye_depo_yonetici rolü için)
  const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
  const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
  
  const showApprovalButton = isSantiyeDepoYonetici && (
    isSpecialSite 
      ? request?.status === 'onay_bekliyor'  // Özel site: sadece onay_bekliyor
      : (request?.status === 'kısmen gönderildi' || request?.status === 'depoda mevcut değil')  // Normal siteler
  )

  // Malzeme teslimat onayı fonksiyonu (eski shipment sistemi için)
  const handleMaterialDeliveryConfirmation = (item: any) => {
    console.log('🚚 Teslimat modalı açılıyor:', {
      itemId: item.id,
      itemName: item.item_name,
      materialOrdersForItem: materialOrders.filter((order: any) => 
        order.material_item_id === item.id
      ).map(order => ({
        orderId: order.id,
        isDelivered: order.is_delivered,
        quantity: order.quantity,
        supplier: order.supplier?.name || 'Unknown'
      }))
    })
    
    setSelectedMaterialForDelivery(item)
    setIsDeliveryModalOpen(true)
  }

  // Sipariş bazlı kademeli teslim alma fonksiyonu
  const handleOrderDeliveryConfirmation = (order: any, materialItem: any, isEditMode: boolean = false) => {
    console.log('📦 Kademeli teslim alma modalı açılıyor:', {
      orderId: order.id,
      orderQuantity: order.quantity,
      materialName: materialItem.item_name,
      supplierName: order.suppliers?.name || order.supplier?.name,
      isEditMode
    })
    
    setSelectedOrderForDelivery({
      ...order,
      materialItem: materialItem,
      isEditMode // Edit mode flag'i ekle
    })
    setIsPartialDeliveryModalOpen(true)
  }

  // İade işlemi fonksiyonu
  const handleOrderReturn = (order: any, materialItem: any) => {
    console.log('🔄 İade modalı açılıyor:', {
      orderId: order.id,
      orderQuantity: order.quantity,
      returnedQuantity: order.returned_quantity || 0,
      materialName: materialItem.item_name,
      supplierName: order.suppliers?.name || order.supplier?.name
    })
    
    setSelectedOrderForReturn({
      ...order,
      materialItem: materialItem
    })
    setIsReturnModalOpen(true)
  }

  // Malzeme kaldırma yetkisi kontrolü
  const canRemoveMaterial = () => {
    // Santiye Depo için: sipariş verildi, teslim alındı ve sonrası durumlarda kaldırma yapılamaz
    // Kısmen gönderildi ve depoda mevcut değil durumlarında kaldırma yapılabilir
    const restrictedStatuses = ['sipariş verildi', 'teslim alındı', 'kısmen teslim alındı', 'gönderildi', 'iade var']
    return !restrictedStatuses.includes(request?.status)
  }

  // Malzeme kaldırma onayı başlat
  const handleRemoveMaterial = (itemId: string) => {
    const materialItem = request?.purchase_request_items?.find((item: any) => item.id === itemId)
    if (materialItem) {
      setMaterialToDelete(materialItem)
      setShowDeleteConfirmModal(true)
    }
  }

  // Malzeme kaldırma onayı
  const confirmRemoveMaterial = async () => {
    if (!materialToDelete) return
    
    try {
      // En az 1 malzeme kalmalı
      if (request?.purchase_request_items?.length <= 1) {
        showToast('En az bir malzeme bulunmalıdır', 'error')
        setShowDeleteConfirmModal(false)
        setMaterialToDelete(null)
        return
      }

      // Malzemeyi veritabanından sil
      const { error } = await supabase
        .from('purchase_request_items')
        .delete()
        .eq('id', materialToDelete.id)

      if (error) {
        throw new Error(error.message)
      }

      showToast('Malzeme talepten kaldırıldı', 'success')
      onRefresh() // Sayfayı yenile
      
    } catch (error) {
      console.error('Malzeme kaldırma hatası:', error)
      showToast('Malzeme kaldırılırken hata oluştu', 'error')
    } finally {
      setShowDeleteConfirmModal(false)
      setMaterialToDelete(null)
    }
  }

  // Malzeme kaldırma iptal
  const cancelRemoveMaterial = () => {
    setShowDeleteConfirmModal(false)
    setMaterialToDelete(null)
  }

  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  return (
    <>
    <Card className="bg-white border-0 shadow-sm rounded-3xl">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex items-start gap-2 sm:gap-3 flex-1">
            <div>
              <CardTitle className="text-base sm:text-xl font-semibold text-gray-900">
                {isReturnReorderStatus()
                  ? 'İade Nedeniyle Yeniden Sipariş'
                  : shouldShowTrackingSystem()
                    ? 'Malzeme Takip Sistemi' 
                    : 'Depo İşlemleri'
                }
              </CardTitle>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {isReturnReorderStatus()
                  ? 'Bu talep iade nedeniyle oluşturulmuştur. Gönderim işlemleri devre dışıdır ve sadece görüntüleme yapabilirsiniz.'
                  : shouldShowTrackingSystem()
                    ? 'Her malzeme için talep, gönderim ve teslimat durumu. İade sebepli yeni siparişler mor renkle işaretlenmiştir.'
                    : 'Talep edilen malzemeleri kontrol edin ve gönderim yapın'
                }
              </p>
            </div>
          </div>

          {/* PDF Export Button - Only for Genel Merkez Ofisi users on pending requests */}
          {shouldShowPDFExportButton() && (
            <Button
              onClick={() => setShowPDFExportModal(true)}
              className="bg-gray-900 rounded-xl hover:bg-gray-800 text-white h-9 px-3 text-sm w-full sm:w-auto"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Talep PDF'i
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="space-y-3 sm:space-y-4">
            {request.purchase_request_items.map((item, index) => {
              // Her malzeme için gönderim durumunu kontrol et
              const itemShipments = shipmentData[item.id]
              const totalShipped = itemShipments?.total_shipped || 0
              const isDepotUnavailable = itemShipments?.shipments?.some(s => s.shipped_quantity === 0) || false
              const isPartiallyShipped = totalShipped > 0 && item.quantity > 0
              const isFullyShipped = totalShipped > 0 && item.quantity <= 0
              
              // Bu malzeme için düzenle/kaldır butonları gizlenmeli mi?
              const shouldHideButtons = isDepotUnavailable || isPartiallyShipped || isFullyShipped
              
              // Warehouse manager için özel kart göster
              if (userRole === 'warehouse_manager') {
                return (
                  <WarehouseManagerMaterialCard
                    key={item.id}
                    item={item}
                    index={index}
                    request={request}
                    shipmentData={shipmentData}
                    onRefresh={onRefresh}
                    showToast={showToast}
                    totalItems={request.purchase_request_items.length}
                    productStock={productStocks[item.id]}
                    onPDFExport={() => setShowPDFExportModal(true)}
                  />
                )
              }
              
              return (
                <MaterialCard
                  key={item.id}
                  item={item}
                  index={index}
                  request={request}
                  materialOrders={materialOrders}
                  shipmentData={shipmentData}
                  onRefresh={onRefresh}
                  showToast={showToast}
                  onMaterialDeliveryConfirmation={handleMaterialDeliveryConfirmation}
                  totalItems={request.purchase_request_items.length}
                  onRemoveMaterial={shouldHideButtons ? undefined : handleRemoveMaterial}
                  canRemoveMaterial={shouldHideButtons ? false : canRemoveMaterial()}
                  canEditRequest={shouldHideButtons ? false : canEditRequest()}
                  onOrderDeliveryConfirmation={handleOrderDeliveryConfirmation}
                  onOrderReturn={handleOrderReturn}
                  hideTopDeliveryButtons={true}  // Sağ üstteki teslim alma butonlarını gizle
                  productStock={productStocks[item.id]}  // Stok bilgisini ekle
                  onShipmentSuccess={() => {
                    // Gönderim başarılı olduğunda PDF export modalını aç (sadece Genel Merkez Ofisi kullanıcıları için)
                    console.log('🎯 Gönderim başarılı callback tetiklendi:', {
                      isGenelMerkezUser,
                      userSiteId,
                      genelMerkezSiteId,
                      willOpenModal: isGenelMerkezUser
                    })
                    
                    if (isGenelMerkezUser) {
                      console.log('✅ PDF Export modalı açılıyor...')
                      setShowPDFExportModal(true)
                    } else {
                      console.log('❌ Kullanıcı Genel Merkez Ofisi\'nden değil, modal açılmıyor')
                    }
                  }}
                />
              )
            })}
        </div>

        {/* Genel Durum Özeti */}
          <StatusSummary 
            request={request} 
            shipmentData={shipmentData} 
          />
      </CardContent>
    </Card>

    {/* Malzeme Silme Onay Modalı */}
    <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-900">
            <Trash2 className="w-5 h-5 text-red-600" />
            Malzemeyi Kaldır
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-red-50 border border-red-200 rounded-3xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-900 mb-1">
                  Malzeme Silinecek
                </h4>
                {materialToDelete && (
                  <p className="text-sm text-red-800">
                    "<strong>{materialToDelete.item_name}</strong>" 
                    malzemesi talepten tamamen kaldırılacaktır.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Bu işlem geri alınamaz. Malzemeyi kaldırmak istediğinizden emin misiniz?
          </p>
          
         
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={cancelRemoveMaterial}
            className="flex-1"
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={confirmRemoveMaterial}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Kaldır
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Teslimat Onayı Modalı - Eski sistem (shipment tablosu için) */}
    <DeliveryConfirmationModal
      isOpen={isDeliveryModalOpen}
      onClose={() => {
        setIsDeliveryModalOpen(false)
        setSelectedMaterialForDelivery(null)
      }}
      materialItem={selectedMaterialForDelivery}
      materialOrders={selectedMaterialForDelivery ? materialOrders.filter((order: any) => 
        order.material_item_id === selectedMaterialForDelivery.id
      ) : []}
      shipmentData={shipmentData}
      onSuccess={() => {
        onRefresh()
        setSelectedMaterialForDelivery(null)
      }}
      showToast={showToast}
      requestId={request?.id}
    />

    {/* Kademeli Teslim Alma Modalı - Yeni sistem (order_deliveries tablosu için) */}
    <PartialDeliveryModal
      isOpen={isPartialDeliveryModalOpen}
      onClose={() => {
        setIsPartialDeliveryModalOpen(false)
        setSelectedOrderForDelivery(null)
      }}
      order={selectedOrderForDelivery}
      materialItem={selectedOrderForDelivery?.materialItem}
      onSuccess={async () => {
        onRefresh()
        setSelectedOrderForDelivery(null)
        
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
          
          console.log('✅ SantiyeDepoView cache temizlendi')
        } catch (error) {
          console.error('Cache temizleme hatası:', error)
        }
      }}
      showToast={showToast}
    />

    {/* İade Modalı */}
    <ReturnModal
      isOpen={isReturnModalOpen}
      onClose={() => {
        setIsReturnModalOpen(false)
        setSelectedOrderForReturn(null)
      }}
      order={selectedOrderForReturn}
      materialItem={selectedOrderForReturn?.materialItem}
      onSuccess={async () => {
        onRefresh()
        setSelectedOrderForReturn(null)
        
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
          
          console.log('✅ SantiyeDepoView cache temizlendi (iade sonrası)')
        } catch (error) {
          console.error('Cache temizleme hatası:', error)
        }
      }}
      showToast={showToast}
    />

    {/* PDF Export Modal */}
    <RequestPDFExportModal
      isOpen={showPDFExportModal}
      onClose={() => setShowPDFExportModal(false)}
      request={request}
      showToast={showToast}
    />

    {/* Site Manager Onay Butonu - Sadece santiye_depo_yonetici rolü için */}
    {showApprovalButton && (
      <Card className="bg-white border-0 shadow-sm rounded-3xl">
        <CardContent className="p-4 sm:p-8">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">Onay İşlemleri</h3>
            <p className="text-xs sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
              {request?.status === 'onay_bekliyor'
                ? 'Bu talep onayınızı bekliyor. Onaylayarak talebi ilerletebilir veya reddedebilirsiniz.'
                : request?.status === 'kısmen gönderildi' 
                  ? 'Kısmen gönderilen malzemeler için talep düzenleyebilir veya satın alma talebinde bulunabilirsiniz.'
                  : 'Depoda mevcut olmayan malzemeler için talep düzenleyebilir veya satın alma talebinde bulunabilirsiniz.'
              }
            </p>
            
            <div className="flex flex-col gap-2 sm:gap-3">
              {/* Edit Butonu */}
              {canEditRequest() && (
                <Button
                  onClick={handleEditRequest}
                  variant="outline"
                  className="flex items-center justify-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg rounded-xl w-full"
                >
                  <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                  Talebi Düzenle
                </Button>
              )}
              
              {/* Reddet Butonu */}
              <Button
                onClick={handleRejectClick}
                disabled={siteManagerRejecting}
                variant="outline"
                className="flex items-center justify-center gap-2 border-red-300 text-red-700 hover:bg-red-50 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg rounded-xl w-full"
              >
                {siteManagerRejecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-red-600"></div>
                    <span>Reddediliyor...</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Reddet</span>
                  </>
                )}
              </Button>
              
              {/* Satın Almaya Gönder / Onayla Butonu */}
              <Button
                onClick={handleSiteManagerApproval}
                disabled={siteManagerApproving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-xl text-sm sm:text-lg font-medium w-full"
              >
                {siteManagerApproving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                    <span>{request?.status === 'onay_bekliyor' ? 'Onaylanıyor...' : 'Gönderiliyor...'}</span>
                  </>
                ) : (
                  <span>{request?.status === 'onay_bekliyor' ? 'Onayla' : 'Satın Almaya Gönder'}</span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Reddet Modal */}
    <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Talebi Reddet
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Bu talebi reddetmek istediğinizden emin misiniz? Lütfen reddedilme nedenini belirtin.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason" className="text-sm font-medium text-gray-700">
              Reddedilme Nedeni <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Talebin neden reddedildiğini açıklayın..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px] resize-none border-gray-200 focus:border-gray-400 focus:ring-gray-400/20"
              maxLength={500}
            />
            <div className="text-xs text-gray-400 text-right">
              {rejectionReason.length}/500 karakter
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowRejectModal(false)
              setRejectionReason('')
            }}
            className="w-full sm:w-auto border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            İptal
          </Button>
          <Button
            onClick={handleSiteManagerRejection}
            disabled={!rejectionReason.trim() || siteManagerRejecting}
            className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white"
          >
            {siteManagerRejecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reddediliyor...
              </>
            ) : (
              'Talebi Reddet'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
