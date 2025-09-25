'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { useToast } from '@/components/ui/toast'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import { 
  Building,
  Phone,
  Mail,
  MapPin,
  Star,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Target,
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

      // Purchase request ve invoice verilerini ayrı olarak çek
      const ordersWithPurchaseRequests = await Promise.all(
        (ordersData || []).map(async (order) => {
          const promises = []
          
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
          
          const [purchaseResult, invoiceResult] = await Promise.all(promises)
          
          return {
            ...order,
            purchase_requests: purchaseResult.data ? [purchaseResult.data] : [],
            invoices: invoiceResult.data || []
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
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ))
  }

  const getStatusBadge = (isApproved: boolean) => {
    return isApproved ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Onaylı
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Beklemede
      </Badge>
    )
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tedarikçi Bulunamadı</h2>
          <p className="text-gray-600 mb-4">İstediğiniz tedarikçi bilgilerine ulaşılamadı.</p>
          <Button onClick={() => router.back()}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Geri Dön
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Supplier Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{supplier.name}</h1>
          <p className="text-gray-600">Tedarikçi Detayları ve İşlem Geçmişi</p>
        </div>

        {/* Top Cards - Temel Bilgiler ve Durum */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Temel Bilgiler */}
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-gray-400" />
                Temel Bilgiler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Email</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{supplier.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Telefon</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{supplier.phone}</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm text-gray-600">Adres</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 text-right max-w-xs">{supplier.address}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Vergi No</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{supplier.tax_number}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Durum ve Değerlendirme */}
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-gray-400" />
                Durum ve Değerlendirme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Onay Durumu</span>
                  {getStatusBadge(supplier.is_approved)}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Değerlendirme</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {getRatingStars(supplier.rating)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">({supplier.rating}/5)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Ödeme Vadesi</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{supplier.payment_terms} gün</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modern Tabs */}
        <Card className="bg-white shadow-sm border-0">
          <Tabs defaultValue="orders" className="w-full">
            <div className="border-b border-gray-200">
              <TabsList className="w-full bg-transparent h-auto p-0 rounded-none">
                <TabsTrigger 
                  value="orders" 
                  className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none"
                >
                  Siparişler
                </TabsTrigger>
                <TabsTrigger 
                  value="materials" 
                  className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none"
                >
                  Malzemeler
                </TabsTrigger>
              </TabsList>
            </div>

                <TabsContent value="materials" className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Tedarik Edilen Malzemeler 
                        <span className="text-sm text-gray-500 ml-2">({materials.length} adet)</span>
                      </h3>
                      <Button onClick={() => router.push(`/dashboard/suppliers/${params.id}/edit`)}>
                        <Package className="w-4 h-4 mr-2" />
                        Malzeme Ekle
                      </Button>
                    </div>
                    
                    
                    {materials.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Henüz malzeme eklenmemiş</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {materials.map((material) => (
                          <Card key={material.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 mb-2">
                                    {material.material_item}
                                  </h4>
                                  <div className="text-sm text-gray-600 mb-2">
                                    <span className="inline-flex items-center gap-1">
                                      <Package className="w-3 h-3" />
                                      {material.material_class} → {material.material_group}
                                    </span>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {material.is_preferred && (
                                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                                        <Star className="w-3 h-3 mr-1" />
                                        Tercihli
                                      </Badge>
                                    )}
                                    {material.delivery_time_days && (
                                      <Badge variant="outline" className="text-xs">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {material.delivery_time_days} gün
                                      </Badge>
                                    )}
                                    {material.currency && (
                                      <Badge variant="outline" className="text-xs">
                                        {material.currency}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {material.notes && (
                                    <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                      {material.notes}
                                    </div>
                                  )}
                                </div>
                                
                                {(material.price_range_min || material.price_range_max) && (
                                  <div className="text-right ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {material.price_range_min && material.price_range_max ? (
                                        `${material.price_range_min.toLocaleString('tr-TR')} - ${material.price_range_max.toLocaleString('tr-TR')} ${material.currency || 'TRY'}`
                                      ) : material.price_range_min ? (
                                        `${material.price_range_min.toLocaleString('tr-TR')}+ ${material.currency || 'TRY'}`
                                      ) : (
                                        `${material.price_range_max?.toLocaleString('tr-TR')} ${material.currency || 'TRY'}`
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">Fiyat Aralığı</div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

            <TabsContent value="orders" className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Sipariş Geçmişi</h3>
                    <p className="text-sm text-gray-600 mt-1">Bu tedarikçi ile yapılmış tüm siparişler</p>
                  </div>
                </div>
                
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Henüz sipariş bulunmuyor</h4>
                    <p className="text-gray-600">Bu tedarikçi ile henüz sipariş oluşturulmamış.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orders.map((order) => (
                      <Card key={order.id} className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden">
                        <CardContent className="p-0">
                          {/* Sipariş Başlığı ve Ana Bilgiler */}
                          <div className="p-6 border-b border-gray-100">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
                                      {order.purchase_requests?.[0]?.title || `Sipariş #${order.id.slice(0, 8)}`}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                      <span className="flex items-center gap-1.5">
                                        <FileText className="w-4 h-4" />
                                        Talep No: <span className="font-medium">{order.purchase_requests?.[0]?.request_number || '-'}</span>
                                      </span>
                                      <Badge className={
                                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                        order.status === 'approved' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                        order.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                        'bg-amber-100 text-amber-800 border-amber-200'
                                      }>
                                        {order.status === 'completed' ? 'Tamamlandı' :
                                         order.status === 'delivered' ? 'Teslim Edildi' :
                                         order.status === 'approved' ? 'Onaylandı' :
                                         order.status === 'rejected' ? 'Reddedildi' :
                                         'Beklemede'}
                                      </Badge>
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
                                          <div className="text-xl font-bold text-emerald-700">
                                            {new Intl.NumberFormat('tr-TR', { 
                                              style: 'currency', 
                                              currency: order.invoices![0].currency || 'TRY'
                                            }).format(totalInvoiceAmount)}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">Toplam Fatura</div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>

                                {/* Tarih Bilgileri */}
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>Oluşturulma: <span className="font-medium">{new Date(order.created_at).toLocaleDateString('tr-TR')}</span></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <span>Teslimat: <span className="font-medium">{new Date(order.delivery_date).toLocaleDateString('tr-TR')}</span></span>
                                  </div>
                                </div>

                                {/* İrsaliye Durumu */}
                                {order.delivery_image_urls && order.delivery_image_urls.length > 0 && (
                                  <div className="mb-3">
                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      İrsaliye Teslim Alındı
                                    </Badge>
                                    {order.delivered_at && (
                                      <span className="text-xs text-gray-500 ml-2">
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
                                      <Image className="w-4 h-4 text-blue-600" />
                                      <span className="text-sm font-medium text-gray-900">İrsaliye Belgeleri</span>
                                      <Badge variant="outline" className="text-xs">
                                        {order.delivery_image_urls.length} adet
                                      </Badge>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                      {order.delivery_image_urls.slice(0, 4).map((photo, index) => (
                                        <button
                                          key={index}
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, index)}
                                          className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 group bg-white"
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
                                          className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-200 transition-colors duration-200"
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
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                                        size="sm"
                                      >
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Yeni Fatura Ekle
                                      </Button>
                                    ) : (
                                      <Button 
                                        onClick={() => handleOpenInvoiceModal(order.id)}
                                        className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg shadow-sm"
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
                                      className="bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors rounded-lg shadow-sm"
                                      size="sm"
                                    >
                                      {generatingPDF === order.id ? (
                                        <>
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                                      className="text-gray-600 hover:text-gray-800 border-gray-300"
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
                            <div className="p-6 bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* İrsaliye Fotoğrafları */}
                                {((order.delivery_image_urls && order.delivery_image_urls.length > 0) || 
                                  (order.delivery_receipt_photos && order.delivery_receipt_photos.length > 0)) && (
                                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="p-2 bg-gray-100 rounded-lg">
                                        <Image className="w-4 h-4 text-gray-600" />
                                      </div>
                                      <div>
                                        <span className="text-sm font-semibold text-gray-900">İrsaliye Belgeleri</span>
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {(order.delivery_image_urls?.length || 0) + (order.delivery_receipt_photos?.length || 0)} fotoğraf
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3">
                                      {/* Önce delivery_image_urls'i göster */}
                                      {order.delivery_image_urls?.slice(0, 6).map((photo, index) => (
                                        <button
                                          key={`delivery-${index}`}
                                          onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, index)}
                                          className="aspect-square rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 group bg-white"
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
                                          className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 group bg-white"
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
                                          className="aspect-square rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-200 transition-colors duration-200"
                                        >
                                          <div className="text-center">
                                            <div className="font-semibold">+{((order.delivery_image_urls?.length || 0) + (order.delivery_receipt_photos?.length || 0)) - 6}</div>
                                            <div>daha</div>
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                    
                                    {order.delivered_at && (
                                      <div className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">Teslim alındı:</span> {new Date(order.delivered_at).toLocaleDateString('tr-TR', {
                                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Fatura Fotoğrafları */}
                                {order.invoices && order.invoices.length > 0 && (
                                  <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="p-2 bg-emerald-100 rounded-lg">
                                        <Receipt className="w-4 h-4 text-emerald-600" />
                                      </div>
                                      <div>
                                        <span className="text-sm font-semibold text-emerald-900">Fatura Belgeleri</span>
                                        <Badge variant="outline" className="ml-2 text-xs border-emerald-200 text-emerald-700">
                                          {order.invoices.length} fatura
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      {order.invoices.map((invoice, index) => (
                                        <div key={invoice.id} className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
                                          <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-semibold text-emerald-800">
                                              Fatura #{index + 1}
                                            </span>
                                            <span className="text-sm font-bold text-emerald-800">
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
                                                  className="aspect-square rounded-lg overflow-hidden border-2 border-emerald-200 hover:border-emerald-300 transition-all duration-200 bg-white"
                                                >
                                                  <img src={photo} alt={`Fatura ${photoIndex + 1}`} className="w-full h-full object-cover" />
                                                </button>
                                              ))}
                                              {invoice.invoice_photos.length > 3 && (
                                                <div className="aspect-square bg-emerald-100 rounded-lg border-2 border-emerald-200 flex items-center justify-center text-xs text-emerald-600 font-medium">
                                                  +{invoice.invoice_photos.length - 3}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          <div className="text-xs text-emerald-600 font-medium">
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
        </Card>
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
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Fatura Ekle
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tutar Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Fatura Tutarı</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="flex-1"
                />
                <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                  <SelectTrigger className="w-20">
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

            {/* Fotoğraf Yükleme */}
            <div className="space-y-2">
              <Label>Fatura Fotoğrafları</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                  disabled={isUploadingInvoice}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Dosya Seç
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraCapture}
                  disabled={isUploadingInvoice}
                >
                  <Camera className="w-4 h-4" />
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

            {/* Yüklenen Fotoğrafları Göster */}
            {invoicePhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Yüklenen Fotoğraflar ({invoicePhotos.length})</Label>
                <div className="grid grid-cols-3 gap-2">
                  {invoicePhotos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Fatura ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseInvoiceModal}
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={isUploadingInvoice || !invoiceAmount || invoicePhotos.length === 0}
                className="flex-1 bg-black hover:bg-black text-white"
              >
                {isUploadingInvoice ? 'Kaydediliyor...' : 'Fatura Ekle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
