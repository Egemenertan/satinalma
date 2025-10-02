'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { 
  FileText,
  CheckCircle2
} from 'lucide-react'

interface CompletedRequest {
  id: string
  title: string
  request_number: string
  created_at: string
  requested_by: string
  status: string
  site_name: string
  material_class: string
  delivery_date?: string
  delivered_at?: string
  supplier_name?: string
  total_amount?: number
  currency?: string
  orders?: {
    id: string
    amount: number
    currency: string
    delivery_date: string
    delivered_at?: string
    suppliers: {
      name: string
    }
  }[]
}

export default function ReportsPage() {
  const supabase = createClient()
  const [completedRequests, setCompletedRequests] = useState<CompletedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null)

  // Teslim alınan talepleri çek
  const fetchCompletedRequests = async () => {
    try {
      setLoading(true)

      // Önce tüm talep durumlarını kontrol et
      const { data: allRequests } = await supabase
        .from('purchase_requests')
        .select('status')
      
      console.log('📊 Tüm talep durumları:', {
        statuses: allRequests?.reduce((acc, req) => {
          acc[req.status] = (acc[req.status] || 0) + 1
          return acc
        }, {})
      })
      
      const { data: requests, error } = await supabase
        .from('purchase_requests')
        .select(`
          id, 
          title, 
          created_at, 
          status, 
          site_name, 
          material_class, 
          requested_by,
          orders (
            id,
            amount,
            currency,
            delivery_date,
            delivered_at,
            suppliers (
              name
            )
          )
        `)
        .in('status', ['teslim alındı', 'sipariş verildi'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Tamamlanan talepler alınırken hata:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
        return
      }

      console.log('🔍 Teslim alınan talepler sorgusu sonucu:', {
        count: requests?.length || 0,
        requests: requests?.map((r: any) => ({ 
          id: r.id.slice(0,8), 
          title: r.title, 
          status: r.status,
          ordersCount: r.orders?.length || 0,
          suppliers: r.orders?.map((o: any) => o.suppliers?.name).filter(Boolean)
        }))
      })

      const formattedRequests: CompletedRequest[] = (requests || []).map((request: any) => {
        // İlk siparişten tedarikçi ve tutar bilgilerini al
        const firstOrder = request.orders?.[0]
        const totalAmount = request.orders?.reduce((sum: number, order: any) => sum + (order.amount || 0), 0)
        const supplierNames = [...new Set(request.orders?.map((order: any) => order.suppliers?.name).filter(Boolean))]
        
        return {
          id: request.id,
          title: request.title,
          request_number: `REQ-${request.id.slice(0, 8)}`,
          created_at: request.created_at,
          requested_by: 'Kullanıcı', // Basitleştirildi
          status: request.status,
          site_name: request.site_name || 'Belirtilmemiş',
          material_class: request.material_class,
          delivery_date: firstOrder?.delivery_date,
          delivered_at: firstOrder?.delivered_at,
          supplier_name: supplierNames.length > 0 ? supplierNames.join(', ') : undefined,
          total_amount: totalAmount > 0 ? totalAmount : undefined,
          currency: firstOrder?.currency || 'TRY',
          orders: request.orders
        }
      })

      setCompletedRequests(formattedRequests)
    } catch (error) {
      console.error('Hata:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompletedRequests()
  }, [])


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const generatePDFReport = async (request: CompletedRequest) => {
    try {
      setGeneratingPDF(request.id)
      
      // Timeline verilerini API'den al
      console.log('📋 Timeline API çağrısı yapılıyor:', {
        requestId: request.id,
        requestNumber: request.request_number,
        url: `/api/reports/timeline?requestId=${request.id}`
      })
      
      const response = await fetch(`/api/reports/timeline?requestId=${request.id}`)
      
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
        requestId: request.id,
        ordersFound: timelineData.orders?.length || 0,
        ordersData: timelineData.orders,
        hasOrdersProperty: 'orders' in timelineData,
        timelineDataKeys: Object.keys(timelineData),
        timelineLength: timelineData.timeline?.length || 0,
        shipmentsLength: timelineData.shipments?.length || 0
      })
      console.log('📊 Full Timeline Data:', timelineData)
      
      // Debug: Gelen veriyi detaylı kontrol et
      console.log('📊 Timeline Data for PDF (Detailed):', {
        requestId: request.id,
        
        // Shipment kontrolü
        hasShipments: timelineData.shipments?.length > 0,
        shipmentCount: timelineData.shipments?.length || 0,
        hasShipmentInTimeline: timelineData.timeline?.some((t: any) => t.type === 'shipment'),
        
        // Order kontrolü
        hasOrders: timelineData.orders?.length > 0,
        orderCount: timelineData.orders?.length || 0,
        hasOrderInTimeline: timelineData.timeline?.some((t: any) => t.type === 'order'),
        
        // Invoice kontrolü
        hasInvoices: timelineData.invoices?.length > 0,
        invoiceCount: timelineData.invoices?.length || 0,
        hasInvoiceInTimeline: timelineData.timeline?.some((t: any) => t.type === 'invoice'),
        
        // Timeline türleri
        timelineTypes: timelineData.timeline?.map((t: any) => t.type),
        timelineLength: timelineData.timeline?.length || 0,
        
        // Detaylı veriler
        orders: timelineData.orders?.map((o: any) => ({
          id: o.id?.slice(0, 8),
          amount: o.amount,
          currency: o.currency,
          delivery_date: o.delivery_date,
          supplier: o.suppliers?.name,
          item: o.purchase_request_items?.item_name,
          ordered_by: o.profiles?.full_name || o.profiles?.email
        })),
        
        shipments: timelineData.shipments?.map((s: any) => ({
          id: s.id?.slice(0, 8),
          quantity: s.shipped_quantity,
          item_name: s.purchase_request_items?.item_name,
          user: s.shipped_by_user?.full_name || s.shipped_by_user?.email
        })),
        
        invoices: timelineData.invoices?.map((i: any) => ({
          id: i.id?.slice(0, 8),
          amount: i.amount,
          currency: i.currency,
          supplier: i.orders?.suppliers?.name,
          user: i.orders?.profiles?.full_name || i.orders?.profiles?.email
        })),
        
        // Timeline öğeleri order_data ile
        orderTimelineItems: timelineData.timeline?.filter((t: any) => t.type === 'order' && t.order_data).map((t: any) => ({
          action: t.action,
          actor: t.actor,
          details: t.details,
          order_data: t.order_data
        })),
        
        debug: timelineData.debug
      })
      
      // PDF generator'ı dynamic import ile yükle
      const { generatePurchaseRequestReport } = await import('@/lib/pdf-generator')
      
      // PDF oluştur ve indir
      await generatePurchaseRequestReport(timelineData)
      
    } catch (error) {
      console.error('PDF raporu oluşturulurken hata:', error)
      alert('Rapor oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setGeneratingPDF(null)
    }
  }


  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-slate-800">Tamamlanan Talepler</h1>
        <p className="text-slate-600 mt-1">Teslim alınan taleplerin detaylı raporlarını görüntüleyin ve PDF olarak indirin</p>
      </div>
      {/* Main Content */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-white">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Teslim Alınan Talepler
            {!loading && completedRequests.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({completedRequests.length} adet)
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-slate-600">
            Tamamlanan taleplerin detaylı raporlarını oluşturun ve indirin
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
              <span className="ml-3 text-slate-600">Talepler yükleniyor...</span>
            </div>
          ) : completedRequests.length === 0 ? (
            <div className="text-center py-12 px-6">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">Teslim Alınan Talep Bulunamadı</h3>
              <p className="text-slate-600">Henüz teslim alınan talep bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-slate-50/50">
                    <TableHead className="text-slate-700 font-medium">Talep No</TableHead>
                    <TableHead className="text-slate-700 font-medium">Talep Başlığı</TableHead>
                    <TableHead className="text-slate-700 font-medium">Oluşturan</TableHead>
                    <TableHead className="text-slate-700 font-medium">Şantiye</TableHead>
                    <TableHead className="text-slate-700 font-medium">Tedarikçi</TableHead>
                    <TableHead className="text-slate-700 font-medium">Tutar</TableHead>
                    <TableHead className="text-slate-700 font-medium">Oluşturulma</TableHead>
                    <TableHead className="text-slate-700 font-medium">Teslim Alma</TableHead>
                    <TableHead className="text-slate-700 font-medium">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedRequests.map((request) => (
                    <TableRow key={request.id} className="border-slate-200 hover:bg-slate-50/30">
                      <TableCell className="font-medium text-slate-900">
                        {request.request_number}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-slate-800">
                          {request.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">{request.requested_by}</TableCell>
                      <TableCell className="text-slate-700">{request.site_name}</TableCell>
                      <TableCell className="text-slate-700">{request.supplier_name || '-'}</TableCell>
                      <TableCell className="text-slate-700">
                        {request.total_amount 
                          ? `${request.total_amount.toLocaleString('tr-TR')} ${request.currency}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-600">
                          {formatDate(request.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-600">
                          {request.delivered_at 
                            ? formatDate(request.delivered_at)
                            : '-'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => generatePDFReport(request)}
                          disabled={generatingPDF === request.id}
                          className="bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {generatingPDF === request.id ? (
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


