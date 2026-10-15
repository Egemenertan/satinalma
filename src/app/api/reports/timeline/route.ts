import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Route'u dinamik olarak işaretle
export const dynamic = 'force-dynamic'

const IN_CHUNK = 200

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}

async function fetchInChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  if (ids.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))
  const results = await Promise.all(chunks.map((chunk) => query(chunk)))
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)
  return results.flatMap((result) => result.data ?? [])
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const requestId = searchParams.get('requestId')
    const specificInvoiceGroupId = searchParams.get('invoiceGroupId') // Yeni parametre

    if (!requestId && !specificInvoiceGroupId) {
      return NextResponse.json(
        { error: 'Request ID veya Invoice Group ID gerekli' },
        { status: 400 }
      )
    }

    console.log('📊 Timeline API Request:', {
      requestId: requestId || 'none',
      specificInvoiceGroupId: specificInvoiceGroupId || 'none'
    })

    const supabase = createClient()
    
    // Kullanıcı authentication kontrolü
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('🔐 Timeline API Authentication:', {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
      requestId: requestId || 'none',
      invoiceGroupId: specificInvoiceGroupId || 'none'
    })
    
    // Eğer invoice_group_id verilmişse, önce o gruba ait tüm order'ları ve purchase_request_id'leri bul
    let allRequestIds: string[] = []
    
    if (specificInvoiceGroupId) {
      console.log('🔍 Invoice Group ID ile tüm ilgili request\'ler bulunuyor:', specificInvoiceGroupId)
      
      // Bu invoice group'a ait tüm invoices'ları bul
      const { data: groupInvoices } = await supabase
        .from('invoices')
        .select('order_id')
        .eq('invoice_group_id', specificInvoiceGroupId)
      
      if (groupInvoices && groupInvoices.length > 0) {
        const orderIds = groupInvoices.map(inv => inv.order_id)
        
        // Bu order'ların purchase_request_id'lerini bul
        const { data: orders } = await supabase
          .from('orders')
          .select('purchase_request_id')
          .in('id', orderIds)
        
        if (orders && orders.length > 0) {
          allRequestIds = [...new Set(orders.map(o => o.purchase_request_id))]
          console.log('✅ Invoice Group için bulunan request\'ler:', {
            invoiceGroupId: specificInvoiceGroupId,
            orderCount: orderIds.length,
            uniqueRequestIds: allRequestIds,
            requestCount: allRequestIds.length
          })
        }
      }
    } else if (requestId) {
      allRequestIds = [requestId]
    }

    // Ana talep bilgilerini çek - birden fazla request olabilir (invoice group için)
    const { data: allRequestsData, error: requestError } = await supabase
      .from('purchase_requests')
      .select(`
        id,
        title,
        request_number,
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
      .in('id', allRequestIds)

    if (requestError || !allRequestsData || allRequestsData.length === 0) {
      return NextResponse.json(
        { error: 'Talep bulunamadı' },
        { status: 404 }
      )
    }
    
    // İlk request'i ana request olarak kullan (backward compatibility için)
    const requestData = allRequestsData[0]
    
    console.log('📋 Request Data:', {
      totalRequests: allRequestsData.length,
      requestIds: allRequestIds,
      mainRequestId: requestData.id,
      titles: allRequestsData.map(r => r.title)
    })

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

    // Siparişler: fotoğraf kolonları PDF'te kullanılmıyor, çekilmez.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        amount,
        currency,
        quantity,
        returned_quantity,
        return_notes,
        is_return_reorder,
        delivery_date,
        created_at,
        delivered_at,
        delivery_confirmed_by,
        status,
        delivery_notes,
        user_id,
        material_item_id,
        supplier_id,
        purchase_request_id
      `)
      .in('purchase_request_id', allRequestIds)
      .order('created_at', { ascending: true })

    if (ordersError) throw new Error(ordersError.message)
    
    const requestNumberById = new Map(
      (allRequestsData || [])
        .filter((request) => request.request_number)
        .map((request) => [request.id, request.request_number as string])
    )

    const orderIds = (orders ?? []).map((order) => order.id)
    const supplierIds = uniqueIds((orders ?? []).map((order) => order.supplier_id))
    const profileIds = uniqueIds((orders ?? []).map((order) => order.user_id))
    const materialIds = uniqueIds((orders ?? []).map((order) => order.material_item_id))

    const [suppliers, orderProfiles, materials, detailedInvoices, deliveries] = await Promise.all([
      fetchInChunks(supplierIds, (chunk) =>
        supabase.from('suppliers').select('id, name').in('id', chunk)
      ),
      fetchInChunks(profileIds, (chunk) =>
        supabase.from('profiles').select('id, full_name, email, role').in('id', chunk)
      ),
      fetchInChunks(materialIds, (chunk) =>
        supabase.from('purchase_request_items').select('id, item_name, unit').in('id', chunk)
      ),
      fetchInChunks(orderIds, (chunk) =>
        supabase
          .from('invoices')
          .select('id, amount, currency, created_at, notes, order_id, invoice_group_id, subtotal, discount, tax, grand_total')
          .in('order_id', chunk)
          .order('created_at', { ascending: true })
      ),
      fetchInChunks(orderIds, (chunk) =>
        supabase
          .from('order_deliveries')
          .select('order_id, delivered_at, received_by')
          .in('order_id', chunk)
          .order('delivered_at', { ascending: false })
      ),
    ])

    const deliveryProfileIds = uniqueIds(
      deliveries.map((delivery) => delivery.received_by).filter((id) => !orderProfiles.some((profile) => profile.id === id))
    )
    const deliveryProfiles = await fetchInChunks(deliveryProfileIds, (chunk) =>
      supabase.from('profiles').select('id, full_name, email, role').in('id', chunk)
    )
    const profilesById = new Map([...orderProfiles, ...deliveryProfiles].map((profile) => [profile.id, profile]))
    const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
    const materialsById = new Map(materials.map((material) => [material.id, material]))

    const invoicesByOrderId = new Map<string, typeof detailedInvoices>()
    for (const invoice of detailedInvoices) {
      const list = invoicesByOrderId.get(invoice.order_id) ?? []
      list.push(invoice)
      invoicesByOrderId.set(invoice.order_id, list)
    }

    const latestDeliveryByOrderId = new Map<string, (typeof deliveries)[number]>()
    for (const delivery of deliveries) {
      const current = latestDeliveryByOrderId.get(delivery.order_id)
      if (!current || new Date(delivery.delivered_at ?? 0).getTime() > new Date(current.delivered_at ?? 0).getTime()) {
        latestDeliveryByOrderId.set(delivery.order_id, delivery)
      }
    }

    const ordersWithJoins = (orders ?? []).map((order) => {
      const supplier = order.supplier_id ? suppliersById.get(order.supplier_id) : null
      const profile = order.user_id ? profilesById.get(order.user_id) : null
      const material = order.material_item_id ? materialsById.get(order.material_item_id) : null
      const lastDelivery = latestDeliveryByOrderId.get(order.id)
      const deliveredByUser = lastDelivery?.received_by ? profilesById.get(lastDelivery.received_by) ?? null : null
      const orderInvoices = invoicesByOrderId.get(order.id) ?? []

      return {
        ...order,
        request_number: requestNumberById.get(order.purchase_request_id) || null,
        suppliers: supplier ? { name: supplier.name } : null,
        profiles: profile
          ? { full_name: profile.full_name, email: profile.email, role: profile.role }
          : null,
        purchase_request_items: material
          ? { item_name: material.item_name, unit: material.unit }
          : null,
        invoices: orderInvoices.map((invoice) => ({
          id: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          created_at: invoice.created_at,
        })),
        actual_delivered_at: lastDelivery?.delivered_at || order.delivered_at,
        delivered_by_user: deliveredByUser
          ? {
              full_name: deliveredByUser.full_name,
              email: deliveredByUser.email,
              role: deliveredByUser.role,
            }
          : null,
      }
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

    // Sevkiyat bilgilerini çek - tüm request'ler için
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
      .in('purchase_request_id', allRequestIds)
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

    // 3. Approval history - Site Manager onayları - tüm request'ler için
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
      .in('purchase_request_id', allRequestIds)
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

    const ordersById = new Map(finalOrders.map((order) => [order.id, order]))
    const finalInvoices = detailedInvoices.flatMap((invoice) => {
      const relatedOrder = ordersById.get(invoice.order_id)
      if (!relatedOrder) return []
      return [{
        ...invoice,
        orders: {
          purchase_request_id: relatedOrder.purchase_request_id,
          suppliers: relatedOrder.suppliers,
          purchase_request_items: relatedOrder.purchase_request_items,
          profiles: relatedOrder.profiles,
        },
      }]
    })

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
            notes: invoice.notes,
            subtotal: invoice.subtotal,
            discount: invoice.discount,
            tax: invoice.tax,
            grand_total: invoice.grand_total
          }
        })
      })
    }

    // Timeline'ı tarihe göre sırala
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Invoice group bilgilerini çek (eğer varsa)
    let invoiceGroupData = null
    let invoicesWithGroups = null
    let uniqueGroupIds: any[] = []
    
    if (finalInvoices && finalInvoices.length > 0) {
      invoicesWithGroups = finalInvoices.map((invoice) => ({
        id: invoice.id,
        invoice_group_id: invoice.invoice_group_id,
      }))
      
      // Eğer specific invoice_group_id belirtilmişse, onu kullan
      if (specificInvoiceGroupId) {
        console.log('🎯 Specific invoice group ID kullanılıyor:', specificInvoiceGroupId)
        const { data: groupInfo } = await supabase
          .from('invoice_groups')
          .select('subtotal, discount, tax, grand_total, currency')
          .eq('id', specificInvoiceGroupId)
          .single()
        
        if (groupInfo) {
          // Convert snake_case to camelCase for frontend
          invoiceGroupData = {
            subtotal: groupInfo.subtotal,
            discount: groupInfo.discount,
            tax: groupInfo.tax,
            grandTotal: groupInfo.grand_total,
            currency: groupInfo.currency
          }
          console.log('✅ Specific invoice group bilgileri alındı:', {
            groupId: specificInvoiceGroupId,
            subtotal: invoiceGroupData.subtotal,
            discount: invoiceGroupData.discount,
            tax: invoiceGroupData.tax,
            grandTotal: invoiceGroupData.grandTotal,
            currency: invoiceGroupData.currency
          })
        }
      } else {
        // Otomatik tespit: Eğer tüm invoice'lar aynı group'a aitse
        const groupIds = invoicesWithGroups?.map(inv => inv.invoice_group_id).filter(Boolean)
        uniqueGroupIds = [...new Set(groupIds)]
        
        if (uniqueGroupIds.length === 1 && uniqueGroupIds[0]) {
          const { data: groupInfo } = await supabase
            .from('invoice_groups')
            .select('subtotal, discount, tax, grand_total, currency')
            .eq('id', uniqueGroupIds[0])
            .single()
          
          if (groupInfo) {
            // Convert snake_case to camelCase for frontend
            invoiceGroupData = {
              subtotal: groupInfo.subtotal,
              discount: groupInfo.discount,
              tax: groupInfo.tax,
              grandTotal: groupInfo.grand_total,
              currency: groupInfo.currency
            }
            console.log('✅ Auto-detected invoice group bilgileri alındı:', {
              groupId: uniqueGroupIds[0],
              subtotal: invoiceGroupData.subtotal,
              discount: invoiceGroupData.discount,
              tax: invoiceGroupData.tax,
              grandTotal: invoiceGroupData.grandTotal,
              currency: invoiceGroupData.currency
            })
          }
        } else if (uniqueGroupIds.length > 1) {
          console.log('⚠️ Birden fazla invoice group bulundu, grup bilgileri kullanılmayacak:', {
            groupCount: uniqueGroupIds.length,
            groupIds: uniqueGroupIds
          })
        } else {
          console.log('ℹ️ Hiç invoice group bulunamadı')
        }
      }
    }

    const response = {
      request: requestData,
      allRequests: allRequestsData, // Tüm request'leri de ekle
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
        currency: finalOrders?.[0]?.currency || 'TRY',
        // Invoice group bilgilerini ekle (varsa) - already in camelCase
        subtotal: invoiceGroupData?.subtotal,
        discount: invoiceGroupData?.discount,
        tax: invoiceGroupData?.tax,
        grandTotal: invoiceGroupData?.grandTotal,
      },
      debug: {
        ordersFound: finalOrders?.length || 0,
        shipmentsFound: shipmentsWithUsers?.length || 0,
        invoicesFound: finalInvoices?.length || 0,
        ordersError: ordersError?.message,
        shipmentsError: shipmentsError?.message,
        requestIds: allRequestIds, // Tüm request ID'leri
        requestCount: allRequestIds.length,
        timelineLength: timeline.length,
        // Invoice group debug bilgileri
        invoiceGroupData: invoiceGroupData,
        hasInvoiceGroup: !!invoiceGroupData,
        invoiceGroupId: uniqueGroupIds?.[0] || specificInvoiceGroupId || null,
        invoicesWithGroupIds: invoicesWithGroups
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
      hasInvoiceInTimeline: response.timeline.some(t => t.type === 'invoice'),
      invoicesWithNotes: response.invoices.filter((inv: any) => inv.notes).length,
      invoicesNotesPreview: response.invoices.map((inv: any) => ({
        id: inv.id?.substring(0, 8),
        hasNotes: !!inv.notes,
        notes: inv.notes
      })),
      invoicesBreakdownPreview: response.invoices.map((inv: any) => ({
        id: inv.id?.substring(0, 8),
        amount: inv.amount,
        subtotal: inv.subtotal,
        discount: inv.discount,
        tax: inv.tax,
        grand_total: inv.grand_total
      }))
    })

    console.log('💰 Statistics Response:', {
      hasInvoiceGroup: !!invoiceGroupData,
      subtotal: response.statistics.subtotal,
      discount: response.statistics.discount,
      tax: response.statistics.tax,
      grandTotal: response.statistics.grandTotal,
      currency: response.statistics.currency,
      invoiceGroupData
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
