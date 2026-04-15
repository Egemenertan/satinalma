'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import { OffersPageProps } from './types'

interface DepartmentHeadViewProps extends Pick<OffersPageProps, 'request' | 'onRefresh' | 'showToast'> {}

export default function DepartmentHeadView({ request, onRefresh, showToast }: DepartmentHeadViewProps) {
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [userDepartment, setUserDepartment] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const supabase = createClient()

  // Kullanıcının departmanını ve yetki kontrolünü yap
  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsAuthorized(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('department, role, site_id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          setIsAuthorized(false)
          return
        }

        const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
        const userDept = profile.department || 'Genel'
        const requestDept = request.department || 'Genel'
        
        setUserDepartment(userDept)

        // Yetki kontrolü: Aynı departman + GMO sitesi + department_head rolü
        const isAuth = 
          profile.role === 'department_head' &&
          profile.site_id?.includes(GMO_SITE_ID) &&
          request.site_id === GMO_SITE_ID &&
          userDept === requestDept

        setIsAuthorized(isAuth)

        if (!isAuth) {
          console.log('⚠️ Yetki kontrolü başarısız:', {
            userRole: profile.role,
            userDept,
            requestDept,
            requestSite: request.site_id
          })
        }
      } catch (error) {
        console.error('❌ Yetki kontrolü hatası:', error)
        setIsAuthorized(false)
      }
    }

    checkAuthorization()
  }, [request, supabase])

  // Onay işlemi
  const handleApproval = async () => {
    setApproving(true)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      // Status güncelle: departman_onayı_bekliyor → pending
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) {
        throw new Error(`Status güncellenemedi: ${updateError.message}`)
      }

      // Approval history ekle
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: request.id,
          action: 'approved',
          performed_by: user.id,
          comments: `Departman Yöneticisi tarafından onaylandı (${userDepartment} departmanı)`
        })

      if (historyError) {
        console.error('⚠️ Approval history hatası:', historyError)
      }

      // Teams bildirimi (arka planda)
      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, 'pending', 'departman_onayı_bekliyor')
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
      }

      invalidatePurchaseRequestsCache()
      await onRefresh()
      showToast('Talep onaylandı ve warehouse manager\'a gönderildi!', 'success')
      
    } catch (error: any) {
      console.error('❌ Onay hatası:', error)
      showToast('Hata: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setApproving(false)
    }
  }

  // Reddetme işlemi
  const handleRejection = async () => {
    if (!rejectionReason.trim()) {
      showToast('Lütfen reddedilme nedenini belirtin', 'error')
      return
    }

    setRejecting(true)
    setShowRejectModal(false)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      // Status güncelle: departman_onayı_bekliyor → reddedildi
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'reddedildi',
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) {
        throw new Error(`Status güncellenemedi: ${updateError.message}`)
      }

      // Approval history ekle
      await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: request.id,
          action: 'rejected',
          performed_by: user.id,
          comments: `Departman Yöneticisi tarafından reddedildi (${userDepartment}): ${rejectionReason.trim()}`
        })

      // Teams bildirimi
      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, 'reddedildi', 'departman_onayı_bekliyor')
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
      }

      invalidatePurchaseRequestsCache()
      await onRefresh()
      showToast('Talep reddedildi!', 'success')
      
    } catch (error: any) {
      console.error('❌ Reddetme hatası:', error)
      showToast('Hata: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setRejecting(false)
      setRejectionReason('')
    }
  }

  // Yetki yoksa uyarı göster
  if (!isAuthorized) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Yetki Hatası</h3>
            <p className="text-sm text-gray-600">
              Bu talebi görüntüleme yetkiniz yok. Farklı departman veya site.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Sizin Departmanınız</span>
                  <p className="font-medium text-gray-900 mt-1">{userDepartment || 'Belirsiz'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Talep Departmanı</span>
                  <p className="font-medium text-gray-900 mt-1">{request.department || 'Belirsiz'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Malzeme listesi
  const materials = request.purchase_request_items || []

  return (
    <div className="space-y-6">
      {/* Departman Bilgisi */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Departman Onayı Bekleniyor</h3>
              <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                Onay Gerekli
              </Badge>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24">Departman</span>
                <span className="text-sm font-medium text-gray-900">{request.department || 'Genel'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24">Talep Eden</span>
                <span className="text-sm font-medium text-gray-900">
                  {request.profiles?.full_name || request.profiles?.email || 'Bilinmiyor'}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Bu talep <strong>{request.department || 'Genel'}</strong> departmanından gelmiştir. 
                  Onayladığınızda warehouse manager'a gönderilecektir.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Malzeme Listesi */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Talep Edilen Malzemeler
            <span className="ml-2 text-sm font-normal text-gray-500">({materials.length} adet)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {materials.map((item: any, index: number) => (
              <div
                key={item.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-900 text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h4 className="font-semibold text-gray-900">{item.item_name}</h4>
                    </div>
                    {item.brand && (
                      <p className="text-sm text-gray-600 pl-8">
                        <span className="text-gray-500">Marka:</span> <span className="font-medium">{item.brand}</span>
                      </p>
                    )}
                    {item.specifications && (
                      <p className="text-sm text-gray-600 pl-8">
                        <span className="text-gray-500">Özellikler:</span> {item.specifications}
                      </p>
                    )}
                    {item.purpose && (
                      <p className="text-sm text-gray-600 pl-8">
                        <span className="text-gray-500">Kullanım Amacı:</span> {item.purpose}
                      </p>
                    )}
                  </div>
                  <div className="text-right bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Miktar</p>
                    <p className="text-xl font-bold text-gray-900">
                      {item.quantity}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{item.unit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Onay/Reddet Butonları */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleApproval}
              disabled={approving || rejecting}
              className="h-12 bg-gray-900 hover:bg-gray-950 text-white font-medium rounded-xl transition-all"
              size="lg"
            >
              {approving ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Onaylanıyor...
                </span>
              ) : (
                'Talebi Onayla'
              )}
            </Button>
            
            <Button
              onClick={() => setShowRejectModal(true)}
              disabled={approving || rejecting}
              className="h-12 bg-[#d6002a] hover:bg-[#b80024] text-white font-medium rounded-xl transition-all"
              size="lg"
            >
              {rejecting ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Reddediliyor...
                </span>
              ) : (
                'Talebi Reddet'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reddetme Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Talebi Reddet</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Lütfen reddedilme nedenini açıklayın. Bu bilgi talep sahibine iletilecektir.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Label htmlFor="rejection-reason" className="text-sm font-medium">Reddedilme Nedeni</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Örn: Bütçe yetersiz, alternatif ürün kullanılmalı"
              rows={4}
              className="rounded-lg resize-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false)
                setRejectionReason('')
              }}
              className="rounded-lg border-gray-300"
            >
              İptal
            </Button>
            <Button
              onClick={handleRejection}
              disabled={!rejectionReason.trim()}
              className="bg-[#d6002a] hover:bg-[#b80024] rounded-lg"
            >
              Talebi Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
