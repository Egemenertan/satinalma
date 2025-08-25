'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SupplierManagement from '@/components/SupplierManagement'
import { Users, CheckCircle, Star, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SuppliersPage() {
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    approvedSuppliers: 0,
    highRatedSuppliers: 0,
    pendingApproval: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('is_approved, rating')

      if (suppliers) {
        setStats({
          totalSuppliers: suppliers.length,
          approvedSuppliers: suppliers.filter(s => s.is_approved).length,
          highRatedSuppliers: suppliers.filter(s => s.rating >= 4).length,
          pendingApproval: suppliers.filter(s => !s.is_approved).length
        })
      }
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Tedarikçi Yönetimi</h1>
          <p className="text-gray-600 mt-2">Tedarikçi bilgilerini ve performansını yönetin</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Tedarikçi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal">{stats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Sistemde kayıtlı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylı</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-green-600">{stats.approvedSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Aktif çalışılan
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">4+ Yıldız</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-yellow-600">{stats.highRatedSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Yüksek puan
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-orange-600">{stats.pendingApproval}</div>
            <p className="text-xs text-muted-foreground">
              İncelenmeli
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Management */}
      <SupplierManagement />
    </div>
  )
}


