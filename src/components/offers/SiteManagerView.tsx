'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { OffersPageProps } from './types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/lib/types'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import SitePersonnelView from './SitePersonnelView'

interface SiteManagerViewProps extends Pick<OffersPageProps, 'request' | 'materialSuppliers' | 'materialOrders' | 'shipmentData' | 'onRefresh' | 'showToast'> {
  currentOrder: any
}

export default function SiteManagerView(props: SiteManagerViewProps) {
  const { request, onRefresh, showToast } = props
  const [siteManagerApproving, setSiteManagerApproving] = useState(false)
  const supabase = createClientComponentClient<Database>()

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
      
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
    } catch (error: any) {
      console.error('❌ Site Manager onay hatası:', error)
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerApproving(false)
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
    materialOrders: materialOrdersArray
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Satın Almaya Gönder</h3>
              <p className="text-gray-600 mb-6">
                {request?.status === 'kısmen gönderildi' 
                  ? 'Kısmen gönderilen malzemeler için satın alma talebinde bulunabilirsiniz.'
                  : 'Depoda mevcut olmayan malzemeler için satın alma talebinde bulunabilirsiniz.'
                }
              </p>
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
          </CardContent>
        </Card>
      )}
    </>
  )
}
