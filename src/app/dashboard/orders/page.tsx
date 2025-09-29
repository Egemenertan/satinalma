'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Search, 
  Filter,
  Download,
  Eye,
  Building2,
  Calendar,
  User,
  CheckCircle
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

  // Sadece purchasing_officer erişebilir
  if (profile?.role !== 'purchasing_officer') {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // "teslim alındı" statusundeki taleplere ait siparişleri getir
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
      suppliers (
        name,
        contact_person,
        phone,
        email
      ),
      purchase_requests (
        title,
        request_number,
        site_name,
        status,
        sites (
          name
        )
      ),
      purchase_request_items (
        item_name,
        unit,
        brand,
        specifications
      )
    `)
    .eq('purchase_requests.status', 'teslim alındı')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Sipariş verisi alınırken hata:', error)
    throw new Error('Sipariş verileri alınamadı')
  }

  // Supabase'den gelen array'leri tek objeleye çevir
  const transformedData = (data || []).map((order: any) => ({
    ...order,
    suppliers: Array.isArray(order.suppliers) && order.suppliers.length > 0 ? order.suppliers[0] : null,
    purchase_requests: Array.isArray(order.purchase_requests) && order.purchase_requests.length > 0 ? order.purchase_requests[0] : null,
    purchase_request_items: Array.isArray(order.purchase_request_items) && order.purchase_request_items.length > 0 ? order.purchase_request_items[0] : null
  }))

  return transformedData
}

export default function OrdersPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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
                <div className="grid grid-cols-9 gap-4 pb-4 text-sm font-medium text-gray-500 border-b border-gray-200">
                  <div>Tedarikçi</div>
                  <div>Malzeme</div>
                  <div>Miktar</div>
                  <div>Talep</div>
                  <div>Şantiye</div>
                  <div>Tutar</div>
                  <div>Durum</div>
                  <div>Teslimat</div>
                  <div>İşlemler</div>
                </div>
                
                {/* Table Rows */}
                <div className="space-y-4 pt-4">
                  {filteredOrders.map((order, index) => (
                    <div key={order.id} className="grid grid-cols-9 gap-4 items-center py-3 hover:bg-gray-50 rounded-lg px-2">
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
                      
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/requests/${order.purchase_request_id}/offers`)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <Eye className="h-4 w-4" />
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

    </div>
  )
}
