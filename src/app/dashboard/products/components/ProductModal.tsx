/**
 * ProductModal Component
 * Modern, ferah modal tasarımı - 5 tab ile
 * Tabs: Ürün Bilgileri, Resimler, Stok Durumu, Stok İşlemleri, Stok Geçmişi
 */

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import {
  Info,
  Image as ImageIcon,
  Package,
  TrendingUp,
  History,
  X,
  TrendingDown,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useProduct } from '../hooks'
import { useQuery } from '@tanstack/react-query'
import { fetchStockByProduct, fetchStockMovements } from '@/services/stock.service'
import type { ProductModalTab } from '../hooks/useProductModal'
import { ProductForm } from './ProductForm'
import { StockOperationsForm } from './StockOperationsForm'
import { generateStockMovementPDF } from '@/services/pdf.service'

interface ProductModalProps {
  isOpen: boolean
  productId: string | null
  activeTab: ProductModalTab
  mode?: 'view' | 'edit' | 'create'
  onClose: () => void
  onTabChange: (tab: ProductModalTab) => void
  onSave?: (data: any) => void
  isSaving?: boolean
}

export function ProductModal({
  isOpen,
  productId,
  activeTab,
  mode = 'view',
  onClose,
  onTabChange,
  onSave,
  isSaving = false,
}: ProductModalProps) {
  const { data: product, isLoading } = useProduct(productId)
  const [expandedStockIds, setExpandedStockIds] = useState<Set<string>>(new Set())

  // Stok verileri
  const { data: stockData } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: () => (productId ? fetchStockByProduct(productId) : null),
    enabled: !!productId && (activeTab === 'stock' || activeTab === 'movements'),
  })

  // Stok hareketleri
  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: () => (productId ? fetchStockMovements({ productId }, 1, 50) : null),
    enabled: !!productId && activeTab === 'history',
  })

  // Create modunda productId olması gerekmez
  if (!isOpen) return null

  const totalStock = product?.total_stock || 0
  const hasLowStock = (product?.warehouse_stocks || []).some(
    (stock) => stock.min_stock_level && stock.quantity <= stock.min_stock_level
  )

  // Stok durumu
  const getStockStatus = () => {
    if (totalStock === 0)
      return { text: 'Stokta Yok', color: 'bg-red-50 text-red-600', icon: AlertCircle }
    if (hasLowStock)
      return { text: 'Düşük Stok', color: 'bg-orange-50 text-orange-600', icon: TrendingDown }
    return { text: 'Stokta Var', color: 'bg-green-50 text-green-600', icon: TrendingUp }
  }

  const stockStatus = getStockStatus()
  const StockIcon = stockStatus.icon

  // Edit veya create modunda form göster
  const showForm = mode === 'edit' || mode === 'create'

  // Accordion toggle
  const toggleStockExpand = (stockId: string) => {
    setExpandedStockIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stockId)) {
        newSet.delete(stockId)
      } else {
        newSet.add(stockId)
      }
      return newSet
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[1200px] !max-h-[90vh] h-[90vh] bg-white/95 backdrop-blur-2xl p-0 rounded-3xl w-[90vw] sm:!max-w-[1200px] border-0 shadow-2xl gap-0"
      >
        {isLoading && mode !== 'create' ? (
          <div className="flex items-center justify-center py-16">
            <Loading size="lg" text="Ürün yükleniyor..." />
          </div>
        ) : (
          <div className="flex flex-col h-full bg-gradient-to-br from-gray-50/50 to-white/50 rounded-3xl overflow-hidden">
            {/* Header - Apple Style */}
            <DialogHeader className="px-8 py-6 border-b border-gray-200/50 backdrop-blur-xl bg-white/40 flex-shrink-0 rounded-t-3xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-3xl font-semibold text-gray-900 mb-1 tracking-tight">
                    {mode === 'create'
                      ? 'Yeni Ürün Ekle'
                      : mode === 'edit'
                      ? 'Ürün Düzenle'
                      : product?.name}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {mode === 'create'
                      ? 'Yeni ürün bilgilerini girin'
                      : mode === 'edit'
                      ? 'Ürün bilgilerini düzenleyin'
                      : 'Ürün detaylarını görüntüleyin'}
                  </DialogDescription>
                  {product && mode === 'view' && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {product.brand && (
                        <Badge variant="secondary" className="bg-gray-100/80 text-gray-700 border-0 rounded-full px-3 py-1">
                          {product.brand.name}
                        </Badge>
                      )}
                      {product.sku && (
                        <span className="text-sm text-gray-500 font-medium">SKU: {product.sku}</span>
                      )}
                      <Badge className={`${stockStatus.color} border-0 rounded-full px-3 py-1`}>
                        <StockIcon className="w-3 h-3 mr-1" />
                        {stockStatus.text}
                      </Badge>
                    </div>
                  )}
                  {(mode === 'create' || mode === 'edit') && (
                    <p className="text-sm text-gray-500 font-normal mt-1">
                      {mode === 'create' ? 'Yeni ürün bilgilerini girin' : 'Ürün bilgilerini düzenleyin'}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="rounded-full h-10 w-10 p-0 hover:bg-gray-100/80 transition-all"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </Button>
              </div>
            </DialogHeader>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as ProductModalTab)}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="w-full justify-start px-8 py-6 bg-gradient-to-b from-white/80 to-white/60 backdrop-blur-xl border-b border-gray-200/50 gap-3 flex-shrink-0">
                <TabsTrigger 
                  value="info" 
                  className="gap-2.5 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:bg-white/70 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:border data-[state=inactive]:border-gray-200/60 rounded-2xl px-6 py-3.5 transition-all duration-200 font-medium text-base min-h-[48px]"
                >
                  <Info className="w-5 h-5" />
                  <span>Bilgiler</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="images" 
                  className="gap-2.5 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:bg-white/70 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:border data-[state=inactive]:border-gray-200/60 rounded-2xl px-6 py-3.5 transition-all duration-200 font-medium text-base min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed" 
                  disabled={showForm}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>Resimler</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="stock" 
                  className="gap-2.5 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:bg-white/70 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:border data-[state=inactive]:border-gray-200/60 rounded-2xl px-6 py-3.5 transition-all duration-200 font-medium text-base min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed" 
                  disabled={showForm}
                >
                  <Package className="w-5 h-5" />
                  <span>Stok Durumu</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="movements" 
                  className="gap-2.5 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:bg-white/70 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:border data-[state=inactive]:border-gray-200/60 rounded-2xl px-6 py-3.5 transition-all duration-200 font-medium text-base min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed" 
                  disabled={showForm}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Stok İşlemleri</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="gap-2.5 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:bg-white/70 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:border data-[state=inactive]:border-gray-200/60 rounded-2xl px-6 py-3.5 transition-all duration-200 font-medium text-base min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed" 
                  disabled={showForm}
                >
                  <History className="w-5 h-5" />
                  <span>Geçmiş</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto bg-white/30 backdrop-blur-sm min-h-0 rounded-b-3xl">
                {/* Ürün Bilgileri Tab */}
                <TabsContent value="info" className="p-8 space-y-6 m-0">
                  {showForm ? (
                    <ProductForm
                      product={product}
                      onSubmit={onSave!}
                      onCancel={onClose}
                      isSaving={isSaving}
                    />
                  ) : product ? (
                    <>
                      {/* Apple Style Info Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Adı</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">{product.name}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">{product.sku || '-'}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kategori</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">
                            {product.category?.name || '-'}
                          </p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Tipi</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">
                            {product.product_type || '-'}
                          </p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">{product.unit || '-'}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim Fiyat</label>
                          <p className="text-lg font-semibold text-gray-900 mt-2">
                            {product.unit_price
                              ? `${Number(product.unit_price).toLocaleString('tr-TR', {
                                  minimumFractionDigits: 2,
                                })} ${product.currency || 'TRY'}`
                              : '-'}
                          </p>
                        </div>
                      </div>

                      {product.description && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                            Açıklama
                          </label>
                          <p className="text-gray-900 leading-relaxed">{product.description}</p>
                        </div>
                      )}
                    </>
                  ) : null}
                </TabsContent>

                {/* Resimler Tab */}
                <TabsContent value="images" className="p-8 m-0">
                  {product?.images && Array.isArray(product.images) && product.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-6">
                      {product.images.map((image, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all"
                        >
                          <img
                            src={image}
                            alt={`${product.name} - ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <ImageIcon className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">Henüz resim eklenmemiş</p>
                    </div>
                  )}
                </TabsContent>

                {/* Stok Durumu Tab */}
                <TabsContent value="stock" className="p-8 m-0">
                  {stockData && stockData.length > 0 ? (
                    <div className="space-y-4">
                      {stockData.map((stock) => {
                        const breakdown = (stock.condition_breakdown as any) || {}
                        const isExpanded = expandedStockIds.has(stock.id)
                        
                        // 0'dan büyük değerleri filtrele
                        const activeConditions = Object.entries(breakdown).filter(
                          ([_, qty]) => Number(qty) > 0
                        )

                        return (
                          <div
                            key={stock.id}
                            className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all overflow-hidden"
                          >
                            {/* Header - Tıklanabilir */}
                            <button
                              onClick={() => toggleStockExpand(stock.id)}
                              className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-all"
                            >
                              <div className="text-left">
                                <p className="font-semibold text-gray-900 text-lg">
                                  {stock.warehouse?.name || 'Depo Belirtilmemiş'}
                                </p>
                                <p className="text-sm text-gray-500 mt-1 font-medium">
                                  Min: {stock.min_stock_level || 0} | Max: {stock.max_stock_level || '-'}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-3xl font-bold text-gray-900">
                                    {parseFloat(stock.quantity.toString()).toLocaleString('tr-TR')}
                                  </p>
                                  <p className="text-sm text-gray-500 font-medium">{product?.unit || ''}</p>
                                </div>
                                {activeConditions.length > 0 && (
                                  isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )
                                )}
                              </div>
                            </button>

                            {/* Breakdown - Açılır Alan */}
                            {isExpanded && activeConditions.length > 0 && (
                              <div className="px-6 pb-6 pt-0 border-t border-gray-200/50">
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                  {activeConditions.map(([condition, qty]) => {
                                    const conditionConfig = {
                                      yeni: { icon: '🆕', label: 'Yeni', color: 'bg-green-50 text-green-700 border-green-200' },
                                      kullanılmış: { icon: '♻️', label: 'Kullanılmış', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                                      hek: { icon: '📦', label: 'HEK', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                      arızalı: { icon: '⚠️', label: 'Arızalı', color: 'bg-red-50 text-red-700 border-red-200' },
                                    }[condition] || { icon: '📦', label: condition, color: 'bg-gray-50 text-gray-700 border-gray-200' }

                                    return (
                                      <div
                                        key={condition}
                                        className={`rounded-2xl p-4 border ${conditionConfig.color}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">
                                            {conditionConfig.icon} {conditionConfig.label}
                                          </span>
                                          <span className="text-lg font-bold">
                                            {Number(qty).toLocaleString('tr-TR')}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-3xl p-6 flex items-center justify-between shadow-lg">
                        <p className="font-semibold text-lg">Toplam Stok</p>
                        <p className="text-3xl font-bold">
                          {totalStock.toLocaleString('tr-TR')} {product?.unit || ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <Package className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">Stok bilgisi bulunamadı</p>
                    </div>
                  )}
                </TabsContent>

                {/* Stok İşlemleri Tab */}
                <TabsContent value="movements" className="p-8 m-0">
                  {product ? (
                    <StockOperationsForm
                      productId={product.id}
                      productName={product.name}
                      onSuccess={() => {
                        // Stok güncellendiğinde diğer tabları da yenile
                        onTabChange('stock')
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <TrendingUp className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">Ürün yükleniyor...</p>
                    </div>
                  )}
                </TabsContent>

                {/* Geçmiş Tab */}
                <TabsContent value="history" className="p-8 m-0">
                  {movementsData && movementsData.movements.length > 0 ? (
                    <div className="space-y-3">
                      {movementsData.movements.map((movement: any) => (
                        <div
                          key={movement.id}
                          className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-gray-200/50 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-lg">
                              {movement.movement_type.toUpperCase()}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-600 font-medium">
                                {movement.warehouse?.name || '-'}
                              </p>
                              {movement.product_condition && (
                                <Badge
                                  className={`text-xs border-0 ${
                                    movement.product_condition === 'yeni'
                                      ? 'bg-green-100 text-green-700'
                                      : movement.product_condition === 'kullanılmış'
                                      ? 'bg-orange-100 text-orange-700'
                                      : movement.product_condition === 'hek'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {movement.product_condition === 'yeni'
                                    ? '🆕 Yeni'
                                    : movement.product_condition === 'kullanılmış'
                                    ? '♻️ Kullanılmış'
                                    : movement.product_condition === 'hek'
                                    ? '📦 HEK'
                                    : '⚠️ Arızalı'}
                                </Badge>
                              )}
                            </div>
                            {movement.reason && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                {movement.reason}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(movement.created_at).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="text-2xl font-bold text-gray-900">
                                {movement.movement_type === 'giriş' ? '+' : '-'}
                                {parseFloat(movement.quantity).toLocaleString('tr-TR')}
                              </p>
                              <p className="text-sm text-gray-500 font-medium mt-1">
                                {movement.previous_quantity?.toLocaleString('tr-TR')} →{' '}
                                {movement.new_quantity?.toLocaleString('tr-TR')}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (product) {
                                  generateStockMovementPDF({
                                    transaction: {
                                      id: movement.id,
                                      quantity: movement.quantity,
                                      movement_type: movement.movement_type,
                                      reason: movement.reason,
                                      created_at: movement.created_at,
                                      supplier_name: movement.supplier_name,
                                      product_condition: movement.product_condition,
                                      warehouse: movement.warehouse,
                                    },
                                    productDetails: {
                                      name: product.name,
                                      sku: product.sku,
                                      unit: product.unit,
                                      unit_price: product.unit_price as any,
                                      currency: product.currency,
                                      category: product.category,
                                      brand: product.brand,
                                    },
                                  })
                                }
                              }}
                              className="rounded-xl border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all flex-shrink-0"
                              title="PDF İndir"
                            >
                              <FileText className="w-4 h-4 text-gray-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <History className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">Henüz hareket kaydı yok</p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
