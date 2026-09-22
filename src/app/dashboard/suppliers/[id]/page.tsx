'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/auth'
const supabase = createClient()
import { useToast } from '@/components/ui/toast'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import { SupplierContractsPanel } from '@/components/contracts/SupplierContractsPanel'
import { 
  Star,
  Calendar,
  FileText,
  Package,
  ArrowLeft,
  Image,
  Eye,
  Receipt,
  Camera,
  Upload,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface Order {
  id: string
  created_at: string
  updated_at: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'delivered'
  amount: number
  currency: string
  delivery_date: string
  supplier_id: string
  purchase_request_id: string
  document_urls: string[]
  delivery_receipt_photos?: string[]
  delivery_image_urls?: string[]
  delivered_at?: string
  delivery_notes?: string
  purchase_requests?: {
    request_number: string
    title: string
    material_item_name: string | null
    total_amount: number
    currency: string | null
  }[]
  invoices?: {
    id: string
    amount: number
    currency: string
    invoice_photos: string[]
    created_at: string
  }[]
  delivery_summary?: {
    last_delivery_at: string | null
    delivery_percentage: number | null
    delivery_status: 'pending' | 'partial' | 'completed' | string
    delivery_count: number | null
    total_delivered: number | null
    remaining_quantity: number | null
  } | null
}

interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  tax_number: string
  payment_terms: number
  rating: number
  is_approved: boolean
  created_at: string
  updated_at: string
}

interface SupplierMaterial {
  id: string
  supplier_id: string
  material_class: string
  material_group: string
  material_item: string
  price_range_min?: number
  price_range_max?: number
  currency?: string
  delivery_time_days?: number
  minimum_order_quantity?: number
  is_preferred?: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  console.log('🚀 Component yükleniyor - params:', params)

  const router = useRouter()
  const { showToast } = useToast()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [materials, setMaterials] = useState<SupplierMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  
  // Image viewer state
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  // Invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceCurrency, setInvoiceCurrency] = useState('TRY')
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([])
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false)
  
  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  
  // Report generation state
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null)

  // Erişim kontrolü
  useEffect(() => {
    const checkAccess = async () => {
      const user = await getSessionUser(supabase)

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Kullanıcının site_id'sini kontrol et
      const { data: profile } = await supabase
        .from('profiles')
        .select('site_id')
        .eq('id', user.id)
        .single()

      const restrictedSiteId = 'f7f3d36e-0c31-4e9a-8883-94c39330660b'
      
      if (profile?.site_id) {
        const siteIds = Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id]
        
        // Eğer kullanıcı kısıtlanmış site ID'sine aitse erişimi engelle
        if (siteIds.includes(restrictedSiteId)) {
          router.push('/dashboard')
          return
        }
      }

      setHasAccess(true)
    }

    checkAccess()
  }, [router])

  useEffect(() => {
    let isActive = true

    console.log('🔄 useEffect tetiklendi')
    console.log('📍 Current supplier ID:', params.id)

    const loadData = async () => {
      try {
        await Promise.all([
          fetchSupplierDetails(),
          fetchSupplierOrders()
        ])
      } catch (error) {
        console.error('Veri yükleme hatası:', error)
      }
    }

    if (isActive) {
      loadData()
    }

    return () => {
      isActive = false
    }
  }, [params.id])

  const fetchSupplierOrders = async () => {
    try {
      console.log('🔍 Siparişler yüklenmeye başlıyor...')
      console.log('📌 Supplier ID:', params.id)
      
      setLoadingOrders(true)
      
      // Ana sorguyu çalıştır
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          updated_at,
          status,
          amount,
          currency,
          delivery_date,
          supplier_id,
          purchase_request_id,
          document_urls,
          delivery_receipt_photos,
          delivery_image_urls,
          delivered_at,
          delivery_notes
        `)
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })
      
      if (ordersError) {
        console.error('❌ Sipariş yükleme hatası:')
        console.error('Error message:', ordersError.message)
        console.error('Error details:', ordersError.details)
        console.error('Error hint:', ordersError.hint)
        console.error('Error code:', ordersError.code)
        console.error('Full error object:', ordersError)
        throw ordersError
      }

      // Purchase request, invoice ve teslimat özet/fotoğraf verilerini ayrı olarak çek
      const ordersWithPurchaseRequests = await Promise.all(
        (ordersData || []).map(async (order) => {
          const promises: any[] = []
          
          // Purchase request verisi çek
          if (order.purchase_request_id) {
            promises.push(
              supabase
                .from('purchase_requests')
                .select('request_number, title, material_item_name, total_amount, currency')
                .eq('id', order.purchase_request_id)
                .single()
            )
          } else {
            promises.push(Promise.resolve({ data: null }))
          }
          
          // Invoice verilerini çek
          promises.push(
            supabase
              .from('invoices')
              .select('id, amount, currency, invoice_photos, created_at')
              .eq('order_id', order.id)
          )

          // Teslimat özeti (order_delivery_summary view)
          promises.push(
            supabase
              .from('order_delivery_summary')
              .select('last_delivery_at, delivery_percentage, delivery_status, delivery_count, total_delivered, remaining_quantity')
              .eq('order_id', order.id)
              .single()
          )

          // Teslimat fotoğrafları (order_deliveries)
          promises.push(
            supabase
              .from('order_deliveries')
              .select('delivery_photos, delivered_at')
              .eq('order_id', order.id)
              .order('delivered_at', { ascending: false })
          )
          
          const [purchaseResult, invoiceResult, summaryResult, deliveriesResult] = await Promise.all(promises)

          // Teslimat fotoğraflarını düzleştir
          const deliveryPhotosArrays: string[][] = (deliveriesResult?.data || [])
            .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
          const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)

          // delivered_at alanını özetten veya en son teslim kaydından türet
          const lastDeliveryAtFromSummary: string | null = summaryResult?.data?.last_delivery_at || null
          const lastDeliveryAtFromDeliveries: string | null = (deliveriesResult?.data?.[0]?.delivered_at) || null
          const computedDeliveredAt: string | undefined = (lastDeliveryAtFromSummary || lastDeliveryAtFromDeliveries) || undefined
          
          return {
            ...order,
            purchase_requests: purchaseResult.data ? [purchaseResult.data] : [],
            invoices: invoiceResult.data || [],
            // Özet metrikleri ekle (opsiyonel kullanım için)
            delivery_summary: summaryResult?.data || null,
            // UI'da kullanılan alanlar
            delivery_image_urls: flattenedDeliveryPhotos,
            delivered_at: computedDeliveredAt
          }
        })
      )
      
      console.log('✅ Siparişler başarıyla yüklendi')
      console.log('📦 Toplam sipariş sayısı:', ordersWithPurchaseRequests?.length || 0)
      
      setOrders(ordersWithPurchaseRequests || [])
    } catch (error) {
      console.error('Siparişler yüklenirken hata:', error)
      showToast('Siparişler yüklenirken bir hata oluştu.', 'error')
    } finally {
      setLoadingOrders(false)
    }
  }


  const fetchSupplierDetails = async () => {
    try {
      console.log('Tedarikçi ID:', params.id)

      // Tedarikçi bilgilerini çek
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select(`
          id,
          name,
          contact_person,
          email,
          phone,
          address,
          tax_number,
          payment_terms,
          rating,
          is_approved,
          created_at,
          updated_at
        `)
        .eq('id', params.id)
        .single()

      if (supplierError) {
        console.error('Tedarikçi bilgileri çekilirken hata:', supplierError)
        throw new Error(`Tedarikçi bilgileri alınamadı: ${supplierError.message}`)
      }

      console.log('Tedarikçi bilgileri:', supplierData)
      setSupplier(supplierData)

      // Tedarikçinin malzemelerini çek (yeni tablo yapısına göre)
      const { data: materialsData, error: materialsError } = await supabase
        .from('supplier_materials')
        .select(`
          id,
          supplier_id,
          material_class,
          material_group,
          material_item,
          price_range_min,
          price_range_max,
          currency,
          delivery_time_days,
          minimum_order_quantity,
          is_preferred,
          notes,
          created_at,
          updated_at
        `)
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })

      if (materialsError) {
        console.error('Tedarikçi malzemeleri çekilirken hata:', materialsError)
        setMaterials([])
      } else {
        console.log('📦 Ham malzeme verileri:', materialsData)
        setMaterials(materialsData || [])
        console.log('✅ Toplam malzeme sayısı:', materialsData?.length || 0)
      }

    } catch (error: any) {
      console.error('Tedarikçi detayları yüklenirken hata:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      showToast(error.message || 'Tedarikçi detayları yüklenirken bir hata oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-3.5 h-3.5 ${i < rating ? 'fill-elegant-black text-elegant-black' : 'text-elegant-gray-300'}`} 
      />
    ))
  }

  const getStatusBadge = (isApproved: boolean) => {
    return (
      <span className="rounded-full border border-elegant-gray-200 bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">
        {isApproved ? 'Onaylı' : 'Beklemede'}
      </span>
    )
  }

  const orderStatusLabel = (order: Order) => {
    const deliveryStatus = order.delivery_summary?.delivery_status
    if (deliveryStatus === 'completed') return 'Teslim alındı'
    if (order.status === 'completed') return 'Tamamlandı'
    if (order.status === 'delivered') return 'Teslim edildi'
    if (order.status === 'approved') return 'Onaylandı'
    if (order.status === 'rejected') return 'Reddedildi'
    return 'Beklemede'
  }

  const handleViewDeliveryPhotos = (photos: string[], index = 0) => {
    setSelectedImages(photos)
    setSelectedImageIndex(index)
    setIsImageViewerOpen(true)
  }

  const handleOpenInvoiceModal = (orderId: string) => {
    setSelectedOrderId(orderId)
    setInvoiceAmount('')
    setInvoicePhotos([])
    setIsInvoiceModalOpen(true)
  }

  const handleCloseInvoiceModal = () => {
    setIsInvoiceModalOpen(false)
    setSelectedOrderId(null)
    setInvoiceAmount('')
    setInvoicePhotos([])
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploadingInvoice(true)
    
    try {
      // Geçici olarak base64 kullan (storage RLS sorunu çözülene kadar)
      const filePromises = Array.from(files).map(async (file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })

      const base64Files = await Promise.all(filePromises)
      setInvoicePhotos(prev => [...prev, ...base64Files])
      showToast('Fotoğraflar başarıyla yüklendi', 'success')
      
      console.log('Fotoğraflar base64 olarak yüklendi (storage RLS sorunu nedeniyle geçici çözüm)')
    } catch (error: any) {
      console.error('Upload error:', error)
      showToast('Fotoğraf yükleme hatası: ' + error.message, 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Bu kısım daha kompleks, şimdilik file input'u kullanacağız
      showToast('Kamera özelliği yakında eklenecek. Şimdilik dosya seçin.', 'info')
    } catch (error) {
      showToast('Kamera erişimi reddedildi', 'error')
    }
  }

  const handleSubmitInvoice = async () => {
    if (!selectedOrderId || !invoiceAmount || invoicePhotos.length === 0) {
      showToast('Lütfen tüm alanları doldurun ve en az bir fotoğraf ekleyin', 'error')
      return
    }

    setIsUploadingInvoice(true)
    
    try {
      // Fatura verilerini veritabanına kaydet
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          order_id: selectedOrderId,
          amount: parseFloat(invoiceAmount),
          currency: invoiceCurrency,
          invoice_photos: invoicePhotos,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('❌ Fatura kaydetme hatası:')
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        console.error('Error code:', error.code)
        console.error('Full error object:', error)
        throw error
      }

      console.log('✅ Fatura başarıyla kaydedildi:', data)
      showToast('Fatura başarıyla eklendi', 'success')
      handleCloseInvoiceModal()
      
      // Siparişleri yeniden yükle (faturanın gösterilmesi için)
      await fetchSupplierOrders()
    } catch (error: any) {
      console.error('❌ Fatura ekleme hatası (catch):')
      console.error('Error message:', error?.message)
      console.error('Error details:', error?.details)
      console.error('Error hint:', error?.hint)
      console.error('Error code:', error?.code)
      console.error('Full error object:', error)
      
      if (error.code === '42P01') {
        showToast('Fatura tablosu bulunamadı. Lütfen sistem yöneticisine başvurun.', 'error')
      } else if (error.code === '23503') {
        showToast('Sipariş bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.', 'error')
      } else if (error.code === '42501') {
        showToast('Yetki hatası. Fatura ekleme yetkiniz bulunmuyor.', 'error')
      } else {
        showToast('Fatura ekleme hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
      }
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const removePhoto = (index: number) => {
    setInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  const toggleCardExpansion = (orderId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const generatePDFReport = async (order: Order) => {
    try {
      setGeneratingPDF(order.id)
      
      const requestId = order.purchase_request_id
      if (!requestId) {
        showToast('Bu sipariş için talep ID bulunamadı', 'error')
        return
      }
      
      // Timeline verilerini API'den al
      console.log('📋 Timeline API çağrısı yapılıyor:', {
        requestId,
        orderId: order.id,
        url: `/api/reports/timeline?requestId=${requestId}`
      })
      
      const response = await fetch(`/api/reports/timeline?requestId=${requestId}`)
      
      if (!response.ok) {
        console.error('❌ Timeline API hatası:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        })
        throw new Error('Timeline verileri alınamadı')
      }
      
      const timelineData = await response.json()
      
      console.log('📊 Timeline API Response:', {
        requestId,
        orderId: order.id,
        ordersFound: timelineData.orders?.length || 0,
        timelineLength: timelineData.timeline?.length || 0,
        shipmentsLength: timelineData.shipments?.length || 0
      })
      
      // PDF generator'ı dynamic import ile yükle
      const { generatePurchaseRequestReport } = await import('@/lib/pdf-generator')
      
      // PDF oluştur ve indir
      await generatePurchaseRequestReport(timelineData)
      
    } catch (error) {
      console.error('PDF raporu oluşturulurken hata:', error)
      showToast('Rapor oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.', 'error')
    } finally {
      setGeneratingPDF(null)
    }
  }

  if (loading || !hasAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-elegant-gray-200 border-t-elegant-black" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="rounded-xl border border-elegant-gray-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-elegant-black">Tedarikçi bulunamadı</h2>
        <p className="mt-2 text-sm text-elegant-gray-600">İstediğiniz kayda ulaşılamadı.</p>
        <Button onClick={() => router.back()} className="mt-5 rounded-2xl bg-black text-white hover:bg-gray-900">
          Geri dön
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-elegant-gray-500 transition hover:text-elegant-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Tedarikçiler
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-elegant-black md:text-3xl">
            {supplier.name}
          </h1>
          <p className="mt-1 text-sm text-elegant-gray-600">
            İletişim, malzemeler, sözleşmeler ve sipariş geçmişi
          </p>
        </div>
        <Button
          onClick={() => router.push(`/dashboard/suppliers/${params.id}/edit`)}
          className="shrink-0 rounded-2xl bg-black text-white hover:bg-gray-900"
        >
          Düzenle
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">İletişim</p>
          <p className="mt-3 text-sm font-medium text-elegant-black break-all">{supplier.email || '—'}</p>
          <p className="mt-1 text-sm text-elegant-gray-600">{supplier.phone || '—'}</p>
        </div>
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Adres</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-elegant-black">
            {supplier.address || '—'}
          </p>
        </div>
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Vergi / vade</p>
          <p className="mt-3 text-lg font-bold tracking-tight text-elegant-black">{supplier.tax_number || '—'}</p>
          <p className="mt-1 text-xs text-elegant-gray-500">{supplier.payment_terms || 0} gün ödeme vadesi</p>
        </div>
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Durum</p>
            {getStatusBadge(supplier.is_approved)}
          </div>
          <div className="flex items-center gap-1">{getRatingStars(supplier.rating)}</div>
          <p className="mt-2 text-xs text-elegant-gray-500">{supplier.rating || 0}/5 değerlendirme</p>
        </div>
      </div>

      <div className="rounded-xl border border-elegant-gray-200 bg-white shadow-sm">
        <Tabs defaultValue="contracts" className="w-full">
          <div className="border-b border-elegant-gray-200 p-3">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-elegant-gray-50 p-1">
              <TabsTrigger
                value="contracts"
                className="rounded-lg px-3 py-2 text-sm font-medium text-elegant-gray-600 data-[state=active]:bg-white data-[state=active]:text-elegant-black data-[state=active]:shadow-sm"
              >
                Sözleşmeler
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="rounded-lg px-3 py-2 text-sm font-medium text-elegant-gray-600 data-[state=active]:bg-white data-[state=active]:text-elegant-black data-[state=active]:shadow-sm"
              >
                Siparişler
              </TabsTrigger>
              <TabsTrigger
                value="materials"
                className="rounded-lg px-3 py-2 text-sm font-medium text-elegant-gray-600 data-[state=active]:bg-white data-[state=active]:text-elegant-black data-[state=active]:shadow-sm"
              >
                Malzemeler
              </TabsTrigger>
            </TabsList>
          </div>

                <TabsContent value="materials" className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-elegant-black">Tedarik edilen malzemeler</h3>
                        <p className="text-sm text-elegant-gray-500">{materials.length} kayıt</p>
                      </div>
                      <Button
                        onClick={() => router.push(`/dashboard/suppliers/${params.id}/edit`)}
                        variant="outline"
                        className="rounded-2xl border-elegant-gray-200"
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Malzeme ekle
                      </Button>
                    </div>

                    {materials.length === 0 ? (
                      <div className="rounded-xl bg-elegant-gray-50 py-12 text-center">
                        <p className="text-sm text-elegant-gray-500">Henüz malzeme eklenmemiş</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {materials.map((material) => (
                          <div key={material.id} className="rounded-xl border border-elegant-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="font-medium text-elegant-black">{material.material_item}</h4>
                                <p className="mt-1 text-sm text-elegant-gray-500">
                                  {material.material_class} · {material.material_group}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {material.is_preferred && (
                                    <span className="rounded-full bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">Tercihli</span>
                                  )}
                                  {material.delivery_time_days && (
                                    <span className="rounded-full bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">
                                      {material.delivery_time_days} gün
                                    </span>
                                  )}
                                </div>
                                {material.notes && (
                                  <p className="mt-2 text-xs text-elegant-gray-500">{material.notes}</p>
                                )}
                              </div>
                              {(material.price_range_min || material.price_range_max) && (
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-elegant-black">
                                    {material.price_range_min && material.price_range_max
                                      ? `${material.price_range_min.toLocaleString('tr-TR')} – ${material.price_range_max.toLocaleString('tr-TR')}`
                                      : material.price_range_min
                                        ? `${material.price_range_min.toLocaleString('tr-TR')}+`
                                        : material.price_range_max?.toLocaleString('tr-TR')}
                                    {' '}{material.currency || 'TRY'}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-elegant-gray-500">Fiyat aralığı</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

            <TabsContent value="contracts" className="p-4 sm:p-6">
              <SupplierContractsPanel
                supplierId={params.id}
                supplierName={supplier.name}
                showToast={showToast}
              />
            </TabsContent>

            <TabsContent value="orders" className="p-4 sm:p-6">
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-elegant-black">Sipariş geçmişi</h3>
                  <p className="mt-1 text-sm text-elegant-gray-500">Bu tedarikçi ile yapılmış siparişler</p>
                </div>
                
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-elegant-gray-200 border-t-elegant-black" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-xl bg-elegant-gray-50 py-12 text-center">
                    <h4 className="text-base font-medium text-elegant-black">Henüz sipariş yok</h4>
                    <p className="mt-1 text-sm text-elegant-gray-500">Bu tedarikçi ile sipariş oluşturulmamış.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orders.map((order) => (
                      <Card key={order.id} className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm">
                        <CardContent className="p-0">
                          {/* Sipariş Başlığı ve Ana Bilgiler */}
                          <div className="border-b border-elegant-gray-200 p-6">
                            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                              <div className="min-w-0 flex-1">
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex-1">
                                    <h4 className="mb-2 text-lg font-semibold leading-tight text-elegant-black">
                                      {order.purchase_requests?.[0]?.title || `Sipariş #${order.id.slice(0, 8)}`}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-elegant-gray-600">
                                      <span className="flex items-center gap-1.5">
                                        <FileText className="w-4 h-4" />
                                        Talep No: <span className="font-medium">{order.purchase_requests?.[0]?.request_number || '-'}</span>
                                      </span>
                                      <span className="rounded-full border border-elegant-gray-200 bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">
                                        {orderStatusLabel(order)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Fatura Tutarı */}
                                  {(() => {
                                    const totalInvoiceAmount = order.invoices && order.invoices.length > 0 
                                      ? order.invoices.reduce((total, invoice) => total + invoice.amount, 0)
                                      : 0
                                    
                                    if (totalInvoiceAmount > 0) {
                                      return (
                                        <div className="text-right">
                                          <div className="text-xl font-bold tracking-tight text-elegant-black">
                                            {new Intl.NumberFormat('tr-TR', { 
                                              style: 'currency', 
                                              currency: order.invoices![0].currency || 'TRY'
                                            }).format(totalInvoiceAmount)}
                                          </div>
                                          <div className="mt-1 text-xs text-elegant-gray-500">Toplam fatura</div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>

                                {/* Tarih Bilgileri */}
                                <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-elegant-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-elegant-gray-400" />
                                    <span>Oluşturulma: <span className="font-medium">{new Date(order.created_at).toLocaleDateString('tr-TR')}</span></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-elegant-gray-400" />
                                    <span>Teslimat: <span className="font-medium">{new Date(order.delivery_date).toLocaleDateString('tr-TR')}</span></span>
                                  </div>
                                </div>

                                {/* İrsaliye Durumu */}
                                {order.delivery_image_urls && order.delivery_image_urls.length > 0 && (
                                  <div className="mb-3">
                                    <span className="inline-flex items-center rounded-full border border-elegant-gray-200 bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">
                                      İrsaliye teslim alındı
                                    </span>
                                    {order.delivered_at && (
                                      <span className="ml-2 text-xs text-elegant-gray-500">
                                        {new Date(order.delivered_at).toLocaleDateString('tr-TR', {
                                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* İrsaliye Önizleme */}
                                {order.delivery_image_urls && order.delivery_image_urls.length > 0 && (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Image className="w-4 h-4 text-elegant-gray-500" />
                                      <span className="text-sm font-medium text-elegant-black">İrsaliye belgeleri</span>
                                      <span className="rounded-full bg-elegant-gray-50 px-2 py-0.5 text-[11px] font-medium text-elegant-gray-600">
                                        {order.delivery_image_urls.length} adet
                                      </span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                      {order.delivery_image_urls.slice(0, 4).map((photo, index) => (
                                        <button
                                          key={index}
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, index)}
                                          className="group h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-elegant-gray-200 bg-white transition hover:border-elegant-black"
                                        >
                                          <img
                                            src={photo}
                                            alt={`İrsaliye ${index + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                        </button>
                                      ))}
                                      {order.delivery_image_urls.length > 4 && (
                                        <button
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, 4)}
                                          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-elegant-gray-200 bg-elegant-gray-50 text-xs text-elegant-gray-600 transition hover:bg-elegant-gray-100"
                                        >
                                          <div className="text-center">
                                            <div className="font-semibold">+{order.delivery_image_urls.length - 4}</div>
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Fatura Butonu ve Rapor Butonu */}
                                <div className="flex items-center justify-between">
                                  <div className="flex justify-start gap-2">
                                    {order.invoices && order.invoices.length > 0 ? (
                                      <Button 
                                        onClick={() => handleOpenInvoiceModal(order.id)}
                                        className="rounded-2xl bg-black text-white hover:bg-gray-900"
                                        size="sm"
                                      >
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Yeni Fatura Ekle
                                      </Button>
                                    ) : (
                                      <Button 
                                        onClick={() => handleOpenInvoiceModal(order.id)}
                                        className="rounded-2xl bg-black text-white hover:bg-gray-900"
                                        size="sm"
                                      >
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Fatura Ekle
                                      </Button>
                                    )}
                                    
                                    {/* Rapor Oluştur Butonu */}
                                    <Button
                                      onClick={() => generatePDFReport(order)}
                                      disabled={generatingPDF === order.id}
                                      variant="outline"
                                      className="rounded-2xl border-elegant-gray-200"
                                      size="sm"
                                    >
                                      {generatingPDF === order.id ? (
                                        <>
                                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-elegant-gray-200 border-t-elegant-black"></div>
                                          Oluşturuluyor...
                                        </>
                                      ) : (
                                        <>
                                          <FileText className="w-4 h-4 mr-2" />
                                          Rapor Oluştur
                                        </>
                                      )}
                                    </Button>
                                  </div>

                                  {/* Detayları Gör Butonu */}
                                  {(
                                    (order.delivery_image_urls && order.delivery_image_urls.length > 0) ||
                                    (order.delivery_receipt_photos && order.delivery_receipt_photos.length > 0) ||
                                    (order.invoices && order.invoices.length > 0)
                                  ) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => toggleCardExpansion(order.id)}
                                      className="rounded-2xl border-elegant-gray-200 text-elegant-gray-600 hover:text-elegant-black"
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      {expandedCards.has(order.id) ? 'Gizle' : 'Detayları Gör'}
                                      {expandedCards.has(order.id) ? (
                                        <ChevronUp className="w-4 h-4 ml-1" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 ml-1" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Görseller Bölümü */}
                          {(
                            (order.delivery_image_urls && order.delivery_image_urls.length > 0) ||
                            (order.delivery_receipt_photos && order.delivery_receipt_photos.length > 0) ||
                            (order.invoices && order.invoices.length > 0)
                          ) && expandedCards.has(order.id) && (
                            <div className="animate-in slide-in-from-top-2 border-t border-elegant-gray-200 bg-elegant-gray-50/60 p-6 duration-200">
                              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* İrsaliye Fotoğrafları */}
                                {((order.delivery_image_urls && order.delivery_image_urls.length > 0) || 
                                  (order.delivery_receipt_photos && order.delivery_receipt_photos.length > 0)) && (
                                  <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-3">
                                      <div className="rounded-lg bg-elegant-gray-50 p-2">
                                        <Image className="h-4 w-4 text-elegant-gray-600" />
                                      </div>
                                      <div>
                                        <span className="text-sm font-semibold text-elegant-black">İrsaliye belgeleri</span>
                                        <span className="ml-2 text-xs text-elegant-gray-500">
                                          {(order.delivery_image_urls?.length || 0) + (order.delivery_receipt_photos?.length || 0)} fotoğraf
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3">
                                      {/* Önce delivery_image_urls'i göster */}
                                      {order.delivery_image_urls?.slice(0, 6).map((photo, index) => (
                                        <button
                                          key={`delivery-${index}`}
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, index)}
                                          className="group aspect-square overflow-hidden rounded-lg border border-elegant-gray-200 bg-white transition hover:border-elegant-black"
                                        >
                                          <img
                                            src={photo}
                                            alt={`İrsaliye ${index + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                        </button>
                                      ))}
                                      
                                      {/* Sonra delivery_receipt_photos'u göster (eğer yer varsa) */}
                                      {order.delivery_receipt_photos?.slice(0, Math.max(0, 6 - (order.delivery_image_urls?.length || 0))).map((photo, index) => (
                                        <button
                                          key={`receipt-${index}`}
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_receipt_photos!, index)}
                                          className="group aspect-square overflow-hidden rounded-lg border border-elegant-gray-200 bg-white transition hover:border-elegant-black"
                                        >
                                          <img
                                            src={photo}
                                            alt={`İrsaliye Fişi ${index + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                        </button>
                                      ))}
                                      
                                      {/* Toplam fotoğraf sayısı 6'dan fazlaysa +X göster */}
                                      {((order.delivery_image_urls?.length || 0) + (order.delivery_receipt_photos?.length || 0)) > 6 && (
                                        <button
                                          onClick={() => {
                                            const allPhotos = [...(order.delivery_image_urls || []), ...(order.delivery_receipt_photos || [])]
                                            handleViewDeliveryPhotos(allPhotos, 6)
                                          }}
                                          className="flex aspect-square items-center justify-center rounded-lg border border-elegant-gray-200 bg-elegant-gray-50 text-xs text-elegant-gray-600 transition hover:bg-elegant-gray-100"
                                        >
                                          <div className="text-center">
                                            <div className="font-semibold">+{((order.delivery_image_urls?.length || 0) + (order.delivery_receipt_photos?.length || 0)) - 6}</div>
                                            <div>daha</div>
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                    
                                    {order.delivered_at && (
                                      <div className="mt-4 rounded-lg bg-elegant-gray-50 p-3 text-xs text-elegant-gray-500">
                                        <span className="font-medium">Teslim alındı:</span> {new Date(order.delivered_at).toLocaleDateString('tr-TR', {
                                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Fatura Fotoğrafları */}
                                {order.invoices && order.invoices.length > 0 && (
                                  <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-3">
                                      <div className="rounded-lg bg-elegant-gray-50 p-2">
                                        <Receipt className="h-4 w-4 text-elegant-gray-600" />
                                      </div>
                                      <div>
                                        <span className="text-sm font-semibold text-elegant-black">Fatura belgeleri</span>
                                        <span className="ml-2 text-xs text-elegant-gray-500">{order.invoices.length} fatura</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      {order.invoices.map((invoice, index) => (
                                        <div key={invoice.id} className="rounded-lg border border-elegant-gray-200 bg-elegant-gray-50 p-4">
                                          <div className="mb-3 flex items-center justify-between">
                                            <span className="text-sm font-semibold text-elegant-black">
                                              Fatura #{index + 1}
                                            </span>
                                            <span className="text-sm font-bold text-elegant-black">
                                              {new Intl.NumberFormat('tr-TR', { 
                                                style: 'currency', 
                                                currency: invoice.currency || 'TRY'
                                              }).format(invoice.amount)}
                                            </span>
                                          </div>
                                          
                                          {invoice.invoice_photos && invoice.invoice_photos.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                              {invoice.invoice_photos.slice(0, 3).map((photo, photoIndex) => (
                                                <button
                                                  key={photoIndex}
                                                  onClick={() => handleViewDeliveryPhotos(invoice.invoice_photos, photoIndex)}
                                                  className="aspect-square overflow-hidden rounded-lg border border-elegant-gray-200 bg-white"
                                                >
                                                  <img src={photo} alt={`Fatura ${photoIndex + 1}`} className="w-full h-full object-cover" />
                                                </button>
                                              ))}
                                              {invoice.invoice_photos.length > 3 && (
                                                <div className="flex aspect-square items-center justify-center rounded-lg border border-elegant-gray-200 bg-elegant-gray-50 text-xs font-medium text-elegant-gray-600">
                                                  +{invoice.invoice_photos.length - 3}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          <div className="text-xs font-medium text-elegant-gray-500">
                                            {new Date(invoice.created_at).toLocaleDateString('tr-TR', {
                                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
      </div>

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        title="İrsaliye Fotoğrafları"
      />

      {/* Invoice Modal */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/40 backdrop-blur-[2px]"
          className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:border-elegant-gray-200 sm:shadow-2xl"
        >
          <div className="shrink-0 border-b border-elegant-gray-200 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <DialogHeader className="space-y-1 text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">Sipariş</p>
                <DialogTitle className="text-xl font-semibold tracking-tight text-elegant-black">
                  Fatura ekle
                </DialogTitle>
              </DialogHeader>
              <button
                type="button"
                onClick={handleCloseInvoiceModal}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-elegant-gray-600 hover:bg-elegant-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div>
              <Label htmlFor="amount" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Fatura tutarı
              </Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="h-12 flex-1 rounded-xl border-elegant-gray-200 bg-elegant-gray-50 text-base shadow-none focus-visible:ring-1 focus-visible:ring-elegant-black sm:text-sm"
                />
                <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                  <SelectTrigger className="h-12 w-[92px] rounded-xl border-elegant-gray-200 bg-elegant-gray-50 shadow-none focus:ring-1 focus:ring-elegant-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Fatura fotoğrafları
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 rounded-2xl border-elegant-gray-200"
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                  disabled={isUploadingInvoice}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Dosya seç
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 rounded-2xl border-elegant-gray-200 p-0"
                  onClick={handleCameraCapture}
                  disabled={isUploadingInvoice}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              
              <input
                id="invoice-file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {invoicePhotos.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                  Yüklenenler ({invoicePhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {invoicePhotos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Fatura ${index + 1}`}
                        className="h-20 w-full rounded-xl border border-elegant-gray-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-elegant-gray-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseInvoiceModal}
                className="h-12 flex-1 rounded-2xl border-elegant-gray-200"
              >
                İptal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={isUploadingInvoice || !invoiceAmount || invoicePhotos.length === 0}
                className="h-12 flex-1 rounded-2xl bg-black text-white hover:bg-gray-900"
              >
                {isUploadingInvoice ? 'Kaydediliyor...' : 'Fatura ekle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
