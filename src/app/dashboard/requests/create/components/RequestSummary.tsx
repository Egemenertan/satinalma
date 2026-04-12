'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Building2, 
  Package, 
  Image as ImageIcon,
  CheckCircle2,
  Save,
  Calendar,
  Target,
  Settings,
  Tag,
  Trash2,
  Edit2,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { RequestSummaryProps, CartItem } from '../types'

export function RequestSummary({
  items,
  site,
  siteName,
  onBack,
  onSubmit,
  onRemoveItem,
  onEditItem,
  isLoading
}: RequestSummaryProps) {
  const totalImages = items.reduce((sum, item) => sum + (item.uploaded_images?.length || 0), 0)
  const displaySiteName = site?.name || siteName

  return (
    <div className="space-y-4 pb-24">
      {/* Back Button */}
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="h-9 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Alışverişe Dön
      </Button>

      {/* Header Card */}
      <Card className="rounded-2xl bg-white border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Talep Özeti</h2>
                <p className="text-sm text-gray-500 mt-1">Son kontrol ve gönderim</p>
              </div>
            </div>
            
            <Button 
              type="button"
              onClick={onSubmit}
              disabled={isLoading || items.length === 0}
              className="w-full lg:w-auto h-12 px-8 rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Talebi Gönder
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="rounded-xl bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500">Lokasyon</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{displaySiteName}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500">Toplam Malzeme</p>
                <p className="text-sm font-semibold text-gray-900">{items.length} adet</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500">Fotoğraflar</p>
                <p className="text-sm font-semibold text-gray-900">{totalImages} adet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials List */}
      <Card className="rounded-2xl bg-white border-0 shadow-sm">
        <CardHeader className="border-0 pb-2">
          <CardTitle className="text-base font-semibold text-gray-900">Malzeme Listesi</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            {items.map((item, index) => (
              <SummaryItemCard
                key={item.id}
                item={item}
                index={index}
                onEdit={() => onEditItem(item, index)}
                onRemove={() => onRemoveItem(item.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Submit Button */}
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <Button 
            type="button"
            onClick={onSubmit}
            disabled={isLoading || items.length === 0}
            className="w-full h-14 px-8 rounded-xl font-semibold bg-black hover:bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Talebi Gönder
              </>
            )}
          </Button>
          <p className="text-center text-xs text-gray-400 mt-3">
            {items.length} malzeme ile talep oluşturulacak
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

interface SummaryItemCardProps {
  item: CartItem
  index: number
  onEdit: () => void
  onRemove: () => void
}

function SummaryItemCard({ item, index, onEdit, onRemove }: SummaryItemCardProps) {
  return (
    <div className="border-0 rounded-xl p-5 hover:shadow-md transition-all bg-gray-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{index + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 mb-1">{item.material_name}</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="bg-gray-200 text-gray-700 text-xs">
                {item.material_class}
              </Badge>
              {item.material_group && (
                <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs">
                  {item.material_group}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Quantity & Actions */}
        <div className="flex items-start gap-3 ml-4">
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">{item.quantity}</p>
            <p className="text-sm text-gray-500">{item.unit}</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center transition-colors"
            >
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onRemove}
              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 border border-red-100 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {item.brand && (
          <div className="bg-white rounded-lg p-3 border-0 shadow-sm">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500">Marka</p>
                <p className="text-sm font-medium text-gray-900">{item.brand}</p>
              </div>
            </div>
          </div>
        )}
        {item.delivery_date && (
          <div className="bg-white rounded-lg p-3 border-0 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500">Gerekli Tarih</p>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(item.delivery_date), 'dd MMMM yyyy', { locale: tr })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Purpose */}
      {item.purpose && (
        <div className="bg-white rounded-lg p-3 border-0 shadow-sm mb-4">
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">Kullanım Amacı</p>
              <p className="text-sm text-gray-900">{item.purpose}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Specifications */}
      {item.specifications && (
        <div className="bg-white rounded-lg p-3 border-0 shadow-sm mb-4">
          <div className="flex items-start gap-2">
            <Settings className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">Teknik Özellikler</p>
              <p className="text-sm text-gray-900">{item.specifications}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Images */}
      {(item.image_preview_urls?.length || 0) > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {item.uploaded_images?.length} Fotoğraf
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(item.image_preview_urls || []).map((url, imgIndex) => (
              <div key={imgIndex} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={url}
                  alt={`${item.material_name} ${imgIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
