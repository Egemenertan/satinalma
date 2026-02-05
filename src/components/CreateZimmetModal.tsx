'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Package, 
  ChevronRight, 
  ChevronLeft, 
  Search,
  Check,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Product {
  id: string
  name: string
  unit: string
  category: string | null
  product_type: string | null
  total_stock?: number
}

interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
}

interface WarehouseStock {
  id: string
  warehouse_id: string | null
  quantity: number
  warehouse: {
    name: string
  } | null
}

interface SelectedProduct extends Product {
  quantity: number
  stockType: 'new' | 'used'
  warehouseId: string
  availableStock: number
}

interface CreateZimmetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export default function CreateZimmetModal({
  open,
  onOpenChange,
  onSuccess,
  showToast
}: CreateZimmetModalProps) {
  const [step, setStep] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productDetails, setProductDetails] = useState<SelectedProduct[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<Record<string, WarehouseStock[]>>({})
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchUsers()
      fetchProducts()
    } else {
      resetModal()
    }
  }, [open])

  useEffect(() => {
    filterProducts()
  }, [searchQuery, products])

  const resetModal = () => {
    setStep(1)
    setSelectedUserId('')
    setSearchQuery('')
    setSelectedProducts([])
    setProductDetails([])
    setWarehouseStocks({})
  }

  const fetchUsers = async () => {
    try {
      setLoadingData(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error)
      showToast('Kullanıcılar yüklenemedi', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const fetchProducts = async () => {
    try {
      // Ürünleri çek
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, unit, category, product_type')
        .order('name')

      if (productsError) throw productsError

      // Her ürün için toplam stok miktarını hesapla
      const productsWithStock = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: stockData, error: stockError } = await supabase
            .from('warehouse_stock')
            .select('quantity')
            .eq('product_id', product.id)
            .is('user_id', null)

          if (stockError) {
            console.error(`Ürün ${product.id} için stok bilgisi alınamadı:`, stockError)
            return { ...product, total_stock: 0 }
          }

          // Tüm depolardaki toplam miktarı hesapla
          const totalStock = (stockData || []).reduce(
            (sum, stock) => sum + parseFloat(stock.quantity.toString()),
            0
          )

          return { ...product, total_stock: totalStock }
        })
      )

      setProducts(productsWithStock)
      setFilteredProducts(productsWithStock)
    } catch (error) {
      console.error('Ürünler yüklenemedi:', error)
      showToast('Ürünler yüklenemedi', 'error')
    }
  }

  const fetchWarehouseStock = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
          id,
          warehouse_id,
          quantity,
          warehouse:sites!warehouse_stock_warehouse_id_fkey(name)
        `)
        .eq('product_id', productId)
        .is('user_id', null)
        .gt('quantity', 0)

      if (error) {
        console.error('Stok sorgusu hatası:', error)
        throw error
      }
      
      // Supabase join sonucu tipini düzelt
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse
      }))
      
      console.log(`📦 Ürün ${productId} için stok:`, formattedData)
      return formattedData
    } catch (error) {
      console.error('Stok bilgisi alınamadı:', error)
      return []
    }
  }

  const filterProducts = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(query)
    )
    setFilteredProducts(filtered)
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleNextStep = async () => {
    if (step === 1) {
      if (!selectedUserId) {
        showToast('Lütfen bir kullanıcı seçin', 'error')
        return
      }
      if (selectedProducts.length === 0) {
        showToast('Lütfen en az bir ürün seçin', 'error')
        return
      }

      // Seçilen ürünlerin stok bilgilerini çek
      setLoadingData(true)
      const stocks: Record<string, WarehouseStock[]> = {}
      
      for (const productId of selectedProducts) {
        const stock = await fetchWarehouseStock(productId)
        stocks[productId] = stock
      }
      
      setWarehouseStocks(stocks)

      // Ürün detaylarını hazırla
      const details: SelectedProduct[] = selectedProducts.map(productId => {
        const product = products.find(p => p.id === productId)!
        const stock = stocks[productId]
        const firstStock = stock && stock.length > 0 ? stock[0] : null
        return {
          ...product,
          quantity: 1,
          stockType: 'new',
          warehouseId: firstStock?.warehouse_id || '',
          availableStock: firstStock ? parseFloat(firstStock.quantity.toString()) : 0
        }
      })
      
      setProductDetails(details)
      setLoadingData(false)
      setStep(2)
    }
  }

  const handlePreviousStep = () => {
    setStep(1)
  }

  const updateProductDetail = (productId: string, field: keyof SelectedProduct, value: any) => {
    setProductDetails(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = { ...p, [field]: value }
        
        // Depo değiştiğinde mevcut stoğu güncelle
        if (field === 'warehouseId') {
          const stock = warehouseStocks[productId]?.find(s => s.warehouse_id === value)
          updated.availableStock = stock?.quantity || 0
        }
        
        return updated
      }
      return p
    }))
  }

  const handleCreateZimmet = async () => {
    try {
      setLoading(true)

      // Validasyon
      for (const detail of productDetails) {
        if (detail.quantity <= 0) {
          showToast(`${detail.name} için geçerli bir miktar girin`, 'error')
          return
        }
        if (!detail.warehouseId) {
          showToast(`${detail.name} için depo seçin`, 'error')
          return
        }
        if (detail.quantity > detail.availableStock) {
          showToast(`${detail.name} için yeterli stok yok`, 'error')
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Kullanıcı bulunamadı')

      // Her ürün için zimmet oluştur
      for (const detail of productDetails) {
        // 1. Ana depodan stoğu düş
        let query = supabase
          .from('warehouse_stock')
          .select('id, quantity')
          .eq('product_id', detail.id)
          .is('user_id', null)

        // warehouse_id null olabilir, ona göre filtrele
        if (detail.warehouseId) {
          query = query.eq('warehouse_id', detail.warehouseId)
        } else {
          query = query.is('warehouse_id', null)
        }

        const { data: stockRecord, error: stockError } = await query
          .select('id, quantity, condition_breakdown')
          .single()

        if (stockError || !stockRecord) {
          console.error('Stok kaydı bulunamadı:', stockError)
          throw new Error(`${detail.name} için stok kaydı bulunamadı`)
        }

        // Condition breakdown'ı güncelle
        const conditionBreakdown = (stockRecord.condition_breakdown as any) || {}
        const stockTypeKey = detail.stockType === 'new' ? 'yeni' : 'kullanılmış'
        
        console.log(`📦 ${detail.name} - Mevcut breakdown:`, conditionBreakdown)
        console.log(`📦 Mevcut toplam quantity: ${stockRecord.quantity}`)
        console.log(`📦 Seçilen stok tipi: ${stockTypeKey}, Miktar: ${detail.quantity}`)
        
        // Seçilen durumdaki miktarı kontrol et ve düş
        const currentConditionQty = conditionBreakdown[stockTypeKey] 
          ? parseFloat(conditionBreakdown[stockTypeKey].toString()) 
          : 0
        
        if (currentConditionQty < detail.quantity) {
          throw new Error(
            `${detail.name} için yeterli "${stockTypeKey}" stok yok! ` +
            `Mevcut: ${currentConditionQty} ${detail.unit}, İstenen: ${detail.quantity} ${detail.unit}`
          )
        }
        
        // Miktarı düş
        conditionBreakdown[stockTypeKey] = Math.max(0, currentConditionQty - detail.quantity)
        
        // Yeni toplam quantity'yi breakdown'dan hesapla
        const newQuantity = Object.values(conditionBreakdown).reduce(
          (sum: number, val: any) => sum + (parseFloat(val?.toString() || '0') || 0),
          0
        )
        
        console.log(`📦 Yeni breakdown:`, conditionBreakdown)
        console.log(`📦 Yeni toplam quantity (breakdown'dan hesaplandı): ${newQuantity}`)
        console.log(`📦 Breakdown toplamı: ${Object.entries(conditionBreakdown).map(([k,v]) => `${k}:${v}`).join(', ')}`)

        const { error: updateError } = await supabase
          .from('warehouse_stock')
          .update({
            quantity: newQuantity,
            condition_breakdown: conditionBreakdown,
            last_updated: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('id', stockRecord.id)

        if (updateError) {
          console.error('Stok güncellenemedi:', updateError)
          throw new Error(`${detail.name} için stok güncellenemedi`)
        }

        console.log(`✅ ${detail.name} - Ana depodan ${detail.quantity} ${detail.unit} düşüldü (${stockTypeKey}: ${currentConditionQty} → ${conditionBreakdown[stockTypeKey]})`)

        // 2. User inventory kaydı oluştur veya güncelle
        // Önce bu kullanıcı için aynı ürün var mı kontrol et
        const { data: existingInventory } = await supabase
          .from('user_inventory')
          .select('id, quantity')
          .eq('user_id', selectedUserId)
          .eq('product_id', detail.id)
          .eq('status', 'active')
          .maybeSingle()

        if (existingInventory) {
          // Mevcut kaydı güncelle
          const updatedQuantity = parseFloat(existingInventory.quantity.toString()) + detail.quantity
          
          const { error: updateInventoryError } = await supabase
            .from('user_inventory')
            .update({
              quantity: updatedQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingInventory.id)

          if (updateInventoryError) {
            console.error('User inventory güncellenemedi:', updateInventoryError)
            throw new Error(`${detail.name} için zimmet güncellenemedi`)
          }
          
          console.log(`✅ ${detail.name} - Mevcut zimmet güncellendi (${existingInventory.quantity} → ${updatedQuantity})`)
        } else {
          // Yeni zimmet kaydı oluştur
          const { error: insertInventoryError } = await supabase
            .from('user_inventory')
            .insert({
              user_id: selectedUserId,
              product_id: detail.id,
              item_name: detail.name,
              quantity: detail.quantity,
              unit: detail.unit,
              assigned_by: user.id,
              status: 'active',
              category: detail.category,
              notes: `Manuel zimmet - ${detail.stockType === 'new' ? 'Yeni' : 'Kullanılmış'} - Depo: ${detail.warehouseId || 'Genel'}`
            })

          if (insertInventoryError) {
            console.error('User inventory kaydı oluşturulamadı:', insertInventoryError)
            throw new Error(`${detail.name} için zimmet kaydı oluşturulamadı`)
          }
          
          console.log(`✅ ${detail.name} - Yeni zimmet kaydı oluşturuldu`)
        }
      }

      showToast('Zimmet başarıyla oluşturuldu', 'success')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Zimmet oluşturma hatası:', error)
      showToast('Zimmet oluşturulamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="w-6 h-6 text-gray-700" />
            Yeni Zimmet Oluştur
          </DialogTitle>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="text-sm font-medium">Kullanıcı & Ürün Seçimi</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="text-sm font-medium">Miktar & Detaylar</span>
            </div>
          </div>
        </DialogHeader>

        {/* Step 1: User & Product Selection */}
        {step === 1 && (
          <div className="space-y-6 py-4">
            {/* User Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4" />
                Zimmet Yapılacak Kullanıcı <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-11 rounded-xl border-gray-200">
                  <SelectValue placeholder="Kullanıcı seçin..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.full_name}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Zimmet Edilecek Ürünler <span className="text-red-500">*</span>
              </Label>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Ürün ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-gray-200"
                />
              </div>

              {/* Selected Count */}
              {selectedProducts.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-gray-700" />
                  <span className="font-medium">{selectedProducts.length} ürün seçildi</span>
                </div>
              )}

              {/* Products List */}
              <div className="border border-gray-200 rounded-xl max-h-96 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Ürün bulunamadı</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        onClick={() => toggleProductSelection(product.id)}
                        className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedProducts.includes(product.id) ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedProducts.includes(product.id)
                              ? 'bg-gray-900 border-gray-900'
                              : 'border-gray-300'
                          }`}>
                            {selectedProducts.includes(product.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                              {product.total_stock !== undefined && (
                                <Badge className={`${
                                  product.total_stock > 0 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                } text-xs font-semibold`}>
                                  <Package className="w-3 h-3 mr-1" />
                                  {product.total_stock} {product.unit}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">Birim: {product.unit}</span>
                              {product.category && (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  {product.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Quantity & Details */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Stok bilgileri yükleniyor...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {productDetails.map(detail => (
                  <div key={detail.id} className="border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{detail.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">Birim: {detail.unit}</p>
                      </div>
                      {detail.availableStock > 0 ? (
                        <Badge className="bg-gray-100 text-gray-700">
                          Stok: {detail.availableStock} {detail.unit}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-200 text-gray-600">
                          Stok Yok
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Quantity */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">
                          Miktar <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={detail.availableStock}
                          value={detail.quantity}
                          onChange={(e) => updateProductDetail(detail.id, 'quantity', parseFloat(e.target.value))}
                          className="h-10 rounded-lg border-gray-200"
                        />
                      </div>

                      {/* Stock Type */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">
                          Durum <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={detail.stockType}
                          onValueChange={(value) => updateProductDetail(detail.id, 'stockType', value)}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="new">Yeni</SelectItem>
                            <SelectItem value="used">Kullanılmış</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Warehouse */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">
                          Depo <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={detail.warehouseId}
                          onValueChange={(value) => updateProductDetail(detail.id, 'warehouseId', value)}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-gray-200">
                            <SelectValue placeholder="Depo seçin" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {warehouseStocks[detail.id]?.map(stock => (
                              <SelectItem key={stock.id} value={stock.warehouse_id || ''}>
                                {stock.warehouse?.name || 'Bilinmeyen Depo'} ({stock.quantity} {detail.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Warning */}
                    {detail.quantity > detail.availableStock && (
                      <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700">
                          Girilen miktar mevcut stoktan fazla. Maksimum: {detail.availableStock} {detail.unit}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-100">
          {step === 2 && (
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              className="border-gray-200 text-gray-700 hover:bg-gray-50 h-11 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-200 text-gray-700 hover:bg-gray-50 h-11 rounded-xl"
          >
            İptal
          </Button>

          {step === 1 ? (
            <Button
              onClick={handleNextStep}
              disabled={!selectedUserId || selectedProducts.length === 0}
              className="bg-gray-900 hover:bg-gray-800 text-white h-11 rounded-xl"
            >
              İleri
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreateZimmet}
              disabled={loading || loadingData}
              className="bg-gray-900 hover:bg-gray-800 text-white h-11 rounded-xl"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Zimmet Oluştur
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
