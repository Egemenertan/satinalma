'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Save, Package, Building2, Calendar, DollarSign, Truck, FileText, Check, AlertCircle, X } from 'lucide-react'
import { addOffers } from '@/lib/actions'
import { supabase } from '@/lib/supabase'

interface Offer {
  supplier_name: string
  unit_price: number
  total_price: number
  delivery_days: number
  delivery_date: string
  notes: string
}

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description: string
  department: string
  urgency_level: string
  status: string
  created_at: string
  site_id?: string
  site_name?: string
  construction_site_id?: string
  purchase_request_items: Array<{
    id: string
    item_name: string
    description: string
    quantity: number
    unit: string
    specifications: string
  }>
  profiles: {
    full_name: string
    email: string
  }
  sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
  construction_sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
}

export default function OffersPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [existingOffers, setExistingOffers] = useState<any[]>([])
  const [newOffers, setNewOffers] = useState<Offer[]>([
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' }
  ])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (requestId) {
      fetchRequestData()
      fetchExistingOffers()
    }
  }, [requestId])

  const fetchRequestData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching request with ID:', requestId)
      
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          purchase_request_items(*),
          profiles!purchase_requests_requested_by_fkey(full_name, email)
        `)
        .eq('id', requestId)
        .single()
      
      // Eğer başarılı ve site_id varsa, şantiye bilgisini ayrı çek
      if (!error && data) {
        let siteData = null
        
        // Önce sites tablosundan dene
        if (data.site_id) {
          const { data: sitesData, error: sitesError } = await supabase
            .from('sites')
            .select('id, name, code, location')
            .eq('id', data.site_id)
            .single()
          
          if (!sitesError && sitesData) {
            data.sites = sitesData
          }
        }
        
        // Sonra construction_sites tablosundan dene
        if (data.construction_site_id) {
          const { data: constructionSitesData, error: constructionSitesError } = await supabase
            .from('construction_sites')
            .select('id, name, code, location')
            .eq('id', data.construction_site_id)
            .single()
          
          if (!constructionSitesError && constructionSitesData) {
            data.construction_sites = constructionSitesData
          }
        }
      }
      
      console.log('📊 Supabase response:', { data, error })
      
      if (error) {
        console.error('❌ Supabase error:', error)
        throw error
      }
      
      console.log('✅ Request data loaded successfully:', data)
      setRequest(data)
    } catch (error) {
      console.error('💥 Error fetching request:', error)
      console.error('💥 Error details:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setExistingOffers(data || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
    }
  }

  const updateOffer = (index: number, field: keyof Offer, value: string | number) => {
    const updated = [...newOffers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate total price and delivery date
    if (field === 'unit_price' && request?.purchase_request_items?.[0]) {
      const quantity = request.purchase_request_items[0].quantity
      updated[index].total_price = Number(value) * quantity
    }

    if (field === 'delivery_days' && value) {
      const date = new Date()
      date.setDate(date.getDate() + Number(value))
      updated[index].delivery_date = date.toISOString().split('T')[0]
    }

    setNewOffers(updated)
  }

  const addOfferRow = () => {
    if (newOffers.length < 5) {
      setNewOffers([...newOffers, { 
        supplier_name: '', unit_price: 0, total_price: 0, 
        delivery_days: 0, delivery_date: '', notes: '' 
      }])
    }
  }

  const removeOfferRow = (index: number) => {
    if (newOffers.length > 1) {
      setNewOffers(newOffers.filter((_, i) => i !== index))
    }
  }

  const isValidOffer = (offer: Offer) => {
    return offer.supplier_name.trim() !== '' && offer.unit_price > 0 && offer.delivery_days >= 0
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      const validOffers = newOffers.filter(isValidOffer)
      
      if (validOffers.length === 0) {
        alert('En az bir geçerli teklif girmelisiniz.')
        return
      }

      await addOffers(requestId, validOffers)
      
      alert('Teklifler başarıyla kaydedildi!')
      router.push('/dashboard/requests')
      
    } catch (error) {
      console.error('Error submitting offers:', error)
      alert('Teklifler kaydedilirken hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-gray-900 text-white'
      case 'high': return 'bg-gray-800 text-white'
      case 'normal': return 'bg-gray-700 text-white'
      case 'low': return 'bg-gray-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-700 text-white'
      case 'awaiting_offers': return 'bg-gray-800 text-white'
      case 'approved': return 'bg-gray-900 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-medium">Talep bilgileri yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Talep Bulunamadı</h3>
          <p className="text-gray-600 mb-6">Aradığınız talep mevcut değil veya erişim izniniz yok.</p>
          <Button 
            onClick={() => router.push('/dashboard/requests')}
            className="bg-gray-800 hover:bg-gray-900 rounded-xl px-6 py-3 font-medium"
          >
            Taleplere Dön
          </Button>
        </div>
      </div>
    )
  }

  const totalOffers = existingOffers.length
  const item = request.purchase_request_items?.[0]

  return (
    <div className="min-h-screen">
      {/* Apple-style Header */}
      <div className=" backdrop-blur-xl sticky top-0 z-10 border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Sol taraf - Geri butonu ve başlık */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/requests')}
                className="flex items-center gap-2 hover:bg-gray-100/80 rounded-full px-3 h-9 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">Geri</span>
              </Button>
              <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Teklif Girişi</h1>
                <p className="text-sm text-gray-500 font-medium">{request.request_number}</p>
              </div>
            </div>

            {/* Sağ taraf - Status badge'leri */}
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency_level)}`}>
                {request.urgency_level === 'critical' ? 'Kritik' : 
                 request.urgency_level === 'high' ? 'Yüksek' :
                 request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                {request.status === 'pending' ? 'Beklemede' :
                 request.status === 'awaiting_offers' ? 'Onay Bekliyor' : request.status}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Hamburger hizasında */}
      <div className="sm:hidden bg-white/80 backdrop-blur-xl border-b border-gray-100/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Teklif Detayı</h2>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 lg:space-y-8">
          
          {/* Üst Bölüm - Talep Detayları ve Ürün Bilgileri Yan Yana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Sol Panel - Talep Detayları */}
            <div className="space-y-6">
              {/* Şantiye Bilgisi - Sade */}
              <div className="mb-6">
                {/* Sadece şantiye adı, büyükçe */}
                {request.site_name ? (
                  <h2 className="text-6xl font-light text-gray-900">{request.site_name}</h2>
                ) : request.sites ? (
                  <h2 className="text-6xl font-bold text-gray-900">{request.sites.name}</h2>
                ) : request.construction_sites ? (
                  <h2 className="text-3xl font-bold text-gray-900">{request.construction_sites.name}</h2>
                ) : (
                  <h2 className="text-3xl font-bold text-gray-900">{request.department} Şantiyesi</h2>
                )}
              </div>

              {/* Talep Detayları */}
              <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#2657ec' }}>
                <div className="mb-6">
                  <h3 className="text-2xl font-light text-white">Talep Detayları</h3>
                  <p className="text-sm text-white/80">Temel bilgiler</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">Başlık</p>
                    <p className="text-white font-medium">{request.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">Açıklama</p>
                    <p className="text-white/90 text-sm leading-relaxed">{request.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">Departman</p>
                      <p className="text-white font-medium">{request.department}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">Talep Eden</p>
                      <p className="text-white font-medium">{request.profiles?.full_name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ Panel - Ürün Bilgileri */}
            <div className="space-y-6">
              {/* Ürün Bilgileri */}
              {item && (
                <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#EFE248' }}>
                  <div className="mb-6">
                    <h3 className="text-2xl font-light text-black">Ürün Bilgileri</h3>
                    <p className="text-sm text-black/70">Detaylar ve özellikler</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-black/60 mb-2 uppercase tracking-wide">Ürün Adı</p>
                      <p className="text-black font-medium">{item.item_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-black/60 mb-2 uppercase tracking-wide">Açıklama</p>
                      <p className="text-black/80 text-sm leading-relaxed">{item.description}</p>
                    </div>
                    
                    {/* Miktar Highlight */}
                    <div className="bg-black/5 rounded-2xl p-4">
                      <p className="text-xs font-medium text-black/70 mb-2 uppercase tracking-wide">Talep Edilen Miktar</p>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-normal text-black">{item.quantity}</div>
                        <div className="px-3 py-1 bg-black/10 rounded-full text-sm font-medium text-black">
                          {item.unit}
                        </div>
                      </div>
                    </div>
                    
                    {item.specifications && (
                      <div>
                        <p className="text-xs font-medium text-black/60 mb-2 uppercase tracking-wide">Özellikler</p>
                        <p className="text-black/80 text-sm leading-relaxed">{item.specifications}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mevcut Teklifler - Eğer varsa */}
          {existingOffers.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-900/10 rounded-xl flex items-center justify-center">
                  <Check className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Mevcut Teklifler</h3>
                  <p className="text-sm text-gray-500">{totalOffers}/3 teklif girildi</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {existingOffers.map((offer, index) => (
                  <div key={offer.id} className="bg-gradient-to-r from-gray-50/50 to-gray-100/50 rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-normal text-gray-700">{index + 1}</span>
                        </div>
                        <p className="font-semibold text-gray-900">{offer.supplier_name}</p>
                      </div>
                      <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                        {offer.delivery_days} gün
                      </div>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Birim Fiyat</p>
                        <p className="text-gray-900 font-semibold">₺{Number(offer.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Toplam</p>
                        <p className="text-gray-900 font-semibold">₺{Number(offer.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    
                    {offer.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200/30">
                        <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Notlar</p>
                        <p className="text-gray-700 text-sm">{offer.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {totalOffers >= 3 && (
                <div className="mt-6 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                    <p className="text-gray-800 font-semibold">3 teklif tamamlandı - Onay bekliyor</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alt Bölüm - Teklif Girişi */}
          <div>
            <div className="bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-900/10 rounded-xl flex items-center justify-center">
                  <Plus className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Yeni Teklif Girişi</h3>
                  <p className="text-sm text-gray-500">Toplam 3 teklif girildikten sonra onay sürecine geçer</p>
                </div>
              </div>
              
              <div className="space-y-6">
                
                {newOffers.map((offer, index) => (
                  <div key={index} className="bg-gradient-to-br from-gray-50/50 to-gray-100/50 rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-normal text-gray-700">{index + 1}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Teklif {index + 1}</h3>
                      </div>
                      {newOffers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOfferRow(index)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-full px-3 h-8 transition-all duration-200"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Tedarikçi Adı */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Tedarikçi Firma Adı *
                        </label>
                        <Input
                          value={offer.supplier_name}
                          onChange={(e) => updateOffer(index, 'supplier_name', e.target.value)}
                          placeholder="Tedarikçi firma adını girin"
                          className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                        />
                      </div>

                      {/* Birim Fiyat */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <DollarSign className="h-4 w-4 text-gray-700" />
                          Birim Fiyat (₺) *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={offer.unit_price || ''}
                          onChange={(e) => updateOffer(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                        />
                      </div>

                      {/* Toplam Fiyat (otomatik) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Toplam Fiyat (₺)
                        </label>
                        <div className="h-12 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl flex items-center px-4 shadow-sm">
                          <span className="font-semibold text-green-700 text-lg">
                            ₺{offer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Teslimat Süresi */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <Truck className="h-4 w-4 text-gray-700" />
                          Teslimat (Gün) *
                        </label>
                        <Input
                          type="number"
                          value={offer.delivery_days || ''}
                          onChange={(e) => updateOffer(index, 'delivery_days', parseInt(e.target.value) || 0)}
                          placeholder="7"
                          className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                        />
                      </div>

                      {/* Teslimat Tarihi (otomatik) */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <Calendar className="h-4 w-4 text-gray-700" />
                          Teslimat Tarihi
                        </label>
                        <div className="h-12 bg-gray-50/50 rounded-xl flex items-center px-4 shadow-sm">
                          <span className="text-gray-600 font-medium">
                            {offer.delivery_date || 'Teslimat süresini girin'}
                          </span>
                        </div>
                      </div>

                      {/* Notlar */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Ek Notlar ve Özel Şartlar
                        </label>
                        <textarea
                          value={offer.notes}
                          onChange={(e) => updateOffer(index, 'notes', e.target.value)}
                          placeholder="Ödeme şartları, garanti bilgileri, özel şartlar..."
                          className="w-full h-24 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200 resize-none px-4 py-3"
                        />
                      </div>
                    </div>

                    {/* Teklif Durumu */}
                    <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-gray-50/50 to-gray-100/50">
                      <div className="flex items-center gap-3">
                        {isValidOffer(offer) ? (
                          <>
                            <div className="w-3 h-3 bg-gray-900 rounded-full shadow-sm"></div>
                            <span className="text-sm text-gray-700 font-medium">✓ Teklif geçerli ve kaydedilebilir</span>
                          </>
                        ) : (
                          <>
                            <div className="w-3 h-3 bg-gray-500 rounded-full shadow-sm"></div>
                            <span className="text-sm text-gray-600">⚠ Gerekli alanları doldurun</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Teklif Ekle Butonu */}
                {newOffers.length < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addOfferRow}
                    className="w-full h-14 bg-gradient-to-r from-gray-50/50 to-gray-100/50 hover:from-gray-100/50 hover:to-gray-200/50 rounded-2xl border-2 border-dashed border-gray-200/50 hover:border-gray-300/50 transition-all duration-200"
                  >
                    <Plus className="h-5 w-5 mr-3 text-gray-700" />
                    <span className="text-base font-medium text-gray-700">Başka Teklif Ekle</span>
                  </Button>
                )}

                {/* Submit Butonları */}
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-100/50">
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/dashboard/requests')}
                    className="flex-1 h-12 bg-gray-100/50 hover:bg-gray-200/50 rounded-xl text-gray-700 font-medium transition-all duration-200"
                    disabled={submitting}
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !newOffers.some(isValidOffer)}
                    className="flex-1 h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        <span className="text-base">Kaydediliyor...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-3" />
                        <span className="text-base">Teklifleri Kaydet</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}