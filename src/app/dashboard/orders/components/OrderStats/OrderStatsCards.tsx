'use client'

import { CheckCircle, Package, XCircle, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { calculateOrderStats } from '../../utils'
import type { OrderData } from '../../types'

interface OrderStatsCardsProps {
  orders: OrderData[]
}

export function OrderStatsCards({ orders }: OrderStatsCardsProps) {
  const stats = calculateOrderStats(orders)

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {/* Teslim Edildi */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Teslim Edildi</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl md:text-2xl font-bold text-gray-900">
                  {stats.delivered}
                </span>
                <div className="hidden md:flex items-center text-green-600 text-sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  <span>Tamamlandı</span>
                </div>
              </div>
              <p className="hidden md:block text-xs text-gray-500 mt-1">Başarıyla teslim edildi</p>
              <p className="hidden lg:block text-xs text-gray-400">Sipariş süreci tamamlandı</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kısmi Teslim */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Kısmi Teslim</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl md:text-2xl font-bold text-gray-900">
                  {stats.partiallyDelivered}
                </span>
                <div className="hidden md:flex items-center text-orange-600 text-sm">
                  <Package className="h-3 w-3 mr-1" />
                  <span>Devam Ediyor</span>
                </div>
              </div>
              <p className="hidden md:block text-xs text-gray-500 mt-1">Kısmi teslimat yapıldı</p>
              <p className="hidden lg:block text-xs text-gray-400">Bekleyen teslimatlar var</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* İade Edildi */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs md:text-sm text-gray-600 mb-1">İade Edildi</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl md:text-2xl font-bold text-gray-900">
                  {stats.returned}
                </span>
                <div className="hidden md:flex items-center text-red-600 text-sm">
                  <XCircle className="h-3 w-3 mr-1" />
                  <span>İade</span>
                </div>
              </div>
              <p className="hidden md:block text-xs text-gray-500 mt-1">İade edilen siparişler</p>
              <p className="hidden lg:block text-xs text-gray-400">Yeniden sipariş gerekebilir</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toplam Sipariş */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Toplam Sipariş</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl md:text-2xl font-bold text-gray-900">{stats.total}</span>
                <div className="hidden md:flex items-center text-blue-600 text-sm">
                  <Building2 className="h-3 w-3 mr-1" />
                  <span>Aktif</span>
                </div>
              </div>
              <p className="hidden md:block text-xs text-gray-500 mt-1">Tüm sipariş kayıtları</p>
              <p className="hidden lg:block text-xs text-gray-400">Sistem generi toplam</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}











