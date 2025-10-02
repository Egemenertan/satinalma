'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import { 
  Package, 
  Search, 
  Filter,
  Download,
  Eye,
  Building2,
  Calendar,
  User,
  CheckCircle,
  Receipt,
  Image,
  Upload,
  Camera,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/components/offers/types'

interface OrderData {
  id: string
  purchase_request_id: string
  supplier_id: string
  delivery_date: string
  amount: number
  currency: string
  quantity: number
  status: string
  is_delivered: boolean
  created_at: string
  delivery_image_urls?: string[]  // order_deliveries.delivery_photos'dan gelir
  delivered_at?: string
  // Relations
  suppliers: {
    name: string
    contact_person?: string
    phone?: string
    email?: string
  } | null
  purchase_requests: {
    title: string
    request_number: string
    site_name?: string
    status: string
    sites?: {
      name: string
    }
  } | null
  purchase_request_items: {
    item_name: string
    unit: string
    brand?: string
    specifications?: string
  } | null
  invoices?: {
    id: string
    amount: number
    currency: string
    invoice_photos: string[]
    created_at: string
  }[]
}

// Siparişleri getiren fetcher
const fetchOrders = async (): Promise<OrderData[]> => {
  const supabase = createClient()
  
  // Kullanıcı rolünü kontrol et
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Sadece purchasing_officer, admin ve manager erişebilir
  const allowedRoles = ['purchasing_officer', 'admin', 'manager']
  if (!allowedRoles.includes(profile?.role)) {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // Tüm siparişleri getir (irsaliye fotoğrafları order_deliveries'den çekilecek)
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      purchase_request_id,
      supplier_id,
      delivery_date,
      amount,
      currency,
      quantity,
      status,
      is_delivered,
      created_at,
      material_item_id,
      delivered_at,
      suppliers!orders_supplier_id_fkey (
        name,
        contact_person,
        phone,
        email
      ),
      purchase_requests!orders_purchase_request_id_fkey (
        title,
        request_number,
        site_name,
        status,
        sites!purchase_requests_site_id_fkey (
          name
        )
      ),
      purchase_request_items!fk_orders_material_item_id (
        item_name,
        unit,
        brand,
        specifications
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Sipariş verisi alınırken hata:', error)
    throw new Error('Sipariş verileri alınamadı')
  }

  // Her sipariş için fatura verilerini çek
  const ordersWithInvoices = await Promise.all(
    (data || []).map(async (order: any) => {
      // Fatura verilerini çek
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, currency, invoice_photos, created_at')
        .eq('order_id', order.id)

      if (invoicesError) {
        console.error('Fatura verileri çekilirken hata:', invoicesError)
      }

      // İrsaliye fotoğraflarını order_deliveries tablosundan çek
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('order_deliveries')
        .select('delivery_photos, delivered_at')
        .eq('order_id', order.id)
        .order('delivered_at', { ascending: false })

      if (deliveriesError) {
        console.error('Teslimat verileri çekilirken hata:', deliveriesError)
      }

      // Teslimat fotoğraflarını düzleştir (sadece order_deliveries'den)
      const deliveryPhotosArrays: string[][] = (deliveriesData || [])
        .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
      const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)

      // En son teslimat tarihini al
      const lastDeliveredAt = deliveriesData?.[0]?.delivered_at || order.delivered_at

      return {
        ...order,
        suppliers: order.suppliers || null,
        purchase_requests: order.purchase_requests || null,
        purchase_request_items: order.purchase_request_items || null,
        invoices: invoicesData || [],
        // İrsaliye fotoğrafları sadece order_deliveries tablosundan
        delivery_image_urls: flattenedDeliveryPhotos,
        delivered_at: lastDeliveredAt
      }
    })
  )

  return ordersWithInvoices
}

export default function OrdersPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
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

  // SWR ile veri çekme
  const { data: orders, error, isLoading, mutate } = useSWR(
    'orders_delivered',
    fetchOrders,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 3
    }
  )

  // Filtreleme
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = !searchTerm || 
      order.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_request_items?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_requests?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_requests?.request_number?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  // Modal functions
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
      
    } catch (error: any) {
      console.error('Upload error:', error)
      showToast('Fotoğraf yükleme hatası: ' + error.message, 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const handleSubmitInvoice = async () => {
    if (!selectedOrderId || !invoiceAmount || invoicePhotos.length === 0) {
      showToast('Lütfen tüm alanları doldurun ve en az bir fotoğraf ekleyin', 'error')
      return
    }

    setIsUploadingInvoice(true)
    
    try {
      const supabase = createClient()
      
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
        console.error('❌ Fatura kaydetme hatası:', error)
        throw error
      }

      console.log('✅ Fatura başarıyla kaydedildi:', data)
      showToast('Fatura başarıyla eklendi', 'success')
      handleCloseInvoiceModal()
      
      // Siparişleri yeniden yükle (faturanın gösterilmesi için)
      await mutate()
    } catch (error: any) {
      console.error('❌ Fatura ekleme hatası:', error)
      showToast('Fatura ekleme hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const removePhoto = (index: number) => {
    setInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Hata durumu
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold">Hata Oluştu</h2>
            <p className="text-gray-600 mt-2">{error.message}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Dashboard'a Dön
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Siparişler</h1>
          <p className="text-gray-600 mt-1">Teslim alınmış taleplere ait sipariş yönetimi</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {filteredOrders.length} Sipariş
          </Badge>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent"></div>
            </div>
            <p className="text-gray-600 font-light text-lg">Siparişler yükleniyor...</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && filteredOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Teslim Edildi</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {filteredOrders.filter(o => o.status === 'delivered' || o.is_delivered).length}
                    </span>
                    <div className="flex items-center text-green-600 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Tamamlandı</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Başarıyla teslim edildi</p>
                  <p className="text-xs text-gray-400">Sipariş süreci tamamlandı</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Kısmi Teslim</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {filteredOrders.filter(o => o.status === 'partially_delivered').length}
                    </span>
                    <div className="flex items-center text-orange-600 text-sm">
                      <Package className="h-3 w-3 mr-1" />
                      <span>Devam Ediyor</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Kısmi teslimat yapıldı</p>
                  <p className="text-xs text-gray-400">Bekleyen teslimatlar var</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Sipariş</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{filteredOrders.length}</span>
                    <div className="flex items-center text-blue-600 text-sm">
                      <Building2 className="h-3 w-3 mr-1" />
                      <span>Aktif</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Tüm sipariş kayıtları</p>
                  <p className="text-xs text-gray-400">Sistem geneli toplam</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tedarikçi Sayısı</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {new Set(filteredOrders.map(o => o.supplier_id)).size}
                    </span>
                    <div className="flex items-center text-purple-600 text-sm">
                      <User className="h-3 w-3 mr-1" />
                      <span>Firma</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Sipariş veren firmalar</p>
                  <p className="text-xs text-gray-400">Farklı tedarikçi sayısı</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tedarikçi, malzeme veya talep numarası ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-200 focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 h-11 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400 text-gray-900"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pending">Bekliyor</option>
              <option value="delivered">Teslim Edildi</option>
              <option value="partially_delivered">Kısmi Teslim</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      {!isLoading && (
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Sipariş Listesi</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Teslim alınmış taleplere ait sipariş detayları</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtrele
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sipariş Bulunamadı</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Arama kriterlerine uygun sipariş bulunamadı.' : 'Henüz teslim alınmış sipariş bulunmuyor.'}
                </p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-10 gap-4 pb-4 text-sm font-medium text-gray-500 border-b border-gray-200">
                  <div>Tedarikçi</div>
                  <div>Malzeme</div>
                  <div>Miktar</div>
                  <div>Talep</div>
                  <div>Şantiye</div>
                  <div>Tutar</div>
                  <div>Durum</div>
                  <div>Teslimat</div>
                  <div>İrsaliye</div>
                  <div>İşlemler</div>
                </div>
                
                {/* Table Rows */}
                <div className="space-y-4 pt-4">
                  {filteredOrders.map((order, index) => (
                    <div key={order.id} className="grid grid-cols-10 gap-4 items-center py-3 hover:bg-gray-50 rounded-lg px-2">
                      <div>
                        <div className="font-medium text-gray-900 truncate">
                          {order.suppliers?.name || 'Tedarikçi belirtilmemiş'}
                        </div>
                        {order.suppliers?.contact_person && (
                          <div className="text-sm text-gray-500 truncate">{order.suppliers.contact_person}</div>
                        )}
                      </div>
                      
                      <div>
                        <div className="font-medium text-gray-900 truncate">
                          {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                        </div>
                        {order.purchase_request_items?.brand && (
                          <div className="text-xs text-gray-500 truncate">Marka: {order.purchase_request_items.brand}</div>
                        )}
                      </div>
                      
                      <div className="font-medium text-gray-900">
                        {order.quantity} {order.purchase_request_items?.unit || ''}
                      </div>
                      
                      <div>
                        <div className="font-medium text-gray-900 truncate">
                          {order.purchase_requests?.request_number || 'Bilinmiyor'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {order.purchase_requests?.title || 'Başlık belirtilmemiş'}
                        </div>
                      </div>
                      
                      <div className="text-gray-600 truncate">
                        {order.purchase_requests?.site_name || order.purchase_requests?.sites?.name || 'Belirtilmemiş'}
                      </div>
                      
                      <div>
                        {order.amount > 0 ? (
                          <div className="font-medium text-gray-900">
                            {getCurrencySymbol(order.currency)}
                            {order.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Belirtilmemiş</span>
                        )}
                      </div>
                      
                      <div>
                        <Badge
                          className={
                            order.status === 'delivered' || order.is_delivered
                              ? 'bg-green-100 text-green-700 border-0'
                              : order.status === 'partially_delivered'
                              ? 'bg-orange-100 text-orange-700 border-0'
                              : 'bg-gray-100 text-gray-700 border-0'
                          }
                        >
                          {order.status === 'delivered' || order.is_delivered 
                            ? 'Teslim Edildi' 
                            : order.status === 'partially_delivered'
                            ? 'Kısmi Teslim'
                            : 'Bekliyor'
                          }
                        </Badge>
                      </div>
                      
                      <div className="text-gray-600 text-sm">
                        {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                      </div>
                      
                      {/* İrsaliye Fotoğrafları */}
                      <div className="flex items-center">
                        {order.delivery_image_urls && order.delivery_image_urls.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, 0)}
                              className="w-8 h-8 rounded border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 overflow-hidden bg-white"
                            >
                              <img
                                src={order.delivery_image_urls[0]}
                                alt="İrsaliye"
                                className="w-full h-full object-cover"
                              />
                            </button>
                            {order.delivery_image_urls.length > 1 && (
                              <span className="text-xs text-gray-500">
                                +{order.delivery_image_urls.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleOpenInvoiceModal(order.id)}
                          size="sm"
                          className="bg-gray-900 hover:bg-gray-800 text-white text-xs px-2 py-1 h-7"
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          Fatura
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/requests/${order.purchase_request_id}/offers`)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
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
