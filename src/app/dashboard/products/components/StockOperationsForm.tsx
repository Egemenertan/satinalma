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
import { ArrowDown, ArrowUp, ArrowLeftRight, Edit3, UserCheck, Upload, X, FileText } from 'lucide-react'
import { validateImageFile } from '@/lib/utils/imageUpload'

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
    unit_price: '', // Birim fiyat (sadece giriş için)
    currency: 'TRY', // Para birimi (sadece giriş için)
    reason: '',
  })
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string>('')

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

  // Fatura dosyası ekleme
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadError('')

    // Her dosyayı kontrol et
    for (const file of files) {
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setUploadError(validation.error || 'Geçersiz dosya')
        return
      }
    }

    // Önizleme URL'leri oluştur
    const newPreviewUrls = files.map((file) => {
      if (file.type.startsWith('image/')) {
        return URL.createObjectURL(file)
      }
      return '' // PDF için önizleme yok
    })

    setInvoiceFiles((prev) => [...prev, ...files])
    setPreviewUrls((prev) => [...prev, ...newPreviewUrls])
  }

  // Dosya silme
  const removeFile = (index: number) => {
    // Önizleme URL'ini temizle (memory leak önleme)
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index])
    }
    
    setInvoiceFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

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
            data.product_condition,
            data.unit_price ? parseFloat(data.unit_price) : undefined,
            data.currency || 'TRY',
            invoiceFiles
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
        unit_price: '',
        currency: 'TRY',
        reason: '',
      })
      // Önizleme URL'lerini temizle
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
      setInvoiceFiles([])
      setPreviewUrls([])
      setUploadError('')
      
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
      unit_price: '',
      currency: 'TRY',
      reason: '',
    })
    setInvoiceFiles([])
    setPreviewUrls([])
    setUploadError('')
    
    // Cleanup function - önizleme URL'lerini temizle
    return () => {
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        {/* Birim Fiyat (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="unit_price" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Birim Fiyat (Opsiyonel)
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={(e) => handleChange('unit_price', e.target.value)}
                placeholder="0.00"
                className="flex-1 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl"
              />
              <Select
                value={formData.currency}
                onValueChange={(value) => handleChange('currency', value)}
              >
                <SelectTrigger className="w-24 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

        {/* Fatura/Fiş Yükleme (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="invoice" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
              Fatura/Fiş (Opsiyonel)
            </Label>
            
            <div className="space-y-3">
              {/* Upload Button */}
              <label 
                htmlFor="invoice-upload"
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600 font-medium">
                  Fatura veya Fiş Yükle
                </span>
                <input
                  id="invoice-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Error Message */}
              {uploadError && (
                <p className="text-xs text-red-600 font-medium">{uploadError}</p>
              )}

              {/* Preview Files */}
              {invoiceFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {invoiceFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                    >
                      {/* Önizleme veya Icon */}
                      <div className="aspect-video bg-gray-100 flex items-center justify-center">
                        {previewUrls[index] ? (
                          <img
                            src={previewUrls[index]}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                      
                      {/* Dosya Bilgisi */}
                      <div className="p-3">
                        <p className="text-xs font-medium text-gray-700 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>

                      {/* Silme Butonu */}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* PDF Badge */}
                      {file.type === 'application/pdf' && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                          PDF
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                JPG, PNG, WebP veya PDF • Maksimum 5MB • Birden fazla dosya yüklenebilir
              </p>
            </div>
          </div>
        )}

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

