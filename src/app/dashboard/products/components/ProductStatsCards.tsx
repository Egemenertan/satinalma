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
            <p className="text-xs text-gray-500 mt-1">İlk 100 ürün stok dağılımı</p>
          </div>
        </div>
        
        {/* Bar Chart */}
        <div className="flex items-end justify-center gap-0.5 h-32 relative overflow-x-auto scrollbar-hide px-2">
          {stats?.topProducts && stats.topProducts.length > 0 ? (
            stats.topProducts.map((item, i) => {
              const maxCount = Math.max(...stats.topProducts.map((t: any) => t.count))
              const minCount = Math.min(...stats.topProducts.map((t: any) => t.count))
              
              const logMax = Math.log10(maxCount + 1)
              const logMin = Math.log10(minCount + 1)
              const logValue = Math.log10(item.count + 1)
              
              const normalizedHeight = logMin === logMax 
                ? 100 
                : ((logValue - logMin) / (logMax - logMin)) * 70 + 30
              
              const isHovered = hoveredBar?.name === item.name
              
              return (
                <div 
                  key={i} 
                  className="flex flex-col items-center relative flex-shrink-0"
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                    <div 
                      className={`w-2 rounded-full transition-all duration-300 cursor-pointer ${
                        isHovered ? 'bg-gray-900 shadow-lg' : 'bg-gray-900'
                      }`}
                      style={{ 
                        height: `${normalizedHeight}%`,
                        minHeight: '12px'
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








