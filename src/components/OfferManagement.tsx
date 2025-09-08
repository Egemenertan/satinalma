'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { 
  Plus,
  FileText,
  Upload,
  Download,
  Eye,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  PoundSterling,
  Truck,
  FileCheck,
  BarChart3,
  Search,
  Filter
} from 'lucide-react'

interface PurchaseRequest {
  id: string
  request_number: string
  material_name: string
  quantity: number
  unit: string
  estimated_price?: number
  status: string
  construction_sites?: {
    name: string
    code: string
  }
}

interface Supplier {
  id: string
  name: string
  code: string
  contact_person?: string
  email?: string
  phone?: string
  rating: number
  is_approved: boolean
}

interface Offer {
  id: string
  request_id: string
  supplier_id: string
  offer_number?: string
  unit_price: number
  total_price: number
  currency: string
  exchange_rate: number
  price_in_base_currency?: number
  delivery_time_days?: number
  delivery_date?: string
  payment_terms?: string
  validity_date?: string
  technical_compliance: boolean
  notes?: string
  document_url?: string
  received_at: string
  is_selected: boolean
  evaluation_score: number
  created_at: string
  // Relations
  suppliers?: Supplier
  purchase_requests?: PurchaseRequest
}

export default function OfferManagement() {
  const supabase = createClient()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [showAddOfferDialog, setShowAddOfferDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    hasOffers: 'all'
  })

  useEffect(() => {
    fetchData()
  }, [filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Teklif bekleyen talepleri getir
      let requestQuery = supabase
        .from('purchase_requests')
        .select(`
          *,
          construction_sites:construction_site_id (
            name,
            code
          )
        `)
        .in('status', ['pending_offers', 'offers_received'])

      if (filters.search) {
        requestQuery = requestQuery.or(`
          request_number.ilike.%${filters.search}%,
          material_name.ilike.%${filters.search}%
        `)
      }

      const { data: requestsData } = await requestQuery.order('created_at', { ascending: false })

      // Tedarikçileri getir
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_approved', true)
        .order('name')

      // Teklifleri getir
      const { data: offersData } = await supabase
        .from('offers')
        .select(`
          *,
          suppliers:supplier_id (*),
          purchase_requests:request_id (*)
        `)
        .order('received_at', { ascending: false })

      setRequests(requestsData || [])
      setSuppliers(suppliersData || [])
      setOffers(offersData || [])
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOffersForRequest = (requestId: string) => {
    return offers.filter(offer => offer.request_id === requestId)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_offers':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Teklif Bekliyor</Badge>
      case 'offers_received':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Teklifler Alındı</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'GBP': return '£'
      case 'EUR': return '€'
      case 'USD': return '$'
      case 'TRY': return '₺'
      default: return currency
    }
  }

  const formatPrice = (price: number, currency: string) => {
    return `${getCurrencySymbol(currency)}${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-3 h-3 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ))
  }

  const getBestOffer = (requestId: string) => {
    const requestOffers = getOffersForRequest(requestId)
    if (requestOffers.length === 0) return null

    return requestOffers.reduce((best, current) => {
      const bestPrice = best.price_in_base_currency || best.total_price * best.exchange_rate
      const currentPrice = current.price_in_base_currency || current.total_price * current.exchange_rate
      return currentPrice < bestPrice ? current : best
    })
  }

  const AddOfferDialog = () => {
    const [formData, setFormData] = useState({
      supplier_id: '',
      offer_number: '',
      unit_price: '',
      total_price: '',
      currency: 'GBP',
      delivery_time_days: '',
      delivery_date: '',
      payment_terms: '',
      validity_date: '',
      technical_compliance: true,
      notes: '',
      evaluation_score: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedRequest) return

      try {
        const offerData = {
          request_id: selectedRequest.id,
          supplier_id: formData.supplier_id,
          offer_number: formData.offer_number || null,
          unit_price: parseFloat(formData.unit_price),
          total_price: parseFloat(formData.total_price),
          currency: formData.currency,
          exchange_rate: formData.currency === 'GBP' ? 1 : 1, // Bu gerçek kur API'sinden alınmalı
          delivery_time_days: formData.delivery_time_days ? parseInt(formData.delivery_time_days) : null,
          delivery_date: formData.delivery_date || null,
          payment_terms: formData.payment_terms || null,
          validity_date: formData.validity_date || null,
          technical_compliance: formData.technical_compliance,
          notes: formData.notes || null,
          evaluation_score: formData.evaluation_score ? parseFloat(formData.evaluation_score) : 0
        }

        const { error } = await supabase
          .from('offers')
          .insert([offerData])

        if (error) throw error

        // Talep durumunu güncelle
        await supabase
          .from('purchase_requests')
          .update({ status: 'offers_received' })
          .eq('id', selectedRequest.id)

        alert('Teklif başarıyla eklendi!')
        setShowAddOfferDialog(false)
        setFormData({
          supplier_id: '',
          offer_number: '',
          unit_price: '',
          total_price: '',
          currency: 'GBP',
          delivery_time_days: '',
          delivery_date: '',
          payment_terms: '',
          validity_date: '',
          technical_compliance: true,
          notes: '',
          evaluation_score: ''
        })
        fetchData()
      } catch (error) {
        console.error('Teklif ekleme hatası:', error)
        alert('Teklif eklenirken bir hata oluştu.')
      }
    }

    return (
      <Dialog open={showAddOfferDialog} onOpenChange={setShowAddOfferDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Teklif Ekle</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier_id">Tedarikçi *</Label>
                <Select 
                  value={formData.supplier_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Tedarikçi seçiniz..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-sm text-gray-500">{supplier.code}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {getRatingStars(supplier.rating)}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="offer_number">Teklif Numarası</Label>
                <Input
                  value={formData.offer_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, offer_number: e.target.value }))}
                  placeholder="TKL-2024-001"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="unit_price">Birim Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="total_price">Toplam Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="currency">Para Birimi</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="TRY">TRY (₺)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="delivery_time_days">Teslimat Süresi (Gün)</Label>
                <Input
                  type="number"
                  value={formData.delivery_time_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_time_days: e.target.value }))}
                  placeholder="15"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="delivery_date">Teslimat Tarihi</Label>
                <Input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_terms">Ödeme Şartları</Label>
                <Input
                  value={formData.payment_terms}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30 gün vade"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="validity_date">Geçerlilik Tarihi</Label>
                <Input
                  type="date"
                  value={formData.validity_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, validity_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="evaluation_score">Değerlendirme Puanı (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.evaluation_score}
                onChange={(e) => setFormData(prev => ({ ...prev, evaluation_score: e.target.value }))}
                placeholder="75.0"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Teklif ile ilgili özel notlar..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="technical_compliance"
                checked={formData.technical_compliance}
                onChange={(e) => setFormData(prev => ({ ...prev, technical_compliance: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="technical_compliance">Teknik şartlara uygun</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddOfferDialog(false)}
              >
                İptal
              </Button>
              <Button type="submit">Teklif Ekle</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  const CompareOffersDialog = ({ requestId }: { requestId: string }) => {
    const [showCompare, setShowCompare] = useState(false)
    const requestOffers = getOffersForRequest(requestId)

    if (requestOffers.length < 2) return null

    return (
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Karşılaştır ({requestOffers.length})
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teklif Karşılaştırması</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Fiyat Karşılaştırması */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fiyat Karşılaştırması</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tedarikçi</TableHead>
                        <TableHead>Birim Fiyat</TableHead>
                        <TableHead>Toplam Fiyat</TableHead>
                        <TableHead>GBP Karşılığı</TableHead>
                        <TableHead>Fark</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requestOffers
                        .sort((a, b) => {
                          const aPrice = a.price_in_base_currency || a.total_price * a.exchange_rate
                          const bPrice = b.price_in_base_currency || b.total_price * b.exchange_rate
                          return aPrice - bPrice
                        })
                        .map((offer, index) => {
                          const basePrice = offer.price_in_base_currency || offer.total_price * offer.exchange_rate
                          const bestPrice = Math.min(...requestOffers.map(o => 
                            o.price_in_base_currency || o.total_price * o.exchange_rate
                          ))
                          const difference = basePrice - bestPrice
                          const isLowest = difference === 0

                          return (
                            <TableRow key={offer.id} className={isLowest ? 'bg-green-50' : ''}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{offer.suppliers?.name}</div>
                                  <div className="flex items-center gap-1">
                                    {getRatingStars(offer.suppliers?.rating || 0)}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{formatPrice(offer.unit_price, offer.currency)}</TableCell>
                              <TableCell>{formatPrice(offer.total_price, offer.currency)}</TableCell>
                              <TableCell>£{basePrice.toFixed(2)}</TableCell>
                              <TableCell>
                                {difference === 0 ? (
                                  <Badge className="bg-green-100 text-green-800">En Düşük</Badge>
                                ) : (
                                  <span className="text-red-600">+£{difference.toFixed(2)}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {offer.technical_compliance ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Teslimat Karşılaştırması */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Teslimat & Şartlar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tedarikçi</TableHead>
                        <TableHead>Teslimat Süresi</TableHead>
                        <TableHead>Teslimat Tarihi</TableHead>
                        <TableHead>Ödeme Şartları</TableHead>
                        <TableHead>Geçerlilik</TableHead>
                        <TableHead>Değerlendirme</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requestOffers.map(offer => (
                        <TableRow key={offer.id}>
                          <TableCell>{offer.suppliers?.name}</TableCell>
                          <TableCell>
                            {offer.delivery_time_days ? (
                              <div className="flex items-center gap-1">
                                <Truck className="w-4 h-4 text-gray-400" />
                                {offer.delivery_time_days} gün
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {offer.delivery_date ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(offer.delivery_date).toLocaleDateString('tr-TR')}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{offer.payment_terms || '-'}</TableCell>
                          <TableCell>
                            {offer.validity_date ? 
                              new Date(offer.validity_date).toLocaleDateString('tr-TR') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{offer.evaluation_score}/100</div>
                              <div 
                                className="w-16 bg-gray-200 rounded-full h-2"
                              >
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${offer.evaluation_score}%` }}
                                ></div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-normal text-gray-900">Teklif Yönetimi</h2>
          <p className="text-gray-600">Tedarikçi tekliflerini yönetin ve karşılaştırın</p>
        </div>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Talep ara..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="pending_offers">Teklif Bekliyor</SelectItem>
                <SelectItem value="offers_received">Teklifler Alındı</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.hasOffers} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, hasOffers: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Teklif Durumu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="with_offers">Teklifli</SelectItem>
                <SelectItem value="without_offers">Teklifsiz</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({ search: '', status: 'all', hasOffers: 'all' })}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Talepler Listesi */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Teklif bekleyen talep bulunamadı</h3>
              <p className="text-gray-600">Henüz teklif bekleyen bir satın alma talebi yok.</p>
            </CardContent>
          </Card>
        ) : (
          requests.map(request => {
            const requestOffers = getOffersForRequest(request.id)
            const bestOffer = getBestOffer(request.id)
            const hasMinOffers = requestOffers.length >= 3

            return (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{request.material_name}</h3>
                          {getStatusBadge(request.status)}
                          {!hasMinOffers && (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Min 3 Teklif Gerekli
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {request.request_number} • {request.quantity} {request.unit}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.construction_sites?.name} ({request.construction_sites?.code})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowAddOfferDialog(true)
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Teklif Ekle
                      </Button>
                      
                      <CompareOffersDialog requestId={request.id} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {requestOffers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>Henüz teklif eklenmemiş</p>
                      <p className="text-sm">En az 3 teklif eklemeniz önerilir</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="font-medium">
                          Teklifler ({requestOffers.length})
                        </h4>
                        {bestOffer && (
                          <div className="text-sm text-gray-600">
                            En iyi teklif: {formatPrice(bestOffer.total_price, bestOffer.currency)}
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tedarikçi</TableHead>
                              <TableHead>Birim Fiyat</TableHead>
                              <TableHead>Toplam Fiyat</TableHead>
                              <TableHead>Teslimat</TableHead>
                              <TableHead>Durum</TableHead>
                              <TableHead>İşlemler</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requestOffers.map(offer => (
                              <TableRow key={offer.id}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{offer.suppliers?.name}</div>
                                    <div className="flex items-center gap-1 mt-1">
                                      {getRatingStars(offer.suppliers?.rating || 0)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{formatPrice(offer.unit_price, offer.currency)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {formatPrice(offer.total_price, offer.currency)}
                                    {offer === bestOffer && (
                                      <Badge className="bg-green-100 text-green-800 text-xs">
                                        En İyi
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {offer.delivery_time_days ? `${offer.delivery_time_days} gün` : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {offer.technical_compliance ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                      {offer.evaluation_score}/100
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AddOfferDialog />
    </div>
  )
}

