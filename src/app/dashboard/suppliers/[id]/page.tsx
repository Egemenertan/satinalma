'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { useToast } from '@/components/ui/toast'
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
  ArrowLeft
} from 'lucide-react'

interface Order {
  id: string
  created_at: string
  updated_at: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  amount: number
  currency: string
  delivery_date: string
  supplier_id: string
  purchase_request_id: string
  document_urls: string[]
  purchase_requests?: {
    title: string
    request_number: string
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
          purchase_requests:purchase_requests!left (
            title,
            request_number
          )
        `)
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })

      if (ordersError) {
        console.error('❌ Sipariş yükleme hatası:', {
          message: ordersError.message,
          details: ordersError.details,
          hint: ordersError.hint,
          code: ordersError.code
        })
        throw ordersError
      }

      console.log('✅ Siparişler başarıyla yüklendi')
      console.log('📦 Toplam sipariş sayısı:', ordersData?.length || 0)
      console.log('📄 Sipariş verileri:', ordersData)
      
      setOrders(ordersData || [])
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-normal text-gray-900">{supplier.name}</h1>
            <p className="text-gray-600 mt-1">Tedarikçi Detayları</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Panel - Temel Bilgiler */}
        <div className="space-y-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Temel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{supplier.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{supplier.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{supplier.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                <span>{supplier.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>Vergi No: {supplier.tax_number}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Durum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-2">Onay Durumu</div>
                {getStatusBadge(supplier.is_approved)}
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Değerlendirme</div>
                <div className="flex items-center gap-2">
                  {getRatingStars(supplier.rating)}
                  <span className="text-sm font-medium">({supplier.rating}/5)</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Ödeme Vadesi</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{supplier.payment_terms} gün</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Panel - Detaylar */}
        <div className="md:col-span-2">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue="materials" className="w-full">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="materials" className="flex-1">Malzemeler</TabsTrigger>
                  <TabsTrigger value="orders" className="flex-1">Siparişler</TabsTrigger>
                </TabsList>

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
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Sipariş Geçmişi</h3>
                    </div>
                    
                    {/* Debug bilgileri */}
                    <div style={{ display: 'none' }}>
                      {`🎯 Render - loadingOrders: ${loadingOrders}`}
                      {`🎯 Render - orders: ${JSON.stringify(orders)}`}
                    </div>
                    
                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Henüz sipariş bulunmuyor</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {orders.map((order) => (
                          <Card key={order.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">
                                    {order.purchase_requests?.[0]?.title || 'Sipariş #' + order.id.slice(0, 8)}
                                  </h4>
                                  <div className="text-sm text-gray-600 mt-1">
                                    Talep No: {order.purchase_requests?.[0]?.request_number || '-'}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="text-sm text-gray-500">
                                      <Calendar className="w-4 h-4 inline mr-1" />
                                      Oluşturulma: {new Date(order.created_at).toLocaleDateString('tr-TR')}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      <Package className="w-4 h-4 inline mr-1" />
                                      Teslimat: {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                    </div>
                                    <Badge className={
                                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      order.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                      order.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }>
                                      {order.status === 'completed' ? 'Tamamlandı' :
                                       order.status === 'approved' ? 'Onaylandı' :
                                       order.status === 'rejected' ? 'Reddedildi' :
                                       'Beklemede'}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-lg">
                                    {new Intl.NumberFormat('tr-TR', { 
                                      style: 'currency', 
                                      currency: order.currency || 'TRY'
                                    }).format(order.amount)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}
