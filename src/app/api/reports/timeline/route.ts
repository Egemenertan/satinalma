import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID gerekli' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Ana talep bilgilerini çek
    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        status,
        urgency_level,
        material_class,
        description,
        site_name,
        requested_by,
        sites:site_id (
          name
        ),
        purchase_request_items (
          item_name,
          quantity,
          unit,
          description
        ),
        profiles:requested_by (
          full_name,
          email,
          role
        )
      `)
      .eq('id', requestId)
      .single()

    if (requestError) {
      return NextResponse.json(
        { error: 'Talep bulunamadı' },
        { status: 404 }
      )
    }

    // Teklif bilgilerini çek
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select(`
        id,
        supplier_name,
        offer_amount,
        currency,
        created_at,
        approved_at,
        approval_reason,
        status
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    // Sipariş bilgilerini çek
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        supplier,
        amount,
        currency,
        delivery_date,
        created_at,
        delivered_at,
        status,
        delivery_receipt_photos,
        delivery_notes
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    // Sevkiyat bilgilerini çek
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id,
        quantity_sent,
        sent_at,
        notes,
        created_at
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    // Timeline oluştur
    const timeline = []

    // 1. Talep oluşturulması
    timeline.push({
      date: requestData.created_at,
      action: 'Talep Oluşturuldu',
      actor: (requestData.profiles as any)?.full_name || (requestData.profiles as any)?.email || 'Bilinmeyen',
      details: `${requestData.title} talebi oluşturuldu`,
      type: 'creation'
    })

    // 2. Şantiye depo gönderimi (eğer varsa)
    if (shipments && shipments.length > 0) {
      shipments.forEach(shipment => {
        timeline.push({
          date: shipment.sent_at || shipment.created_at,
          action: 'Şantiye Depo Gönderimi',
          actor: 'Şantiye Depo Kullanıcısı',
          details: `${shipment.quantity_sent} adet malzeme gönderildi${shipment.notes ? ` - ${shipment.notes}` : ''}`,
          type: 'shipment'
        })
      })
    }

    // 3. Teklif aşamaları
    if (offers && offers.length > 0) {
      offers.forEach(offer => {
        timeline.push({
          date: offer.created_at,
          action: 'Teklif Alındı',
          actor: 'Satın Alma Sorumlusu',
          details: `${offer.supplier_name} tedarikçisinden ${offer.offer_amount} ${offer.currency} teklif alındı`,
          type: 'offer'
        })

        if (offer.approved_at) {
          timeline.push({
            date: offer.approved_at,
            action: 'Teklif Onaylandı',
            actor: 'Şantiye Yöneticisi',
            details: `${offer.supplier_name} tedarikçisinin teklifi onaylandı${offer.approval_reason ? ` - ${offer.approval_reason}` : ''}`,
            type: 'approval'
          })
        }
      })
    }

    // 4. Sipariş aşamaları
    if (orders && orders.length > 0) {
      orders.forEach(order => {
        timeline.push({
          date: order.created_at,
          action: 'Sipariş Oluşturuldu',
          actor: 'Satın Alma Sorumlusu',
          details: `${order.supplier} tedarikçisine ${order.amount} ${order.currency} tutarında sipariş verildi`,
          type: 'order'
        })

        if (order.delivered_at) {
          timeline.push({
            date: order.delivered_at,
            action: 'Teslimat Alındı',
            actor: 'Şantiye Personeli',
            details: `Malzemeler teslim alındı${order.delivery_notes ? ` - ${order.delivery_notes}` : ''}`,
            type: 'delivery'
          })
        }
      })
    }

    // Timeline'ı tarihe göre sırala
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const response = {
      request: requestData,
      timeline,
      statistics: {
        totalDays: Math.ceil(
          (new Date(orders?.[0]?.delivered_at || new Date()).getTime() - 
           new Date(requestData.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        totalOffers: offers?.length || 0,
        totalAmount: orders?.[0]?.amount || 0,
        currency: orders?.[0]?.currency || 'TRY'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Timeline API hatası:', error)
    return NextResponse.json(
      { error: 'Timeline verileri alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
