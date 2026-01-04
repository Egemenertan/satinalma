/**
 * BrandCard Component
 * Logo, isim, açıklama, ürün sayısı badge
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Package } from 'lucide-react'
import type { BrandWithProductCount } from '@/services/brands.service'

interface BrandCardProps {
  brand: BrandWithProductCount
  onEdit: (brand: BrandWithProductCount) => void
  onDelete: (brandId: string) => void
}

export function BrandCard({ brand, onEdit, onDelete }: BrandCardProps) {
  const [logoError, setLogoError] = useState(false)
  return (
    <Card className="bg-white rounded-3xl border-0 shadow-sm hover:shadow-lg transition-all duration-200 group">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {brand.logo_url && !logoError ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="w-full h-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-2xl font-bold text-gray-400">
                {brand.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {brand.name}
                </h3>
                {brand.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {brand.description}
                  </p>
                )}
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {brand.website}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(brand)}
                  className="rounded-xl"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(brand.id)}
                  className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Product Count Badge */}
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                <Package className="w-3 h-3 mr-1" />
                {brand.product_count} Ürün
              </Badge>
              {brand.is_active && (
                <Badge className="bg-green-50 text-green-600 border-0">Aktif</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

