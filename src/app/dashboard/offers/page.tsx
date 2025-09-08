'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import OfferManagement from '@/components/OfferManagement'
import { TrendingUp, FileText, Users, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function OffersPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({
    totalOffers: 0,
    pendingRequests: 0,
    activeSuppliers: 0,
    avgResponseTime: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Toplam teklif sayısı
      const { data: offers } = await supabase
        .from('offers')
        .select('id')

      // Teklif bekleyen talepler
      const { data: pendingRequests } = await supabase
        .from('purchase_requests')
        .select('id')
        .eq('status', 'pending_offers')

      // Aktif tedarikçiler
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id')
        .eq('is_approved', true)

      setStats({
        totalOffers: offers?.length || 0,
        pendingRequests: pendingRequests?.length || 0,
        activeSuppliers: suppliers?.length || 0,
        avgResponseTime: 3.2 // Örnek değer
      })
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Teklif Yönetimi</h1>
          <p className="text-gray-600 mt-2">Tedarikçi tekliflerini toplayın, karşılaştırın ve değerlendirin</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Teklif</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal">{stats.totalOffers}</div>
            <p className="text-xs text-muted-foreground">
              Bu ay alınan
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teklif Bekleyen</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-orange-600">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              Teklif gerekli
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Tedarikçi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal">{stats.activeSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Onaylı ve aktif
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ortalama Yanıt</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-green-600">{stats.avgResponseTime} gün</div>
            <p className="text-xs text-muted-foreground">
              Teklif süresi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Offer Management */}
      <OfferManagement />
    </div>
  )
}


