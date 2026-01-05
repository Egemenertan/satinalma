/**
 * ProductStatsCards Component
 * Ürün istatistikleri kartları
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Package, TrendingDown, DollarSign } from 'lucide-react'
import { useProductStats } from '../hooks'
import { Loading } from '@/components/ui/loading'

export function ProductStatsCards() {
  const { data: stats, isLoading } = useProductStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-white rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <Loading size="sm" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Toplam Ürün */}
      <Card className="bg-white rounded-3xl border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Toplam Ürün</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {stats?.totalProducts || 0}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Aktif ürün sayısı</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Düşük Stoklu Ürünler */}
      <Card className="bg-white rounded-3xl border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Düşük Stok</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {stats?.lowStockCount || 0}
                </span>
                {stats && stats.lowStockCount > 0 && (
                  <div className="flex items-center text-red-600 text-sm">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    <span>Uyarı</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Min. seviyenin altında</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toplam Stok Değeri */}
      <Card className="bg-white rounded-3xl border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Toplam Değer</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {stats?.totalValue?.toLocaleString('tr-TR', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  }) || '0,00'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">TRY cinsinden</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}





