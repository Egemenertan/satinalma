'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Building2, Package, TrendingUp, Trash2, Plus } from 'lucide-react'

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description?: string
  department: string
  total_amount: number
  currency?: string
  urgency_level: string
  status: string
  requested_by: string
  created_at: string
  purchase_request_items?: Array<{
    id: string
    item_name: string
    quantity: number
    unit: string
    unit_price: number
    total_price: number
  }>
}

interface Offer {
  supplier_name: string
  unit_price: number
  total_price: number
  delivery_days: number
  delivery_date: string
  notes: string
}

interface OfferEntryModalProps {
  request: PurchaseRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (requestId: string, offers: Offer[]) => Promise<void>
}

export default function OfferEntryModal({ request, open, onOpenChange, onSubmit }: OfferEntryModalProps) {
  const [offers, setOffers] = useState<Offer[]>([
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' },
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' },
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [existingOffers, setExistingOffers] = useState<any[]>([])

  // Mevcut teklifleri getir
  const fetchExistingOffers = async () => {
    if (!request?.id) return
    
    try {
      const supabase = (await import('@/lib/supabase')).supabase
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('purchase_request_id', request.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setExistingOffers(data || [])
    } catch (error) {
      console.error('Error fetching existing offers:', error)
    }
  }

  // Modal açıldığında mevcut teklifleri getir
  React.useEffect(() => {
    if (open && request) {
      fetchExistingOffers()
    }
  }, [open, request])

  const updateOffer = (index: number, field: keyof Offer, value: string | number) => {
    const newOffers = [...offers]
    newOffers[index] = { ...newOffers[index], [field]: value }
    
    // Unit price değiştiğinde total price'ı hesapla
    if (field === 'unit_price' && request?.purchase_request_items?.[0]) {
      const quantity = request.purchase_request_items[0].quantity
      newOffers[index].total_price = Number(value) * quantity
    }
    
    // Delivery days değiştiğinde delivery date'i hesapla
    if (field === 'delivery_days') {
      const deliveryDate = new Date()
      deliveryDate.setDate(deliveryDate.getDate() + Number(value))
      newOffers[index].delivery_date = deliveryDate.toISOString().split('T')[0]
    }
    
    setOffers(newOffers)
  }

  const removeOffer = (index: number) => {
    if (offers.length > 1) {
      setOffers(offers.filter((_, i) => i !== index))
    }
  }

  const addOffer = () => {
    if (offers.length < 5) {
      setOffers([...offers, { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' }])
    }
  }

  const isFormValid = () => {
    return offers.filter(offer => 
      offer.supplier_name.trim() !== '' && 
      offer.unit_price > 0 && 
      offer.delivery_days > 0
    ).length >= 1
  }

  const handleSubmit = async () => {
    if (!request || !isFormValid()) return
    
    setLoading(true)
    try {
      const validOffers = offers.filter(offer => 
        offer.supplier_name.trim() !== '' && 
        offer.unit_price > 0
      )
      
      await onSubmit(request.id, validOffers)
      
      // Reset form
      setOffers([
        { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' },
        { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' },
        { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '' }
      ])
      
      // Mevcut teklifleri yenile
      await fetchExistingOffers()
      
      onOpenChange(false)
    } catch (error) {
      console.error('Offer submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Teklif Girişi - {request.request_number}
          </DialogTitle>
          <DialogDescription>
            Bu talep için teklif girebilirsiniz. Toplam 3 teklif girildikten sonra otomatik olarak onay sürecine geçer.
          </DialogDescription>
        </DialogHeader>

        {/* Talep Bilgileri */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Talep Detayları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Başlık</div>
                <div className="font-medium">{request.title}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Departman</div>
                <div className="font-medium">{request.department}</div>
              </div>
              {request.description && (
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600">Açıklama</div>
                  <div className="font-medium">{request.description}</div>
                </div>
              )}
              {request.purchase_request_items && request.purchase_request_items.length > 0 && (
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600 mb-2">Talep Edilen Öğeler</div>
                  {request.purchase_request_items.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{item.item_name}</span>
                      <span className="text-gray-600">-</span>
                      <span>{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mevcut Teklifler */}
        {existingOffers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Mevcut Teklifler ({existingOffers.length}/3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {existingOffers.map((offer, index) => (
                  <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="font-medium">{offer.supplier_name}</div>
                      <div className="text-gray-600">₺{offer.unit_price} / birim</div>
                      <div className="text-green-600 font-medium">Toplam: ₺{offer.total_price}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {offer.delivery_days} gün teslimat
                    </div>
                  </div>
                ))}
              </div>
              {existingOffers.length >= 3 && (
                <div className="mt-3 p-2 bg-green-50 rounded-lg text-center">
                  <span className="text-green-700 font-medium">✅ 3 teklif tamamlandı - Onay bekliyor</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Teklif Girişi */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Teklifler ({offers.filter(o => o.supplier_name.trim() !== '').length} teklif)
            </h3>
            {offers.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOffer}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Teklif Ekle
              </Button>
            )}
          </div>

          {offers.map((offer, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Teklif {index + 1}</CardTitle>
                  {offers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOffer(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tedarikçi Adı */}
                  <div>
                    <Label htmlFor={`supplier-${index}`}>Tedarikçi Adı *</Label>
                    <Input
                      id={`supplier-${index}`}
                      value={offer.supplier_name}
                      onChange={(e) => updateOffer(index, 'supplier_name', e.target.value)}
                      placeholder="Tedarikçi firma adı"
                      className="mt-1"
                    />
                  </div>

                  {/* Birim Fiyat */}
                  <div>
                    <Label htmlFor={`unit-price-${index}`}>Birim Fiyat (₺) *</Label>
                    <Input
                      id={`unit-price-${index}`}
                      type="number"
                      step="0.01"
                      value={offer.unit_price || ''}
                      onChange={(e) => updateOffer(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  {/* Toplam Fiyat */}
                  <div>
                    <Label htmlFor={`total-price-${index}`}>Toplam Fiyat (₺)</Label>
                    <Input
                      id={`total-price-${index}`}
                      type="number"
                      step="0.01"
                      value={offer.total_price || ''}
                      onChange={(e) => updateOffer(index, 'total_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  {/* Teslimat Süresi */}
                  <div>
                    <Label htmlFor={`delivery-days-${index}`}>Teslimat Süresi (Gün) *</Label>
                    <Input
                      id={`delivery-days-${index}`}
                      type="number"
                      value={offer.delivery_days || ''}
                      onChange={(e) => updateOffer(index, 'delivery_days', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>

                  {/* Teslimat Tarihi */}
                  <div>
                    <Label htmlFor={`delivery-date-${index}`}>Teslimat Tarihi</Label>
                    <Input
                      id={`delivery-date-${index}`}
                      type="date"
                      value={offer.delivery_date}
                      onChange={(e) => updateOffer(index, 'delivery_date', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Notlar */}
                  <div className="md:col-span-2">
                    <Label htmlFor={`notes-${index}`}>Notlar</Label>
                    <Textarea
                      id={`notes-${index}`}
                      value={offer.notes}
                      onChange={(e) => updateOffer(index, 'notes', e.target.value)}
                      placeholder="Ek bilgiler, özel şartlar vb."
                      className="mt-1 min-h-[60px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Form Durumu */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            {isFormValid() ? (
              <>
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm text-green-700 font-medium">
                  Gönderime hazır
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                <span className="text-sm text-yellow-700">
                  En az 1 tane geçerli teklif girmeniz gerekiyor
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Gönderiliyor...' : 'Teklifleri Gönder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
