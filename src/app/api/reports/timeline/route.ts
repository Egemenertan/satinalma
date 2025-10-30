import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Route'u dinamik olarak işaretle
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID gerekli' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Kullanıcı authentication kontrolü
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('🔐 Timeline API Authentication:', {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
      requestId
    })

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
    console.log('🛒 Orders sorgusu yapılıyor:', { requestId })
    
    // Önce basit orders sorgusu yap (JOIN'siz)
    const { data: ordersSimple, error: ordersSimpleError } = await supabase
      .from('orders')
      .select('*')
      .eq('purchase_request_id', requestId)
    
    console.log('🛒 Basit orders sorgusu:', {
      requestId,
      ordersSimpleFound: ordersSimple?.length || 0,
      ordersSimpleError: ordersSimpleError?.message,
      ordersSimpleData: ordersSimple
    })
    
    // Şimdi JOIN'li sorgu yap
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        amount,
        currency,
        quantity,
        returned_quantity,
        return_notes,
        is_return_reorder,
        delivery_date,
        created_at,
        delivered_at,
        status,
        delivery_receipt_photos,
        delivery_notes,
        user_id,
        material_item_id,
        supplier_id,
        purchase_request_id
      `)
      .eq('purchase_request_id', requestId)
      .order('created_at', { ascending: true })
    
    console.log('🛒 JOINsiz orders sorgusu:', {
      requestId,
      ordersFound: orders?.length || 0,
      ordersError: ordersError?.message,
      ordersData: orders
    })
    
    // JOIN'leri ayrı ayrı çek
    let ordersWithJoins = []
    if (orders && orders.length > 0) {
      for (const order of orders) {
        // Supplier bilgisi
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', order.supplier_id)
          .single()
        
        // User bilgisi
        const { data: profile } = await supabase
          .from('profiles') 
          .select('full_name, email, role')
          .eq('id', order.user_id)
          .single()
        
        // Material bilgisi
        const { data: material } = await supabase
          .from('purchase_request_items')
          .select('item_name, unit')
          .eq('id', order.material_item_id)
          .single()
        
        // Invoice bilgisi (bu siparişe ait faturalar)
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, amount, currency, created_at')
          .eq('order_id', order.id)
        
        ordersWithJoins.push({
          ...order,
          suppliers: supplier,
          profiles: profile,
          purchase_request_items: material,
          invoices: invoices || []
        })
      }
    }
    
    console.log('🛒 Manuel JOIN sonucu:', {
      ordersWithJoinsCount: ordersWithJoins.length,
      ordersWithJoins
    })
    
    // Manuel JOIN'li veriyi kullan
    const finalOrders = ordersWithJoins
      
    console.log('🛒 Orders sorgu sonucu:', {
      requestId,
      ordersFound: orders?.length || 0,
      ordersError: ordersError?.message,
      ordersRaw: finalOrders, // Ham veri
      orders: finalOrders?.map(o => ({
        id: o.id.slice(0, 8),
        amount: o.amount,
        currency: o.currency,
        supplier: o.suppliers?.name,
        user: o.profiles?.full_name || o.profiles?.email,
        material: o.purchase_request_items?.item_name,
        hasSupplier: !!o.suppliers,
        hasProfile: !!o.profiles,
        hasMaterial: !!o.purchase_request_items,
        invoicesCount: o.invoices?.length || 0,
        totalInvoiceAmount: o.invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0
      }))
    })

    // Sevkiyat bilgilerini çek
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id,
        shipped_quantity,
        shipped_at,
        shipped_by,
        notes,
        created_at,
        purchase_request_item_id,
        purchase_request_items (
          item_name,
          unit
        )
      `)
      .eq('purchase_request_id', requestId)
      .order('shipped_at', { ascending: true })

    // Gönderen kullanıcı bilgilerini ayrı sorguda çek
    let shipmentsWithUsers = []
    if (shipments && shipments.length > 0) {
      const userIds = [...new Set(shipments.map(s => s.shipped_by))]
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', userIds)
      
      // Shipments ile users'ı manual join yap
      shipmentsWithUsers = shipments.map(shipment => ({
        ...shipment,
        shipped_by_user: users?.find(u => u.id === shipment.shipped_by)
      }))
    }

    console.log('🚢 Shipments Query Result:', {
      requestId,
      shipmentsError,
      shipmentsCount: shipments?.length || 0,
      shipmentsWithUsersCount: shipmentsWithUsers?.length || 0,
      shipments: shipmentsWithUsers?.map(s => ({
        id: s.id.slice(0, 8),
        quantity: s.shipped_quantity,
        shipped_at: s.shipped_at,
        item_id: s.purchase_request_item_id,
        item_name: (s as any).purchase_request_items?.item_name,
        shipped_by: s.shipped_by_user?.full_name || s.shipped_by_user?.email,
        shipped_by_uuid: s.shipped_by
      }))
    })

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
    if (shipmentsWithUsers && shipmentsWithUsers.length > 0) {
      shipmentsWithUsers.forEach(shipment => {
        const shippedUser = shipment.shipped_by_user
        const itemInfo = (shipment as any).purchase_request_items
        const userName = shippedUser?.full_name || shippedUser?.email || 'Şantiye Depo Kullanıcısı'
        const itemName = itemInfo?.item_name || 'Malzeme'
        const unit = itemInfo?.unit || 'adet'
        
        timeline.push({
          date: shipment.shipped_at || shipment.created_at,
          action: 'Şantiye Depo Gönderimi',
          actor: userName,
          details: `${itemName}: ${shipment.shipped_quantity} ${unit} gönderildi${shipment.notes ? ` - ${shipment.notes}` : ''}`,
          type: 'shipment',
          shipment_data: {
            quantity: shipment.shipped_quantity,
            item_name: itemName,
            unit: unit,
            shipped_by: userName,
            shipped_by_role: shippedUser?.role
          }
        })
      })
    }

    // 3. Approval history - Site Manager onayları
    const { data: approvals, error: approvalsError } = await supabase
      .from('approval_history')
      .select(`
        id,
        action,
        comments,
        created_at,
        profiles:performed_by (
          full_name,
          email,
          role
        )
      `)
      .eq('purchase_request_id', requestId)
      .order('created_at', { ascending: true })

    if (approvals && approvals.length > 0) {
      approvals.forEach(approval => {
        const approverUser = (approval as any).profiles
        const userName = approverUser?.full_name || approverUser?.email || 'Bilinmeyen Kullanıcı'
        const userRole = approverUser?.role || 'unknown'
        
        let actionText = 'Onay İşlemi'
        if (approval.action === 'approved') {
          actionText = userRole === 'site_manager' ? 'Site Manager Onayı' : 'Onaylandı'
        } else if (approval.action === 'rejected') {
          actionText = 'Reddedildi'
        } else if (approval.action === 'submitted') {
          actionText = 'Teklif Eklendi'
        }
        
        timeline.push({
          date: approval.created_at,
          action: actionText,
          actor: userName,
          details: approval.comments || 'Detay belirtilmemiş',
          type: 'approval'
        })
      })
    }

    // 4. Teklif aşamaları
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
            type: 'offer_approval'
          })
        }
      })
    }

    // 5. Sipariş aşamaları
    if (finalOrders && finalOrders.length > 0) {
      finalOrders.forEach(order => {
        const orderUser = (order as any).profiles
        const supplierInfo = (order as any).suppliers
        const itemInfo = (order as any).purchase_request_items
        
        const userName = orderUser?.full_name || orderUser?.email || 'Satın Alma Sorumlusu'
        const supplierName = supplierInfo?.name || 'Tedarikçi'
        const itemName = itemInfo?.item_name || 'Malzeme'
        
        // Sipariş detaylarını oluştur
        let orderDetails = `${supplierName} tedarikçisine ${itemName} için ${order.quantity} ${itemInfo?.unit || 'adet'} sipariş verildi (${order.amount} ${order.currency})`
        
        // İade bilgilerini ekle
        if (order.returned_quantity && order.returned_quantity > 0) {
          orderDetails += ` - İade: ${order.returned_quantity} ${itemInfo?.unit || 'adet'}`
          if (order.return_notes) {
            orderDetails += ` (${order.return_notes})`
          }
        }
        
        // Yeniden sipariş kontrolü
        if (order.is_return_reorder) {
          orderDetails += ' - İade nedeniyle yeniden sipariş'
        }

        timeline.push({
          date: order.created_at,
          action: order.is_return_reorder ? 'Yeniden Sipariş Oluşturuldu' : 'Sipariş Oluşturuldu',
          actor: userName,
          details: orderDetails,
          type: 'order',
          order_data: {
            supplier_name: supplierName,
            amount: order.amount,
            currency: order.currency,
            quantity: order.quantity,
            returned_quantity: order.returned_quantity || 0,
            return_notes: order.return_notes,
            is_return_reorder: order.is_return_reorder || false,
            unit: itemInfo?.unit,
            delivery_date: order.delivery_date,
            item_name: itemName,
            ordered_by: userName,
            ordered_by_role: orderUser?.role
          }
        })

        if (order.delivered_at) {
          timeline.push({
            date: order.delivered_at,
            action: 'Teslimat Alındı',
            actor: 'Şantiye Personeli',
            details: `${itemName} malzemesi teslim alındı${order.delivery_notes ? ` - ${order.delivery_notes}` : ''}`,
            type: 'delivery'
          })
        }
      })
    }

    // 6. Invoice (Fatura) aşamaları
    console.log('💰 Invoices sorgusu yapılıyor:', { requestId })
    
    // Önce basit invoices sorgusu yap
    const { data: invoicesSimple, error: invoicesSimpleError } = await supabase
      .from('invoices')
      .select('*')
    
    console.log('💰 Basit invoices sorgusu (tüm invoices):', {
      invoicesSimpleFound: invoicesSimple?.length || 0,
      invoicesSimpleError: invoicesSimpleError?.message,
      invoicesSimpleData: invoicesSimple
    })
    
    // Bu request'e ait orders'ları bul ve onların invoice'larını çek
    const orderIds = finalOrders?.map(o => o.id) || []
    console.log('💰 Order IDs for invoice lookup:', {
      finalOrdersLength: finalOrders?.length || 0,
      orderIds,
      orderIdsCount: orderIds.length
    })
    
    let invoices, invoicesError
    
    if (orderIds.length > 0) {
      // Order IDs varsa, onlara ait invoices'ları çek
      const result = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          currency,
          created_at,
          notes,
          order_id
        `)
        .in('order_id', orderIds)
        .order('created_at', { ascending: true })
      
      invoices = result.data
      invoicesError = result.error
    } else {
      // Order IDs yoksa, tüm invoices'ları kontrol et (debug için)
      console.log('⚠️ Order IDs boş, tüm invoices kontrol ediliyor...')
      
      const result = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          currency,
          created_at,
          notes,
          order_id
        `)
        .order('created_at', { ascending: true })
      
      invoices = result.data
      invoicesError = result.error
      
      console.log('💰 Tüm invoices verileri:', {
        totalInvoices: invoices?.length || 0,
        invoicesData: invoices
      })
    }
    
    console.log('💰 JOINsiz invoices sorgusu:', {
      requestId,
      orderIds,
      invoicesFound: invoices?.length || 0,
      invoicesError: invoicesError?.message,
      invoicesData: invoices
    })
    
    // Manuel JOIN'leri yap
    let invoicesWithJoins = []
    if (invoices && invoices.length > 0) {
      for (const invoice of invoices) {
        // İlgili order'ı bul
        const relatedOrder = finalOrders?.find(o => o.id === invoice.order_id)
        
        if (relatedOrder) {
          invoicesWithJoins.push({
            ...invoice,
            orders: {
              purchase_request_id: relatedOrder.purchase_request_id,
              suppliers: relatedOrder.suppliers,
              purchase_request_items: relatedOrder.purchase_request_items,
              profiles: relatedOrder.profiles
            }
          })
        }
      }
    }
    
    console.log('💰 Manuel JOIN invoices sonucu:', {
      invoicesWithJoinsCount: invoicesWithJoins.length,
      invoicesWithJoins
    })
    
    const finalInvoices = invoicesWithJoins

    if (finalInvoices && finalInvoices.length > 0) {
      finalInvoices.forEach(invoice => {
        const order = (invoice as any).orders
        const supplierInfo = order?.suppliers
        const itemInfo = order?.purchase_request_items
        const orderUser = order?.profiles

        const supplierName = supplierInfo?.name || 'Tedarikçi'
        const itemName = itemInfo?.item_name || 'Malzeme'
        const userName = orderUser?.full_name || orderUser?.email || 'Purchasing Officer'

        timeline.push({
          date: invoice.created_at,
          action: 'Fatura Eklendi',
          actor: userName,
          details: `${supplierName} tedarikçisinden ${itemName} için ${invoice.amount} ${invoice.currency} tutarında fatura eklendi`,
          type: 'invoice',
          invoice_data: {
            supplier_name: supplierName,
            amount: invoice.amount,
            currency: invoice.currency,
            item_name: itemName,
            added_by: userName,
            added_by_role: orderUser?.role,
            notes: invoice.notes
          }
        })
      })
    }

    // Timeline'ı tarihe göre sırala
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const response = {
      request: requestData,
      timeline,
      orders: finalOrders || [],
      shipments: shipmentsWithUsers || [],
      invoices: finalInvoices || [],
      statistics: {
        totalDays: Math.ceil(
          (new Date(finalOrders?.[0]?.delivered_at || new Date()).getTime() - 
           new Date(requestData.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        totalOffers: offers?.length || 0,
        totalShipments: shipmentsWithUsers?.length || 0,
        totalInvoices: finalInvoices?.length || 0,
        totalAmount: finalOrders?.[0]?.amount || 0,
        currency: finalOrders?.[0]?.currency || 'TRY'
      },
      debug: {
        ordersFound: finalOrders?.length || 0,
        shipmentsFound: shipmentsWithUsers?.length || 0,
        invoicesFound: finalInvoices?.length || 0,
        ordersError: ordersError?.message,
        shipmentsError: shipmentsError?.message,
        invoicesError: invoicesError?.message,
        requestId,
        timelineLength: timeline.length
      }
    }

    console.log('📋 Final Response:', {
      ordersCount: response.orders.length,
      finalOrdersCount: finalOrders?.length || 0,
      shipmentsCount: response.shipments.length,
      invoicesCount: response.invoices.length,
      finalInvoicesCount: finalInvoices?.length || 0,
      timelineCount: response.timeline.length,
      hasOrderInTimeline: response.timeline.some(t => t.type === 'order'),
      hasShipmentInTimeline: response.timeline.some(t => t.type === 'shipment'),
      hasInvoiceInTimeline: response.timeline.some(t => t.type === 'invoice')
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Timeline API hatası:', error)
    return NextResponse.json(
      { error: 'Timeline verileri alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
