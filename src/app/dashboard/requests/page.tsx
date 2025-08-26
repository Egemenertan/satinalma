'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import PurchaseRequestsTable from '@/components/PurchaseRequestsTable'
import { Package, Plus, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function RequestsPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    urgent: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { getPurchaseRequests } = await import('@/lib/actions')
      const result = await getPurchaseRequests()
      
      if (result.success && result.data) {
        const requests = result.data
        setStats({
          total: requests.length,
          pending: requests.filter((r: any) => r.status === 'pending').length,
          approved: requests.filter((r: any) => r.status === 'approved').length,
          urgent: requests.filter((r: any) => r.urgency_level === 'critical' || r.urgency_level === 'high').length
        })
      }
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error)
    }
  }

  return (
    <div className="px-4 sm:px-6 pb-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-4">
        {/* Desktop: Header with button on right */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-lg font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/requests/create')}
            className="bg-black hover:bg-gray-900 text-white font-light px-16 py-5 rounded-xl text-xl hover:shadow-2xl transition-all duration-200"
          >
            <Plus className="w-6 h-6 mr-3" />
            Yeni Talep
          </Button>
        </div>

        {/* Mobile: Header with button below */}
        <div className="sm:hidden space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-base font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/requests/create')}
            className="w-full h-14 bg-black hover:bg-gray-900 text-white font-light rounded-xl text-lg hover:shadow-2xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-3" />
            Yeni Talep
          </Button>
        </div>
      </div>

      {/* Desktop: Stats Cards then Table */}
      <div className="hidden sm:block space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Toplam Talep</CardTitle>
              <Package className="h-5 w-5 text-white/70" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <p className="text-xs text-white/70">
                +%12 geçen aya göre
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black/70">Bekleyen</CardTitle>
              <Clock className="h-5 w-5 text-black/60" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-black">{stats.pending}</div>
              <p className="text-xs text-black/70">
                İşlem gerekli
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Onaylanan</CardTitle>
              <CheckCircle className="h-5 w-5 text-white/70" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.approved}</div>
              <p className="text-xs text-white/70">
                Bu ay onaylanan
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black/70">Acil</CardTitle>
              <AlertTriangle className="h-5 w-5 text-black/60" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-black">{stats.urgent}</div>
              <p className="text-xs text-black/70">
                Hemen işlem gerekli
              </p>
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
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Toplam</CardTitle>
              <Package className="h-4 w-4 text-white/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <p className="text-xs text-white/70">
                Talep
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black/70">Bekleyen</CardTitle>
              <Clock className="h-4 w-4 text-black/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">{stats.pending}</div>
              <p className="text-xs text-black/70">
                İşlem gerekli
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Onaylanan</CardTitle>
              <CheckCircle className="h-4 w-4 text-white/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.approved}</div>
              <p className="text-xs text-white/70">
                Bu ay
              </p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black/70">Acil</CardTitle>
              <AlertTriangle className="h-4 w-4 text-black/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">{stats.urgent}</div>
              <p className="text-xs text-black/70">
                Hemen işlem
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
