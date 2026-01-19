/**
 * ProductModal Component
 * Modern, ferah modal tasarımı - 5 tab ile
 * Tabs: Ürün Bilgileri, Resimler, Stok Durumu, Stok İşlemleri, Stok Geçmişi
 */

'use client'

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
} from 'lucide-react'
import { useProduct } from '../hooks'
import { useQuery } from '@tanstack/react-query'
import { fetchStockByProduct, fetchStockMovements } from '@/services/stock.service'
import type { ProductModalTab } from '../hooks/useProductModal'
import { ProductForm } from './ProductForm'
import { StockOperationsForm } from './StockOperationsForm'
import { ProductInfoTab, ProductImagesTab, ProductStockTab, ProductHistoryTab } from './tabs'

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

  // Stok verileri
  const { data: stockData } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: () => (productId ? fetchStockByProduct(productId) : null),
    enabled: !!productId && (activeTab === 'stock' || activeTab === 'movements'),
  })

  // Stok hareketleri (info ve history tablarında kullanılıyor)
  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: () => (productId ? fetchStockMovements({ productId }, 1, 50) : null),
    enabled: !!productId && (activeTab === 'history' || activeTab === 'info'),
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
                    <ProductInfoTab product={product} movementsData={movementsData} />
                  ) : null}
                </TabsContent>

                {/* Resimler Tab */}
                <TabsContent value="images" className="p-8 m-0 space-y-6">
                  {product && <ProductImagesTab product={product} />}
                </TabsContent>

                {/* Stok Durumu Tab */}
                <TabsContent value="stock" className="p-8 m-0 space-y-6">
                  <ProductStockTab 
                    product={product} 
                    stockData={stockData || []} 
                    totalStock={totalStock} 
                  />
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
                  <ProductHistoryTab product={product} movementsData={movementsData} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
