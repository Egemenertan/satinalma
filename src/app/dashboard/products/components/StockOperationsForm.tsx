/**
 * StockOperationsForm Component
 * Stok Giriş, Çıkış, Transfer ve Düzeltme işlemleri
 */

'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSites } from '@/services/sites.service'
import { addStock, removeStock, transferStock, adjustStock } from '@/services/stock.service'
import { createClient } from '@/lib/supabase/client'
import { ArrowDown, ArrowUp, ArrowLeftRight, Edit3, UserCheck } from 'lucide-react'

type OperationType = 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'

interface StockOperationsFormProps {
  productId: string
  productName: string
  onSuccess?: () => void
}

export function StockOperationsForm({ productId, productName, onSuccess }: StockOperationsFormProps) {
  const queryClient = useQueryClient()
  const [operationType, setOperationType] = useState<OperationType>('giriş')
  const [formData, setFormData] = useState({
    warehouse_id: '',
    to_warehouse_id: '', // Transfer için
    supplier_name: '', // Tedarikçi firma adı (sadece giriş için)
    product_condition: 'yeni' as 'yeni' | 'kullanılmış' | 'arızalı' | 'hek', // Ürün durumu (sadece giriş için)
    assigned_to: '', // Zimmet alan (sadece transfer için)
    quantity: '',
    reason: '',
  })

  // Şantiyeleri çek
  const { data: sites, isLoading: isLoadingSites } = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  })

  // Çalışanları çek (profiles tablosundan)
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name')
      
      if (error) throw error
      return data
    },
  })

  // Mutation'lar
  const stockMutation = useMutation({
    mutationFn: async (data: any) => {
      switch (operationType) {
        case 'giriş':
          return await addStock(
            productId,
            data.warehouse_id,
            parseFloat(data.quantity),
            data.reason,
            undefined,
            data.supplier_name || undefined,
            data.product_condition
          )
        case 'çıkış':
          return await removeStock(
            productId,
            data.warehouse_id,
            parseFloat(data.quantity),
            data.reason
          )
        case 'transfer':
          return await transferStock(
            productId,
            data.warehouse_id,
            data.to_warehouse_id,
            parseFloat(data.quantity),
            data.reason,
            data.assigned_to || undefined
          )
        case 'düzeltme':
          return await adjustStock(
            productId,
            data.warehouse_id,
            parseFloat(data.quantity),
            data.reason
          )
        default:
          throw new Error('Geçersiz işlem tipi')
      }
    },
    onSuccess: () => {
      // Cache'i güncelle
      queryClient.invalidateQueries({ queryKey: ['product-stock', productId] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements', productId] })
      
      // Success mesajı
      alert(`✅ Stok ${operationType} işlemi başarıyla tamamlandı!`)
      
      // Formu sıfırla
      setFormData({
        warehouse_id: '',
        to_warehouse_id: '',
        supplier_name: '',
        product_condition: 'yeni',
        assigned_to: '',
        quantity: '',
        reason: '',
      })
      
      onSuccess?.()
    },
    onError: (error: any) => {
      console.error('Stock operation error:', error)
      alert(`❌ Hata: ${error.message || 'Stok işlemi başarısız oldu'}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasyon
    if (!formData.warehouse_id) {
      alert('Lütfen depo seçin')
      return
    }
    
    if (operationType === 'transfer' && !formData.to_warehouse_id) {
      alert('Lütfen hedef depo seçin')
      return
    }
    
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('Lütfen geçerli bir miktar girin')
      return
    }
    
    stockMutation.mutate(formData)
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // İşlem tipi değişince formu temizle
  useEffect(() => {
    setFormData({
      warehouse_id: '',
      to_warehouse_id: '',
      supplier_name: '',
      product_condition: 'yeni',
      assigned_to: '',
      quantity: '',
      reason: '',
    })
  }, [operationType])

  const operationConfig = {
    giriş: {
      icon: ArrowDown,
      color: 'from-green-600 to-green-500',
      label: 'Stok Girişi',
      quantityLabel: 'Giriş Miktarı',
    },
    çıkış: {
      icon: ArrowUp,
      color: 'from-red-600 to-red-500',
      label: 'Stok Çıkışı',
      quantityLabel: 'Çıkış Miktarı',
    },
    transfer: {
      icon: ArrowLeftRight,
      color: 'from-blue-600 to-blue-500',
      label: 'Stok Transferi',
      quantityLabel: 'Transfer Miktarı',
    },
    düzeltme: {
      icon: Edit3,
      color: 'from-orange-600 to-orange-500',
      label: 'Stok Düzeltme',
      quantityLabel: 'Yeni Miktar',
    },
  }

  const config = operationConfig[operationType]
  const OperationIcon = config.icon

  return (
    <div className="space-y-6">
      {/* İşlem Tipi Seçimi - Apple Style Tabs */}
      <div className="grid grid-cols-4 gap-2 p-2 bg-gray-100 rounded-2xl">
        {(Object.keys(operationConfig) as OperationType[]).map((type) => {
          const Icon = operationConfig[type].icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => setOperationType(type)}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                ${
                  operationType === type
                    ? 'bg-white shadow-sm text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm capitalize">{type}</span>
            </button>
          )
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Ürün Bilgisi */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200/50">
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün</Label>
          <p className="text-lg font-semibold text-gray-900 mt-1">{productName}</p>
        </div>

        {/* Kaynak Depo */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="warehouse_id" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {operationType === 'transfer' ? 'Kaynak Depo *' : 'Depo *'}
          </Label>
          <Select
            value={formData.warehouse_id || 'none'}
            onValueChange={(value) => handleChange('warehouse_id', value === 'none' ? '' : value)}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue placeholder="Depo seçin" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">Depo seçin</SelectItem>
              {sites?.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hedef Depo (Sadece Transfer için) */}
        {operationType === 'transfer' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="to_warehouse_id" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Hedef Depo *
            </Label>
            <Select
              value={formData.to_warehouse_id || 'none'}
              onValueChange={(value) => handleChange('to_warehouse_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                <SelectValue placeholder="Hedef depo seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Hedef depo seçin</SelectItem>
                {sites
                  ?.filter((site) => site.id !== formData.warehouse_id)
                  .map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Zimmet Alan (Sadece Transfer için) */}
        {operationType === 'transfer' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="assigned_to" className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Zimmet Alan (Opsiyonel)
            </Label>
            <Select
              value={formData.assigned_to || 'none'}
              onValueChange={(value) => handleChange('assigned_to', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                <SelectValue placeholder="Çalışan seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Zimmet yok</SelectItem>
                {employees?.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tedarikçi Firma (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="supplier_name" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Tedarikçi Firma (Opsiyonel)
            </Label>
            <Input
              id="supplier_name"
              value={formData.supplier_name}
              onChange={(e) => handleChange('supplier_name', e.target.value)}
              placeholder="Örn: ABC Tedarik A.Ş."
              className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
            />
          </div>
        )}

        {/* Ürün Durumu (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="product_condition" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Ürün Durumu *
            </Label>
            <Select
              value={formData.product_condition}
              onValueChange={(value) => handleChange('product_condition', value)}
            >
              <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yeni">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Yeni
                  </span>
                </SelectItem>
                <SelectItem value="kullanılmış">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Kullanılmış
                  </span>
                </SelectItem>
                <SelectItem value="hek">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    HEK
                  </span>
                </SelectItem>
                <SelectItem value="arızalı">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Arızalı
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Miktar */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="quantity" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {config.quantityLabel} *
          </Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0"
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            placeholder="0.00"
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl text-lg font-semibold"
            required
          />
        </div>

        {/* Açıklama */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="reason" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {operationType === 'düzeltme' ? 'Düzeltme Nedeni *' : 'Açıklama (Opsiyonel)'}
          </Label>
          <Textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Giriş nedeni veya açıklama..."
            rows={3}
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl resize-none"
            required={operationType === 'düzeltme'}
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={stockMutation.isPending || isLoadingSites}
          className={`
            w-full py-6 rounded-full font-medium text-lg shadow-lg hover:shadow-xl transition-all
            bg-gradient-to-r ${config.color} text-white
          `}
        >
          <OperationIcon className="w-5 h-5 mr-2" />
          {stockMutation.isPending
            ? 'İşleniyor...'
            : `${config.label} Yap`}
        </Button>
      </form>
    </div>
  )
}

