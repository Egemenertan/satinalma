'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import PurchaseRequestsTable from '@/components/PurchaseRequestsTable'

import { Package, Plus, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateStatsCache } from '@/lib/cache'

// Stats fetcher fonksiyonu
const fetchStats = async () => {
  const supabase = createClient()
  
  // Kullanıcı bilgilerini çek
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  // Kullanıcı rolünü çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let query = supabase
    .from('purchase_requests')
    .select(`
      id,
      status,
      urgency_level,
      requested_by,
      orders!left (
        id
      )
    `)
  
  // Site personeli sadece kendi taleplerini görebilir
  if (profile?.role === 'site_personnel') {
    query = query.eq('requested_by', user.id)
  }
  
  // Purchasing officer sadece şantiye şefi onayladığı ve sipariş verilmiş talepleri görebilir
  if (profile?.role === 'purchasing_officer') {
    query = query.in('status', ['şantiye şefi onayladı', 'sipariş verildi'])
  }
  
  const { data: requests, error } = await query
  
  if (error) {
    throw new Error(error.message)
  }
  
  if (requests) {
    // Siparişi olan taleplerin durumunu güncelle
    const updatedRequests = requests.map(request => ({
      ...request,
      status: request.orders && request.orders.length > 0 ? 'sipariş verildi' : request.status
    }))

    return {
      total: updatedRequests.length,
      pending: updatedRequests.filter(r => r.status === 'pending').length,
      approved: updatedRequests.filter(r => r.status === 'approved').length,
      urgent: updatedRequests.filter(r => r.urgency_level === 'critical' || r.urgency_level === 'high').length
    }
  }
  
  return { total: 0, pending: 0, approved: 0, urgent: 0 }
}

export default function RequestsPage() {
  const router = useRouter()
  
  // SWR ile cache'li stats
  const { data: stats, error: statsError, mutate: refreshStats } = useSWR(
    'purchase_requests_stats',
    fetchStats,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 saniye cache
      errorRetryCount: 3,
      fallbackData: { total: 0, pending: 0, approved: 0, urgent: 0 }
    }
  )

  // Real-time updates için subscription
  useEffect(() => {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('stats_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        () => {
          console.log('📡 Stats update triggered')
          invalidateStatsCache()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])



  return (
    <div className="px-0 pb-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-4 px-4">
        {/* Desktop: Header with button on right */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-lg font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => router.push('/dashboard/requests/create')}
              className="px-8 py-5 rounded-xl text-lg bg-black text-white hover:bg-gray-900 hover:shadow-lg transition-all duration-200"
            >
              
              Yeni Talep Oluştur
            </Button>
          </div>
        </div>

        {/* Mobile: Header with button below */}
        <div className="sm:hidden space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-base font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/requests/create')}
            className="w-full h-12 rounded-xl text-lg bg-black text-white hover:bg-gray-900 hover:shadow-lg transition-all duration-200"
          >
            
            Yeni Talep Oluştur
          </Button>
        </div>
      </div>

      {/* Desktop: Stats Cards then Table */}
      <div className="hidden sm:block space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-4">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Talep</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.total || 0}</span>
                    <div className="flex items-center text-green-600 text-sm">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>+12%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Geçen aya göre artış</p>
                  <p className="text-xs text-gray-400">Tüm satın alma talepleri</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bekleyen Talepler</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</span>
                    <div className="flex items-center text-orange-600 text-sm">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>Bekliyor</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">İşlem gerekli</p>
                  <p className="text-xs text-gray-400">Onay bekleyen talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Onaylanan</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.approved || 0}</span>
                    <div className="flex items-center text-green-600 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Tamamlandı</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Bu ay onaylanan</p>
                  <p className="text-xs text-gray-400">Başarıyla işlenen talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Acil Talepler</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.urgent || 0}</span>
                    <div className="flex items-center text-red-600 text-sm">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Acil</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Hemen işlem gerekli</p>
                  <p className="text-xs text-gray-400">Yüksek öncelikli talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests Table */}
        <PurchaseRequestsTable />
      </div>

      {/* Mobile: Table first, then Stats Cards */}
      <div className="sm:hidden space-y-6">
        {/* Requests Table */}
        <PurchaseRequestsTable />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 px-4">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.total || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Talep</p>
                </div>
                <Package className="h-4 w-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bekleyen</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.pending || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">İşlem gerekli</p>
                </div>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Onaylanan</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.approved || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Bu ay</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Acil</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.urgent || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Hemen işlem</p>
                </div>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
