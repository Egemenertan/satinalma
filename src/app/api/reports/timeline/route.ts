import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const IN_CHUNK = 200

const ORDER_COLUMNS = `
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
`

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
    const specificInvoiceGroupId = searchParams.get('invoiceGroupId')
    const isPdfPurpose = searchParams.get('purpose') === 'pdf'
    const requestedOrderIds = uniqueIds(
      (searchParams.get('orderIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    )

    if (!requestId && !specificInvoiceGroupId) {
      return NextResponse.json(
        { error: 'Request ID veya Invoice Group ID gerekli' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    await supabase.auth.getUser()

    let allRequestIds: string[] = requestId ? [requestId] : []
    let scopedOrderIds: string[] | null = requestedOrderIds.length > 0 ? requestedOrderIds : null

    if (specificInvoiceGroupId && requestedOrderIds.length === 0) {
      const { data: groupInvoices } = await supabase
        .from('invoices')
        .select('order_id')
        .eq('invoice_group_id', specificInvoiceGroupId)

      if (groupInvoices && groupInvoices.length > 0) {
        const groupOrderIds = uniqueIds(groupInvoices.map((invoice) => invoice.order_id))
        scopedOrderIds = groupOrderIds

        const { data: groupOrders } = await supabase
          .from('orders')
          .select('purchase_request_id')
          .in('id', groupOrderIds)

        if (groupOrders && groupOrders.length > 0) {
          allRequestIds = uniqueIds([
            ...allRequestIds,
            ...groupOrders.map((order) => order.purchase_request_id),
          ])
        }
      }
    } else if (requestedOrderIds.length > 0) {
      const { data: scopedOrders } = await supabase
        .from('orders')
        .select('purchase_request_id')
        .in('id', requestedOrderIds)

      if (scopedOrders && scopedOrders.length > 0) {
        allRequestIds = uniqueIds([
          ...allRequestIds,
          ...scopedOrders.map((order) => order.purchase_request_id),
        ])
      }
    }

    if (allRequestIds.length === 0) {
      return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    }

    let ordersQuery = supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .in('purchase_request_id', allRequestIds)
      .order('created_at', { ascending: true })

    if (scopedOrderIds && scopedOrderIds.length > 0) {
      ordersQuery = ordersQuery.in('id', scopedOrderIds)
    }

    const [requestsResult, ordersResult, offersResult, shipmentsResult, approvalsResult] = await Promise.all([
      supabase
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
        .in('id', allRequestIds),
      ordersQuery,
      isPdfPurpose || !requestId
        ? Promise.resolve({ data: [] as any[], error: null })
        : supabase
            .from('offers')
            .select('id, supplier_name, offer_amount, currency, created_at, approved_at, approval_reason, status')
            .eq('request_id', requestId)
            .order('created_at', { ascending: true }),
      isPdfPurpose
        ? Promise.resolve({ data: [] as any[], error: null })
        : supabase
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
            .order('shipped_at', { ascending: true }),
      supabase
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
        .order('created_at', { ascending: true }),
    ])

    const allRequestsData = requestsResult.data
    if (requestsResult.error || !allRequestsData || allRequestsData.length === 0) {
      return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    }

    if (ordersResult.error) throw new Error(ordersResult.error.message)

    const requestData = allRequestsData[0]
    const orders = ordersResult.data ?? []
    const offers = offersResult.data ?? []
    const shipments = shipmentsResult.data ?? []
    const approvals = approvalsResult.data ?? []

    const requestNumberById = new Map(
      allRequestsData
        .filter((item) => item.request_number)
        .map((item) => [item.id, item.request_number as string])
    )

    const orderIds = orders.map((order) => order.id)
    const supplierIds = uniqueIds(orders.map((order) => order.supplier_id))
    const profileIds = uniqueIds(orders.map((order) => order.user_id))
    const materialIds = uniqueIds(orders.map((order) => order.material_item_id))
    const shipmentUserIds = uniqueIds(shipments.map((shipment) => shipment.shipped_by))

    const [suppliers, orderProfiles, materials, detailedInvoices, deliveries, shipmentUsers] = await Promise.all([
      fetchInChunks(supplierIds, (chunk) =>
        supabase.from('suppliers').select('id, name').in('id', chunk)
      ),
      fetchInChunks(profileIds, (chunk) =>
        supabase.from('profiles').select('id, full_name, email, role').in('id', chunk)
      ),
      fetchInChunks(materialIds, (chunk) =>
        supabase.from('purchase_request_items').select('id, item_name, unit, purpose').in('id', chunk)
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
      fetchInChunks(shipmentUserIds, (chunk) =>
        supabase.from('profiles').select('id, full_name, email, role').in('id', chunk)
      ),
    ])

    const deliveryProfileIds = uniqueIds(
      deliveries
        .map((delivery) => delivery.received_by)
        .filter((id) => !orderProfiles.some((profile) => profile.id === id) && !shipmentUsers.some((profile) => profile.id === id))
    )
    const deliveryProfiles = await fetchInChunks(deliveryProfileIds, (chunk) =>
      supabase.from('profiles').select('id, full_name, email, role').in('id', chunk)
    )
    const profilesById = new Map(
      [...orderProfiles, ...shipmentUsers, ...deliveryProfiles].map((profile) => [profile.id, profile])
    )
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

    const finalOrders = orders.map((order) => {
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
          ? { item_name: material.item_name, unit: material.unit, purpose: material.purpose || null }
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

    const shipmentsWithUsers = shipments.map((shipment) => ({
      ...shipment,
      shipped_by_user: shipment.shipped_by ? profilesById.get(shipment.shipped_by) : undefined,
    }))

    const timeline: any[] = []

    timeline.push({
      date: requestData.created_at,
      action: 'Talep Oluşturuldu',
      actor: (requestData.profiles as any)?.full_name || (requestData.profiles as any)?.email || 'Bilinmeyen',
      details: `${requestData.title} talebi oluşturuldu`,
      type: 'creation',
    })

    shipmentsWithUsers.forEach((shipment) => {
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
          unit,
          shipped_by: userName,
          shipped_by_role: shippedUser?.role,
        },
      })
    })

    approvals.forEach((approval) => {
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
        type: 'approval',
      })
    })

    offers.forEach((offer) => {
      timeline.push({
        date: offer.created_at,
        action: 'Teklif Alındı',
        actor: 'Satın Alma Sorumlusu',
        details: `${offer.supplier_name} tedarikçisinden ${offer.offer_amount} ${offer.currency} teklif alındı`,
        type: 'offer',
      })

      if (offer.approved_at) {
        timeline.push({
          date: offer.approved_at,
          action: 'Teklif Onaylandı',
          actor: 'Şantiye Yöneticisi',
          details: `${offer.supplier_name} tedarikçisinin teklifi onaylandı${offer.approval_reason ? ` - ${offer.approval_reason}` : ''}`,
          type: 'offer_approval',
        })
      }
    })

    finalOrders.forEach((order) => {
      const orderUser = order.profiles
      const supplierInfo = order.suppliers
      const itemInfo = order.purchase_request_items
      const userName = orderUser?.full_name || orderUser?.email || 'Satın Alma Sorumlusu'
      const supplierName = supplierInfo?.name || 'Tedarikçi'
      const itemName = itemInfo?.item_name || 'Malzeme'

      let orderDetails = `${supplierName} tedarikçisine ${itemName} için ${order.quantity} ${itemInfo?.unit || 'adet'} sipariş verildi (${order.amount} ${order.currency})`

      if (order.returned_quantity && order.returned_quantity > 0) {
        orderDetails += ` - İade: ${order.returned_quantity} ${itemInfo?.unit || 'adet'}`
        if (order.return_notes) {
          orderDetails += ` (${order.return_notes})`
        }
      }

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
          ordered_by_role: orderUser?.role,
        },
      })

      if (order.delivered_at) {
        timeline.push({
          date: order.delivered_at,
          action: 'Teslimat Alındı',
          actor: 'Şantiye Personeli',
          details: `${itemName} malzemesi teslim alındı${order.delivery_notes ? ` - ${order.delivery_notes}` : ''}`,
          type: 'delivery',
        })
      }
    })

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

    finalInvoices.forEach((invoice) => {
      const order = invoice.orders
      const supplierName = order?.suppliers?.name || 'Tedarikçi'
      const itemName = order?.purchase_request_items?.item_name || 'Malzeme'
      const userName = order?.profiles?.full_name || order?.profiles?.email || 'Purchasing Officer'

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
          added_by_role: order?.profiles?.role,
          notes: invoice.notes,
          subtotal: invoice.subtotal,
          discount: invoice.discount,
          tax: invoice.tax,
          grand_total: invoice.grand_total,
        },
      })
    })

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let invoiceGroupData = null
    const invoicesWithGroups = finalInvoices.map((invoice) => ({
      id: invoice.id,
      invoice_group_id: invoice.invoice_group_id,
    }))
    const uniqueGroupIds = [...new Set(invoicesWithGroups.map((invoice) => invoice.invoice_group_id).filter(Boolean))]

    const groupIdToLoad = specificInvoiceGroupId || (uniqueGroupIds.length === 1 ? uniqueGroupIds[0] : null)
    if (groupIdToLoad) {
      const { data: groupInfo } = await supabase
        .from('invoice_groups')
        .select('subtotal, discount, tax, grand_total, currency')
        .eq('id', groupIdToLoad)
        .single()

      if (groupInfo) {
        invoiceGroupData = {
          subtotal: groupInfo.subtotal,
          discount: groupInfo.discount,
          tax: groupInfo.tax,
          grandTotal: groupInfo.grand_total,
          currency: groupInfo.currency,
        }
      }
    }

    return NextResponse.json({
      request: requestData,
      allRequests: allRequestsData,
      timeline,
      orders: finalOrders,
      shipments: shipmentsWithUsers,
      invoices: finalInvoices,
      statistics: {
        totalDays: Math.ceil(
          (new Date(finalOrders[0]?.delivered_at || new Date()).getTime() -
            new Date(requestData.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        totalOffers: offers.length,
        totalShipments: shipmentsWithUsers.length,
        totalInvoices: finalInvoices.length,
        totalAmount: finalOrders[0]?.amount || 0,
        currency: finalOrders[0]?.currency || 'TRY',
        subtotal: invoiceGroupData?.subtotal,
        discount: invoiceGroupData?.discount,
        tax: invoiceGroupData?.tax,
        grandTotal: invoiceGroupData?.grandTotal,
      },
      debug: isPdfPurpose
        ? undefined
        : {
            ordersFound: finalOrders.length,
            shipmentsFound: shipmentsWithUsers.length,
            invoicesFound: finalInvoices.length,
            requestIds: allRequestIds,
            requestCount: allRequestIds.length,
            timelineLength: timeline.length,
            invoiceGroupData,
            hasInvoiceGroup: !!invoiceGroupData,
            invoiceGroupId: uniqueGroupIds[0] || specificInvoiceGroupId || null,
            invoicesWithGroupIds: invoicesWithGroups,
          },
    })
  } catch (error) {
    console.error('Timeline API hatası:', error)
    return NextResponse.json(
      { error: 'Timeline verileri alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
