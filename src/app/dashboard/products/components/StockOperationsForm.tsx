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
import { addStock, removeStock, transferStock, adjustStock, fetchStockByProduct } from '@/services/stock.service'
import { createClient } from '@/lib/supabase/client'
import { ArrowDown, ArrowUp, ArrowLeftRight, Edit3, UserCheck, Upload, X, FileText, UserPlus, Truck } from 'lucide-react'
import { validateImageFile } from '@/lib/utils/imageUpload'
import {
  fetchActiveZimmetsForProduct,
  fetchZimmetAvailabilityByWarehouse,
} from '@/services/zimmet.service'
import { ZimmetManagePanel } from './ZimmetManagePanel'

type OperationType = 'giriş' | 'çıkış' | 'transfer' | 'düzeltme' | 'zimmet' | 'teslim'

interface StockOperationsFormProps {
  productId: string
  productName: string
  productUnit?: string
  productSku?: string | null
  productBrand?: string | null
  productType?: string | null
  unitPrice?: string | number | null
  currency?: string | null
  /** Ürünler sayfasındaki seçili depo */
  defaultWarehouseId?: string
  onSuccess?: () => void
  /** Verilirse yalnızca bu işlemler açılır. Tek işlemde seçici gizlenir. */
  allowedOperations?: OperationType[]
  /** Verilirse depo seçimi bu depolarla sınırlıdır. */
  warehouseIds?: string[]
  /** sub: depo sorumlusunun alt zimmeti. Asıl zimmet kendisinde kalır. */
  zimmetMode?: 'primary' | 'sub'
}

function isFreeWarehouseStock(stock: { user_id?: string | null; warehouse_id?: string | null }) {
  return (stock.user_id == null || stock.user_id === undefined) && !!stock.warehouse_id
}

function isSanayiDepo(name: string) {
  return name.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ') === 'sanayi depo'
}

function defaultSourceWarehouseId(
  sites: { id: string; name: string }[] | undefined,
  qtyById: Map<string, number>
) {
  const sanayi = (sites || []).find(
    (site) => isSanayiDepo(site.name) && (qtyById.get(site.id) || 0) > 0
  )
  if (sanayi) return sanayi.id
  let bestId = ''
  let bestQty = 0
  for (const [id, qty] of qtyById) {
    if (qty > bestQty) {
      bestId = id
      bestQty = qty
    }
  }
  return bestId
}

function pickDefaultWarehouse(
  stocks: { warehouse_id?: string | null; quantity?: number | string; user_id?: string | null }[] | undefined,
  preferredId?: string
) {
  const free = (stocks || []).filter(isFreeWarehouseStock)
  if (preferredId && free.some((s) => s.warehouse_id === preferredId && Number(s.quantity) > 0)) {
    return preferredId
  }
  const withQty = [...free]
    .filter((s) => Number(s.quantity) > 0)
    .sort((a, b) => Number(b.quantity) - Number(a.quantity))
  if (withQty[0]?.warehouse_id) return withQty[0].warehouse_id
  if (preferredId) return preferredId
  return ''
}

export function StockOperationsForm({
  productId,
  productName,
  productUnit,
  productSku,
  productBrand,
  productType,
  unitPrice,
  currency,
  defaultWarehouseId,
  onSuccess,
  allowedOperations,
  warehouseIds,
  zimmetMode = 'primary',
}: StockOperationsFormProps) {
  const queryClient = useQueryClient()
  const [operationType, setOperationType] = useState<OperationType>('giriş')
  const [formData, setFormData] = useState({
    warehouse_id: '',
    source_warehouse_id: '',
    to_warehouse_id: '', // Transfer için
    supplier_name: '', // Tedarikçi firma adı (sadece giriş için)
    product_condition: 'yeni' as 'yeni' | 'kullanılmış' | 'arızalı' | 'hek', // Ürün durumu (sadece giriş için)
    assigned_to: '', // Zimmet alan (sadece transfer için)
    quantity: '',
    serial_number: '', // Stok girişinde ürün seri no(ları); virgülle çoklu
    unit_price: '', // Birim fiyat (sadece giriş için)
    currency: 'TRY', // Para birimi (sadece giriş için)
    reason: '',
  })
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string>('')
  const [warehouseTouched, setWarehouseTouched] = useState(false)

  const { data: activeZimmets = [], isLoading: isLoadingActiveZimmets, refetch: refetchActiveZimmets } = useQuery({
    queryKey: ['product-active-zimmets', productId],
    queryFn: () => fetchActiveZimmetsForProduct(productId),
    enabled: !!productId && operationType === 'zimmet',
  })

  const {
    data: zimmetAvailability = [],
    isLoading: isLoadingZimmetAvailability,
    refetch: refetchZimmetAvailability,
  } = useQuery({
    queryKey: ['product-zimmet-availability', productId],
    queryFn: () => fetchZimmetAvailabilityByWarehouse(productId),
    enabled: !!productId && operationType === 'zimmet',
  })

  const selectedWarehouseAvailability = zimmetAvailability.find(
    (row) => row.warehouseId === formData.warehouse_id
  )

  const handleZimmetPanelChanged = async () => {
    await Promise.all([refetchActiveZimmets(), refetchZimmetAvailability()])
    queryClient.invalidateQueries({ queryKey: ['product-stock', productId] })
    queryClient.invalidateQueries({ queryKey: ['stock-movements', productId] })
    queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] })
    onSuccess?.()
  }

  // Şantiyeleri çek
  const { data: sites, isLoading: isLoadingSites } = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  })

  const { data: productStocks } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: () => fetchStockByProduct(productId),
    enabled: !!productId,
  })

  const selectedWarehouseQty = (productStocks || [])
    .filter(
      (s) =>
        isFreeWarehouseStock(s) &&
        s.warehouse_id === formData.warehouse_id
    )
    .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)

  const existingStockWarehouses = (productStocks || []).filter(
    (s) => isFreeWarehouseStock(s) && Number(s.quantity) > 0
  )

  const qtyEntered = parseFloat(formData.quantity)
  const resultingQty =
    operationType === 'giriş' && Number.isFinite(qtyEntered)
      ? selectedWarehouseQty + qtyEntered
      : operationType === 'çıkış' && Number.isFinite(qtyEntered)
        ? selectedWarehouseQty - qtyEntered
        : operationType === 'düzeltme' && Number.isFinite(qtyEntered)
          ? qtyEntered
          : null

  const warehouseQtyById = new Map<string, number>()
  for (const s of productStocks || []) {
    if (!isFreeWarehouseStock(s) || !s.warehouse_id) continue
    warehouseQtyById.set(
      s.warehouse_id,
      (warehouseQtyById.get(s.warehouse_id) || 0) + (Number(s.quantity) || 0)
    )
  }

  // Çalışanları çek (employees tablosundan)
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, work_email')
        .order('first_name')
      
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

  const writeTeslimReport = async (input: {
    employee: { first_name: string | null; work_email: string | null }
    quantity: number
    sourceId: string
    destinationId: string
  }) => {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    let exportedByDisplayName = user?.email ?? '—'
    let exportedByEmail = user?.email ?? undefined
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.full_name?.trim()) exportedByDisplayName = profile.full_name.trim()
      else if (profile?.email) exportedByDisplayName = profile.email
      exportedByEmail = profile?.email || user.email || undefined
    }

    const sourceName = sites?.find((site) => site.id === input.sourceId)?.name || 'Depo'
    const destination = sites?.find((site) => site.id === input.destinationId)?.name || 'Depo'
    const person = (input.employee.first_name || '').trim() || 'Teslim alan'
    const price = unitPrice == null || unitPrice === '' ? null : Number(unitPrice)
    const payload = {
      docTitleSuffix: `Teslim raporu — ${person}`,
      titleMain: 'TESLİM RAPORU',
      titleSub: 'Depodan teslim tutanağı.',
      assignedPersonName: person,
      assignedPersonEmailLine: input.employee.work_email || '',
      exportedByDisplayName,
      exportedByEmail,
      generatedAtLabel: new Date().toLocaleString('tr-TR'),
      warehouseScopeLine: `Teslim deposu: ${destination}`,
      rowCountNote: '1 ürün teslim edilmiştir',
      rows: [
        {
          productName,
          sku: productSku || '',
          brand: productBrand || '',
          unit: productUnit || 'adet',
          quantity: input.quantity,
          unitPrice: price != null && Number.isFinite(price) ? price : null,
          currency: currency || 'TRY',
          productType: productType || '',
          sourceWarehouse: sourceName === destination ? destination : `${sourceName} → ${destination}`,
          serialNumber: '',
        },
      ],
      heading: 'Teslim edilen ürünler',
      signLeftRole: 'Teslim eden',
      signRightRole: 'Teslim alan',
      signRightNote: 'Ürünleri teslim aldım.',
      footerNote: 'Teslim raporu — Satın Alma / Envanter — Dovec',
      declaration:
        'İşbu rapor ile yukarıda dökümü verilen malzeme ve ürünleri eksiksiz teslim aldığımı beyan ederim.',
    }

    try {
      const { downloadZimmetAssignmentListPdf } = await import('@/lib/pdf/zimmetAssignmentListPdf')
      const { recordZimmetOperation } = await import('@/services/zimmet-operations.service')
      await recordZimmetOperation({
        operationType: 'delivery',
        personName: person,
        personEmail: input.employee.work_email,
        siteId: input.destinationId,
        snapshot: payload,
      })
      await downloadZimmetAssignmentListPdf(payload)
      return false
    } catch (error) {
      console.error('Teslim raporu oluşturulamadı:', error)
      return true
    }
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
            invoiceFiles,
            data.serial_number?.trim() || undefined
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
        case 'zimmet':
        case 'teslim': {
          if (!data.assigned_to) {
            throw new Error(
              operationType === 'teslim'
                ? 'Lütfen teslim alacak kişiyi seçin'
                : 'Lütfen zimmet alacak kullanıcıyı seçin'
            )
          }
          if (!data.warehouse_id) {
            throw new Error('Lütfen depo seçin')
          }

          const selectedEmployee = employees?.find((e) => e.id === data.assigned_to)
          if (!selectedEmployee) {
            throw new Error('Seçilen çalışan bulunamadı')
          }

          const quantity = parseFloat(data.quantity)
          const isSubZimmet = operationType === 'zimmet' && zimmetMode === 'sub'

          if (!isSubZimmet) {
            const sourceId = data.source_warehouse_id || data.warehouse_id
            if (sourceId !== data.warehouse_id) {
              const sourceName =
                sites?.find((site) => site.id === sourceId)?.name || 'Kaynak depo'
              const destName =
                sites?.find((site) => site.id === data.warehouse_id)?.name || 'Hedef depo'
              const { transferStockIntoOperatedWarehouse } = await import('@/services/stock.service')
              await transferStockIntoOperatedWarehouse(
                productId,
                sourceId,
                data.warehouse_id,
                quantity,
                `${operationType === 'teslim' ? 'Teslim' : 'Zimmet'}: ${sourceName} → ${destName}`
              )
            }
          }

          if (operationType === 'zimmet') {
            const { assignZimmetInWarehouse, assignSubZimmet } = await import('@/services/zimmet.service')
            const assign = isSubZimmet ? assignSubZimmet : assignZimmetInWarehouse
            await assign({
              productId,
              productName,
              productUnit,
              warehouseId: data.warehouse_id,
              quantity,
              employee: selectedEmployee,
              reason: data.reason,
              serialNumber: data.serial_number || undefined,
            })
            return { success: true }
          }

          const pdfFailed = await writeTeslimReport({
            employee: selectedEmployee,
            quantity,
            sourceId: data.source_warehouse_id || data.warehouse_id,
            destinationId: data.warehouse_id,
          })
          return { success: true, pdfFailed }
        }
        default:
          throw new Error('Geçersiz işlem tipi')
      }
    },
    onSuccess: (result) => {
      // Cache'i güncelle
      queryClient.invalidateQueries({ queryKey: ['product-stock', productId] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
      queryClient.invalidateQueries({ queryKey: ['product-stats'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-active-zimmets', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-zimmet-availability', productId] })
      
      // Success mesajı
      const pdfFailed =
        !!result && typeof result === 'object' && 'pdfFailed' in result && result.pdfFailed === true
      alert(
        pdfFailed
          ? 'Teslim kaydı oluştu ancak PDF indirilemedi. İşlem geçmişinden yeniden alabilirsiniz.'
          : operationType === 'teslim'
            ? '✅ Teslim tamamlandı. Teslim raporu indirildi.'
            : operationType === 'zimmet' && zimmetMode === 'sub'
              ? '✅ Alt zimmet kaydı oluşturuldu. Asıl zimmet depo sorumlusunda kaldı.'
              : `✅ Stok ${operationType} işlemi başarıyla tamamlandı!`
      )
      
      setWarehouseTouched(false)
      setFormData({
        warehouse_id: '',
        source_warehouse_id: '',
        to_warehouse_id: '',
        supplier_name: '',
        product_condition: 'yeni',
        assigned_to: '',
        quantity: '',
        serial_number: '',
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

    if (allowedOperations?.length && !allowedOperations.includes(operationType)) {
      alert('Bu işlem için yetkiniz yok')
      return
    }

    if (warehouseIds?.length && !warehouseIds.includes(formData.warehouse_id)) {
      alert('Yalnızca yetkili olduğunuz depoya giriş yapabilirsiniz')
      return
    }
    
    // Validasyon
    if (!formData.warehouse_id) {
      alert('Lütfen depo seçin')
      return
    }
    
    if (operationType === 'transfer' && !formData.to_warehouse_id) {
      alert('Lütfen hedef depo seçin')
      return
    }
    
    if ((operationType === 'zimmet' || operationType === 'teslim') && !formData.assigned_to) {
      alert(operationType === 'teslim' ? 'Lütfen teslim alacak kişiyi seçin' : 'Lütfen zimmet alacak kullanıcıyı seçin')
      return
    }
    
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('Lütfen geçerli bir miktar girin')
      return
    }

    const movesFromSource =
      (operationType === 'teslim' || (operationType === 'zimmet' && zimmetMode !== 'sub'))
    if (movesFromSource) {
      const sourceId = formData.source_warehouse_id
      if (!sourceId) {
        alert('Lütfen kaynak depo seçin')
        return
      }
      const avail = zimmetAvailability.find((r) => r.warehouseId === sourceId)
      const shelfQty = warehouseQtyById.get(sourceId) || 0
      const availableQty = avail ? avail.availableQty : shelfQty
      const qty = parseFloat(formData.quantity)
      if (availableQty <= 0) {
        alert('Kaynak depoda boş stok yok')
        return
      }
      if (qty > availableQty) {
        alert(
          `Kaynak depodaki boş stok en fazla ${availableQty.toLocaleString('tr-TR')} ${productUnit || 'adet'}`
        )
        return
      }
    }
    
    stockMutation.mutate(formData)
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // İşlem tipi değişince formu temizle
  useEffect(() => {
    setWarehouseTouched(false)
    setFormData({
      warehouse_id: '',
      source_warehouse_id: '',
      to_warehouse_id: '',
      supplier_name: '',
      product_condition: 'yeni',
      assigned_to: '',
      quantity: '',
      serial_number: '',
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

  useEffect(() => {
    const movesFromSource =
      operationType === 'teslim' || (operationType === 'zimmet' && zimmetMode !== 'sub')
    if (operationType === 'zimmet' && zimmetMode === 'sub') return
    if (warehouseTouched && warehouseIds?.length !== 1) return
    const preferred = warehouseIds?.length === 1 ? warehouseIds[0] : defaultWarehouseId
    if (movesFromSource) {
      if (!preferred) return
      if (warehouseIds?.length && !warehouseIds.includes(preferred)) return
      setFormData((prev) =>
        prev.warehouse_id === preferred ? prev : { ...prev, warehouse_id: preferred }
      )
      return
    }
    const picked = pickDefaultWarehouse(productStocks, preferred)
    if (!picked) return
    if (warehouseIds?.length && !warehouseIds.includes(picked)) return
    setFormData((prev) =>
      prev.warehouse_id === picked ? prev : { ...prev, warehouse_id: picked }
    )
  }, [operationType, zimmetMode, warehouseTouched, productStocks, defaultWarehouseId, warehouseIds])

  useEffect(() => {
    const movesFromSource =
      operationType === 'teslim' || (operationType === 'zimmet' && zimmetMode !== 'sub')
    if (!movesFromSource || !sites?.length) return
    const picked = defaultSourceWarehouseId(sites, warehouseQtyById)
    if (!picked) return
    setFormData((prev) =>
      prev.source_warehouse_id ? prev : { ...prev, source_warehouse_id: picked }
    )
  }, [operationType, zimmetMode, sites, productStocks])

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
      color: 'from-primary-600 to-primary-500',
      label: 'Stok Transferi',
      quantityLabel: 'Transfer Miktarı',
    },
    düzeltme: {
      icon: Edit3,
      color: 'from-orange-600 to-orange-500',
      label: 'Stok Düzeltme',
      quantityLabel: 'Yeni Miktar',
    },
    zimmet: {
      icon: UserPlus,
      color: 'from-purple-600 to-purple-500',
      label: 'Zimmet Ver',
      quantityLabel: 'Zimmet Miktarı',
    },
    teslim: {
      icon: Truck,
      color: 'from-neutral-800 to-neutral-950',
      label: 'Teslim Et',
      quantityLabel: 'Teslim Miktarı',
    },
  }

  const config = operationConfig[operationType]
  const OperationIcon = config.icon
  const enabledOperations: OperationType[] =
    allowedOperations && allowedOperations.length > 0
      ? allowedOperations
      : (Object.keys(operationConfig) as OperationType[])
  const visibleSites = (sites || []).filter(
    (site) => !warehouseIds?.length || warehouseIds.includes(site.id)
  )
  const warehouseLocked = warehouseIds?.length === 1

  return (
    <div className="space-y-6">
      {enabledOperations.length === 1 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">{operationConfig[enabledOperations[0]].label}</p>
          <p className="text-xs text-gray-500 mt-1">Yalnızca kendi deponuza stok girişi yapabilirsiniz.</p>
        </div>
      ) : (
      <div className={`grid gap-2 p-2 bg-gray-100 rounded-2xl ${enabledOperations.length <= 2 ? 'grid-cols-2' : enabledOperations.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'}`}>
        {enabledOperations.map((type) => {
          const Icon = operationConfig[type].icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => setOperationType(type)}
              className={`
        flex flex-col items-center gap-2 p-3 rounded-xl transition-all
                ${
                  operationType === type
                    ? 'bg-white shadow-sm text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">
                {zimmetMode === 'sub' && type === 'zimmet' ? 'Alt Zimmet' : type}
              </span>
            </button>
          )
        })}
      </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Ürün Bilgisi */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200/50">
          <Label className="text-xs font-medium text-gray-500">Ürün</Label>
          <p className="text-lg font-semibold text-gray-900 mt-1">{productName}</p>
        </div>

        {operationType === 'zimmet' && zimmetMode === 'sub' && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-sm font-semibold text-gray-900">Alt zimmet</p>
            <p className="text-xs text-gray-500 mt-1">
              Asıl zimmet depo sorumlusunda kalır. Seçilen kullanıcıya ayrı bir alt zimmet yazılır. Depo stoğu değişmez.
            </p>
          </div>
        )}

        {operationType === 'zimmet' && zimmetMode !== 'sub' && (
          <ZimmetManagePanel
            productId={productId}
            productUnit={productUnit || 'adet'}
            zimmets={activeZimmets}
            loading={isLoadingActiveZimmets}
            onChanged={handleZimmetPanelChanged}
            compact
          />
        )}

        {(operationType === 'teslim' || (operationType === 'zimmet' && zimmetMode !== 'sub')) && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-sm font-semibold text-gray-900">
              {operationType === 'teslim' ? 'Teslim' : 'Zimmet'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Kaynak depo varsayılan olarak Sanayi Depo seçilir. Ürün başka depodaysa seçilen{' '}
              {operationType === 'teslim' ? 'teslim' : 'zimmet'} deposuna aktarılır.
            </p>
          </div>
        )}

        {(operationType === 'teslim' || (operationType === 'zimmet' && zimmetMode !== 'sub')) && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="source_warehouse_id" className="text-xs font-medium text-gray-500">
              Kaynak depo *
            </Label>
            <Select
              value={formData.source_warehouse_id || 'none'}
              onValueChange={(value) => handleChange('source_warehouse_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                <SelectValue placeholder="Kaynak depo seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kaynak depo seçin</SelectItem>
                {(sites || [])
                  .filter((site) => (warehouseQtyById.get(site.id) || 0) > 0 || site.id === formData.source_warehouse_id)
                  .map((site) => {
                    const avail = zimmetAvailability.find((row) => row.warehouseId === site.id)
                    const free = avail ? avail.availableQty : warehouseQtyById.get(site.id) || 0
                    return (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} · {free.toLocaleString('tr-TR')} {productUnit || 'adet'}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Depo */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <Label htmlFor="warehouse_id" className="text-xs font-medium text-gray-500">
            {operationType === 'transfer'
              ? 'Kaynak Depo *'
              : operationType === 'teslim'
                ? 'Teslim deposu *'
                : operationType === 'zimmet' && zimmetMode !== 'sub'
                  ? 'Zimmet deposu *'
                  : operationType === 'zimmet'
                    ? 'Zimmet Edilecek Depo *'
                    : 'Depo *'}
          </Label>
            <Select
            value={formData.warehouse_id || 'none'}
            disabled={warehouseLocked}
            onValueChange={(value) => {
              if (warehouseLocked) return
              setWarehouseTouched(true)
              handleChange('warehouse_id', value === 'none' ? '' : value)
            }}
          >
            <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
              <SelectValue placeholder="Depo seçin" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">Depo seçin</SelectItem>
              {operationType === 'zimmet'
                ? zimmetAvailability.map((row) => (
                    <SelectItem key={row.warehouseId} value={row.warehouseId}>
                      {row.warehouseName} — {row.availableQty.toLocaleString('tr-TR')} zimmetlenebilir
                    </SelectItem>
                  ))
                : visibleSites.map((site) => {
                    const qty = warehouseQtyById.get(site.id) || 0
                    return (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                        {qty > 0 ? ` — ${qty.toLocaleString('tr-TR')} ${productUnit || 'adet'}` : ''}
                      </SelectItem>
                    )
                  })}
            </SelectContent>
          </Select>
          {operationType === 'zimmet' && selectedWarehouseAvailability && (
            <p className="mt-2 text-xs text-gray-600">
              Seçili depoda{' '}
              <span className="font-semibold text-emerald-700">
                {selectedWarehouseAvailability.availableQty.toLocaleString('tr-TR')}{' '}
                {productUnit || 'adet'}
              </span>{' '}
              zimmetlenebilir
              <span className="text-gray-400">
                {' '}
                (stok {selectedWarehouseAvailability.stockQty.toLocaleString('tr-TR')}, zimmetli{' '}
                {selectedWarehouseAvailability.zimmetQty.toLocaleString('tr-TR')})
              </span>
            </p>
          )}
          {operationType !== 'zimmet' && formData.warehouse_id && (
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 space-y-1">
              <p className="text-xs text-gray-600">
                Bu depoda mevcut stok:{' '}
                <span className="font-semibold text-gray-900">
                  {selectedWarehouseQty.toLocaleString('tr-TR')} {productUnit || 'adet'}
                </span>
                {resultingQty != null && qtyEntered > 0 && (
                  <>
                    {' '}
                    → işlem sonrası{' '}
                    <span className="font-semibold text-gray-900">
                      {resultingQty.toLocaleString('tr-TR')} {productUnit || 'adet'}
                    </span>
                  </>
                )}
              </p>
              {operationType === 'giriş' &&
                selectedWarehouseQty <= 0 &&
                existingStockWarehouses.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Bu depoda stok yok. Mevcut stok{' '}
                    {existingStockWarehouses
                      .map((s) => {
                        const name =
                          (Array.isArray(s.warehouse) ? s.warehouse[0] : s.warehouse)?.name ||
                          'Depo'
                        return `${name} (${Number(s.quantity).toLocaleString('tr-TR')})`
                      })
                      .join(', ')}
                    . Farklı depoya giriş yeni bir depo kartı açar.
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Hedef Depo (Sadece Transfer için) */}
        {operationType === 'transfer' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="to_warehouse_id" className="text-xs font-medium text-gray-500">
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

        {/* Zimmet Alan (Transfer ve Zimmet için) */}
        {(operationType === 'transfer' || operationType === 'zimmet' || operationType === 'teslim') && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="assigned_to" className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              {operationType === 'teslim'
                ? 'Teslim alacak kişi *'
                : operationType === 'zimmet'
                  ? zimmetMode === 'sub'
                    ? 'Alt zimmet verilecek kullanıcı *'
                    : 'Zimmet Alacak Kullanıcı *'
                  : 'Zimmet Alan (Opsiyonel)'}
            </Label>
            <Select
              value={formData.assigned_to || 'none'}
              onValueChange={(value) => handleChange('assigned_to', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl">
                <SelectValue placeholder="Çalışan seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {operationType === 'transfer' && <SelectItem value="none">Zimmet yok</SelectItem>}
                {employees?.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    <div className="flex flex-col">
                      <span>{employee.first_name}</span>
                      <span className="text-xs text-gray-500">{employee.work_email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tedarikçi Firma (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="supplier_name" className="text-xs font-medium text-gray-500">
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
            <Label htmlFor="product_condition" className="text-xs font-medium text-gray-500">
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
                    <span className="w-2 h-2 rounded-full bg-primary-500"></span>
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

        {/* Seri numarası (sadece stok girişi) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="serial_number" className="text-xs font-medium text-gray-500">
              Seri numarası (Opsiyonel)
            </Label>
            <Input
              id="serial_number"
              value={formData.serial_number}
              onChange={(e) => handleChange('serial_number', e.target.value)}
              placeholder="Örn: SN-2024-001 veya birden fazla için virgülle ayırın"
              className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-2">
              Bu giriş hareketi kaydına yazılır; geçmiş sekmesinden görüntülenebilir.
            </p>
          </div>
        )}

        {/* Birim Fiyat (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="unit_price" className="text-xs font-medium text-gray-500">
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
          <Label htmlFor="quantity" className="text-xs font-medium text-gray-500">
            {config.quantityLabel} *
          </Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0"
            max={
              operationType === 'zimmet' && selectedWarehouseAvailability
                ? selectedWarehouseAvailability.availableQty
                : undefined
            }
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            placeholder="0.00"
            className="mt-2 border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl text-lg font-semibold"
            required
          />
          {operationType === 'zimmet' && selectedWarehouseAvailability && (
            <p className="mt-2 text-xs text-gray-500">
              En fazla{' '}
              <span className="font-semibold text-gray-800">
                {selectedWarehouseAvailability.availableQty.toLocaleString('tr-TR')}{' '}
                {productUnit || 'adet'}
              </span>{' '}
              girebilirsiniz.
            </p>
          )}
        </div>

        {/* Fatura/Fiş Yükleme (Sadece Stok Girişi için) */}
        {operationType === 'giriş' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <Label htmlFor="invoice" className="text-xs font-medium text-gray-500 mb-3 block">
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
                        className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-400 text-black rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* PDF Badge */}
                      {file.type === 'application/pdf' && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-black text-xs font-bold rounded">
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
          <Label htmlFor="reason" className="text-xs font-medium text-gray-500">
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

