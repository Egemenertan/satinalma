/**
 * ProductStatsCards Component
 * Ürün istatistikleri kartları
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useProductStats } from '../hooks'
import { Loading } from '@/components/ui/loading'

interface ProductStatsCardsProps {
  siteId?: string
}

export function ProductStatsCards({ siteId }: ProductStatsCardsProps) {
  const { data: stats, isLoading } = useProductStats(siteId)
  const [hoveredBar, setHoveredBar] = useState<{ name: string; count: number } | null>(null)

  if (isLoading) {
    return (
      <Card className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full">
        <CardContent className="p-6">
          <Loading size="sm" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden w-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">En Çok Stoğa Sahip Ürünler</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{stats?.totalProducts || 0}</p>
              <span className="text-sm text-gray-500">toplam ürün</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">İlk 10 ürün stok dağılımı</p>
          </div>
        </div>
        
        {/* Bar Chart */}
        <div className="flex items-end justify-between gap-1.5 h-32 relative">
          {stats?.topProducts && stats.topProducts.length > 0 ? (
            stats.topProducts.map((item, i) => {
              const maxCount = Math.max(...stats.topProducts.map((t: any) => t.count))
              const height = (item.count / maxCount) * 100
              const isHovered = hoveredBar?.name === item.name
              
              return (
                <div 
                  key={i} 
                  className="flex-1 flex flex-col items-center gap-2 relative"
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                    <div 
                      className={`w-full rounded-t-md transition-all duration-300 cursor-pointer ${
                        isHovered ? 'bg-[#d6002a] shadow-lg scale-110' : 'bg-gray-900'
                      }`}
                      style={{ 
                        height: `${height}%`,
                        minHeight: '8px'
                      }}
                    />
                  </div>
                  
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap z-10 shadow-lg">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-gray-300">{item.count} adet</div>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-[9px] font-medium text-gray-600 text-center line-clamp-1 w-full">
                    {item.name.length > 6 ? item.name.slice(0, 6) + '...' : item.name}
                  </p>
                </div>
              )
            })
          ) : (
            <div className="w-full text-center py-8 text-sm text-gray-400">
              Henüz stok kaydı yok
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}








