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
      console.log('🚀 Site Manager onayı başlatılıyor...', {
        requestId: request.id,
        currentStatus: request?.status
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      console.log('✅ Kullanıcı oturumu doğrulandı:', user.id)

      let updateResult, error;
      
      try {
        const result = await supabase
          .from('purchase_requests')
          .update({ 
            status: 'satın almaya gönderildi',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)
          .select();
          
        updateResult = result.data;
        error = result.error;
        
        console.log('🔍 Direkt update sonucu:', { updateResult, error });

        if (!error && updateResult) {
          const { error: historyError } = await supabase
            .from('approval_history')
            .insert({
              purchase_request_id: request.id,
              action: 'approved',
              performed_by: user.id,
              comments: 'Site Manager tarafından satın almaya gönderildi'
            });

          if (historyError) {
            console.error('⚠️ Approval history kaydı eklenirken hata:', historyError);
          } else {
            console.log('✅ Approval history kaydı eklendi');
          }
        }
        
      } catch (directError) {
        console.log('⚠️ Direkt update başarısız, stored procedure deneniyor...', directError);
        
        try {
          const { data: procResult, error: procError } = await supabase
            .rpc('update_request_status_by_site_manager', {
              request_id: request.id,
              new_status: 'satın almaya gönderildi'
            });
            
          console.log('🔍 Stored procedure sonucu:', { procResult, procError });
          
          if (procError) {
            error = procError;
          } else {
            const { data: refetchedData } = await supabase
              .from('purchase_requests')
              .select('*')
              .eq('id', request.id)
              .single();
            updateResult = refetchedData ? [refetchedData] : null;
          }
        } catch (procError) {
          console.error('❌ Stored procedure de başarısız:', procError);
          error = procError;
        }
      }

      console.log('📊 Update sonucu:', { updateResult, error })

      if (error) {
        console.error('❌ Update hatası:', error)
        
        if (error.message?.includes('policy') || error.message?.includes('permission') || error.code === '42501') {
          throw new Error(`Yetki hatası: Site manager rolünüz ile bu işlemi yapmaya yetkiniz yok. Lütfen sistem yöneticinize başvurun.\n\nDetay: ${error.message}`)
        }
        
        throw error
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Status güncellendi ancak sonuç alınamadı. Sayfayı yenileyip kontrol edin.')
      }

      console.log('✅ Status başarıyla güncellendi:', updateResult[0])
      showToast('Malzemeler satın almaya gönderildi!', 'success')
      
      // Teams bildirimi gönder
      try {
        console.log('🔔 Teams webhook tetikleniyor...', {
          requestId: request.id,
          newStatus: 'satın almaya gönderildi',
          oldStatus: request.status
        })
        
        const { handlePurchaseRequestStatusChange } = await import('../../lib/teams-webhook')
        const webhookResult = await handlePurchaseRequestStatusChange(request.id, 'satın almaya gönderildi', request.status)
        
        console.log('✅ Teams webhook sonucu:', webhookResult)
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
        // Webhook hatası ana işlemi etkilemesin
      }
      
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
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
        rejectionReason
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      console.log('✅ Kullanıcı oturumu doğrulandı:', user.id)

      let updateResult, error;
      
      try {
        const result = await supabase
          .from('purchase_requests')
          .update({ 
            status: 'reddedildi',
            rejection_reason: rejectionReason.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)
          .select();
          
        updateResult = result.data;
        error = result.error;
        
        console.log('🔍 Direkt update sonucu:', { updateResult, error });

        if (!error && updateResult) {
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
        }
        
      } catch (directError) {
        console.log('⚠️ Direkt update başarısız, stored procedure deneniyor...', directError);
        
        try {
          const { data: procResult, error: procError } = await supabase
            .rpc('update_request_status_by_site_manager', {
              request_id: request.id,
              new_status: 'reddedildi'
            });
            
          console.log('🔍 Stored procedure sonucu:', { procResult, procError });
          
          if (procError) {
            error = procError;
          } else {
            // Stored procedure kullanıldıysa rejection_reason'ı ayrıca güncelle
            const { error: reasonError } = await supabase
              .from('purchase_requests')
              .update({ rejection_reason: rejectionReason.trim() })
              .eq('id', request.id);
              
            if (reasonError) {
              console.error('⚠️ Rejection reason güncellenirken hata:', reasonError);
            }

            const { data: refetchedData } = await supabase
              .from('purchase_requests')
              .select('*')
              .eq('id', request.id)
              .single();
            updateResult = refetchedData ? [refetchedData] : null;
          }
        } catch (procError) {
          console.error('❌ Stored procedure de başarısız:', procError);
          error = procError;
        }
      }

      console.log('📊 Update sonucu:', { updateResult, error })

      if (error) {
        console.error('❌ Update hatası:', error)
        
        if (error.message?.includes('policy') || error.message?.includes('permission') || error.code === '42501') {
          throw new Error(`Yetki hatası: Site manager rolünüz ile bu işlemi yapmaya yetkiniz yok. Lütfen sistem yöneticinize başvurun.\n\nDetay: ${error.message}`)
        }
        
        throw error
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Status güncellendi ancak sonuç alınamadı. Sayfayı yenileyip kontrol edin.')
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
  const showApprovalButton = request?.status === 'kısmen gönderildi' || request?.status === 'depoda mevcut değil'

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
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Site Manager İşlemleri</h3>
              <p className="text-gray-600 mb-6">
                {request?.status === 'kısmen gönderildi' 
                  ? 'Kısmen gönderilen malzemeler için talep düzenleyebilir veya satın alma talebinde bulunabilirsiniz.'
                  : 'Depoda mevcut olmayan malzemeler için talep düzenleyebilir veya satın alma talebinde bulunabilirsiniz.'
                }
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* Edit Butonu */}
                {canEditRequest() && (
                  <Button
                    onClick={handleEditRequest}
                    variant="outline"
                    className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-6 py-3 text-lg"
                  >
                    <Edit className="h-5 w-5" />
                    Talebi Düzenle
                  </Button>
                )}
                
                {/* Reddet Butonu */}
                <Button
                  onClick={handleRejectClick}
                  disabled={siteManagerRejecting}
                  variant="outline"
                  className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50 px-6 py-3 text-lg"
                >
                  {siteManagerRejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600 mr-2"></div>
                      Reddediliyor...
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5" />
                      Reddet
                    </>
                  )}
                </Button>
                
                {/* Satın Almaya Gönder Butonu */}
                <Button
                  onClick={handleSiteManagerApproval}
                  disabled={siteManagerApproving}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-medium"
                >
                  {siteManagerApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Gönderiliyor...
                    </>
                  ) : (
                    'Satın Almaya Gönder'
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
