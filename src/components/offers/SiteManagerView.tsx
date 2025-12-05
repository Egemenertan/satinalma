'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Package, Edit, X } from 'lucide-react'
import { OffersPageProps } from './types'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import SitePersonnelView from './SitePersonnelView'
import { useRouter } from 'next/navigation'

interface SiteManagerViewProps extends Pick<OffersPageProps, 'request' | 'materialSuppliers' | 'materialOrders' | 'shipmentData' | 'onRefresh' | 'showToast'> {
  currentOrder: any
}

export default function SiteManagerView(props: SiteManagerViewProps) {
  const { request, onRefresh, showToast } = props
  const [siteManagerApproving, setSiteManagerApproving] = useState(false)
  const [siteManagerRejecting, setSiteManagerRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Site Manager düzenleme yetkisi kontrolü
  const canEditRequest = () => {
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

  const handleSiteManagerApproval = async () => {
    setSiteManagerApproving(true)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      // Özel site ID'si kontrolü - eğer onay_bekliyor statusundaysa 'pending' yap, değilse 'satın almaya gönderildi'
      const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
      const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
      const isAwaitingApproval = request?.status === 'onay_bekliyor'
      
      let newStatus = 'satın almaya gönderildi'
      let successMessage = 'Malzemeler satın almaya gönderildi!'
      let historyComment = 'Site Manager tarafından satın almaya gönderildi'
      
      if (isSpecialSite && isAwaitingApproval) {
        newStatus = 'pending'
        successMessage = 'Talep onaylandı!'
        historyComment = 'Site Manager tarafından onaylandı'
        console.log('🔐 Özel site için onay işlemi: onay_bekliyor → pending')
      }

      // Status güncelle
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('❌ Status güncelleme hatası:', updateError)
        throw new Error('Status güncellenemedi: ' + updateError.message)
      }

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
      console.error('❌ Site Manager onay hatası:', error)
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerApproving(false)
    }
  }

  const handleSiteManagerRejection = async () => {
    if (!rejectionReason.trim()) {
      showToast('Lütfen reddedilme nedenini belirtin', 'error')
      return
    }

    setSiteManagerRejecting(true)
    setShowRejectModal(false)
    
    try {
      console.log('🚫 Site Manager reddi başlatılıyor...', {
        requestId: request.id,
        currentStatus: request?.status,
        requestSiteId: request?.site_id,
        rejectionReason
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      // Kullanıcının profile bilgilerini al
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role, site_id, full_name')
        .eq('id', user.id)
        .single();

      console.log('✅ Kullanıcı bilgileri:', {
        userId: user.id,
        role: userProfile?.role,
        siteId: userProfile?.site_id,
        fullName: userProfile?.full_name
      })

      // Direkt update dene
      const { data: updateResult, error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'reddedildi',
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
        .select();
        
      console.log('🔍 Update sonucu:', { 
        success: !updateError, 
        updateResult, 
        error: updateError,
        errorCode: updateError?.code,
        errorMessage: updateError?.message
      });

      if (updateError) {
        console.error('❌ Update hatası:', updateError)
        
        if (updateError.message?.includes('policy') || updateError.message?.includes('permission') || updateError.code === '42501') {
          throw new Error(`Yetki hatası: Site manager rolünüz ile bu işlemi yapmaya yetkiniz yok.\n\nDetay: ${updateError.message}\n\nKullanıcı: ${userProfile?.role} | Site: ${userProfile?.site_id}`)
        }
        
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
          comments: `Site Manager tarafından reddedildi: ${rejectionReason.trim()}`
        });

      if (historyError) {
        console.error('⚠️ Approval history kaydı eklenirken hata:', historyError);
      } else {
        console.log('✅ Approval history kaydı eklendi');
      }

      console.log('✅ Status başarıyla güncellendi:', updateResult[0])
      showToast('Malzeme talebi reddedildi!', 'success')
      
      // Teams bildirimi gönder
      try {
        console.log('🔔 Teams webhook tetikleniyor...', {
          requestId: request.id,
          newStatus: 'reddedildi',
          oldStatus: request.status
        })
        
        const { handlePurchaseRequestStatusChange } = await import('../../lib/teams-webhook')
        const webhookResult = await handlePurchaseRequestStatusChange(request.id, 'reddedildi', request.status)
        
        console.log('✅ Teams webhook sonucu:', webhookResult)
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
        // Webhook hatası ana işlemi etkilemesin
      }
      
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
    } catch (error: any) {
      console.error('❌ Site Manager red hatası:', error)
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerRejecting(false)
      setRejectionReason('')
    }
  }

  // Site Manager için satın almaya gönder butonu gösterilecek durumlar
  // Özel site (18e8e316-1291-429d-a591-5cec97d235b7) için sadece onay_bekliyor statusunda göster
  const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
  const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
  
  const showApprovalButton = isSpecialSite 
    ? request?.status === 'onay_bekliyor'  // Özel site: sadece onay_bekliyor
    : (request?.status === 'kısmen gönderildi' || request?.status === 'depoda mevcut değil')  // Normal siteler

  // materialOrders'ı array formatına çevir (backward compatibility)
  const materialOrdersArray = Array.isArray(props.materialOrders) 
    ? props.materialOrders 
    : Object.values(props.materialOrders || {})

  const sitePersonnelProps = {
    ...props,
    materialOrders: materialOrdersArray,
    canEditRequest,
    handleEditRequest,
    hideDeliveryButtons: true  // Site Manager teslim alma butonlarını görmesin
  }

  // Eğer özel durum değilse SitePersonnelView'i render et
  if (!showApprovalButton) {
    return <SitePersonnelView {...sitePersonnelProps} />
  }

  return (
    <>
      {/* Site Personnel view'ini dahil et */}
      <SitePersonnelView {...sitePersonnelProps} />
      
      {/* Site Manager özel onay butonu */}
      {showApprovalButton && (
        <Card className="bg-white border-0 shadow-sm rounded-3xl">
          <CardContent className="p-4 sm:p-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">Site Manager İşlemleri</h3>
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
