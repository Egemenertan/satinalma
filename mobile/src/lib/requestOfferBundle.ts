import type { SupabaseClient } from '@supabase/supabase-js'

export type ShipmentInfo = {
  total_shipped: number
  shipments: Record<string, unknown>[]
}

export type BundleOrderRow = {
  id: string
  purchase_request_id?: string
  delivery_date: string | null
  created_at: string
  material_item_id: string | null
  quantity: number
  is_delivered: boolean
  delivered_quantity: number
  returned_quantity: number
  status?: string | null
  supplier_id: string | null
  supplier: {
    id: string
    name: string
    contact_person?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

export type RequestOfferBundle = {
  request: Record<string, unknown> & {
    id: string
    status: string | null
    request_number: string | null
    title: string | null
    site_name: string | null
    site_id: string | null
    requested_by: string | null
    urgency_level?: string | null
    it_workflow_applies?: boolean | null
    image_urls?: string[] | null
    purchase_request_items?: PurchaseRequestItemRow[]
  }
  materialOrders: BundleOrderRow[]
  shipmentData: Record<string, ShipmentInfo>
  currentOrder: Record<string, unknown> | null
}

export type PurchaseRequestItemRow = {
  id: string
  item_name: string
  description?: string | null
  quantity: number
  unit: string
  specifications?: string | null
  brand?: string | null
  original_quantity?: number | null
  image_urls?: string[] | null
  purpose?: string | null
  delivery_date?: string | null
  product_id?: string | null
  material_group?: string | null
  material_group_code?: string | null
  material_class?: string | null
  material_item_name?: string | null
}

/**
 * Web `useOfferData` ile aynı çekirdek: talep + kalemler, siparişler, gönderimler.
 */
export async function fetchRequestOfferBundle(
  supabase: SupabaseClient,
  requestId: string
): Promise<RequestOfferBundle | null> {
  const { data: row, error } = await supabase
    .from('purchase_requests')
    .select(
      `
      *,
      purchase_request_items (
        id,
        item_name,
        description,
        quantity,
        unit,
        specifications,
        brand,
        original_quantity,
        image_urls,
        purpose,
        delivery_date,
        product_id,
        material_group,
        material_group_code,
        material_class,
        material_item_name
      )
    `
    )
    .eq('id', requestId)
    .maybeSingle()

  if (error || !row) {
    return null
  }

  const request = row as RequestOfferBundle['request']

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(
      `
      id,
      purchase_request_id,
      delivery_date,
      created_at,
      material_item_id,
      quantity,
      returned_quantity,
      status,
      is_delivered,
      delivery_confirmed_at,
      supplier_id,
      supplier:suppliers ( id, name, contact_person, phone, email ),
      order_deliveries ( id, delivered_quantity, delivered_at, delivery_notes )
    `
    )
    .eq('purchase_request_id', requestId)
    .order('created_at', { ascending: true })

  if (ordersError) {
    console.warn('orders fetch', ordersError.message)
  }

  const materialOrders: BundleOrderRow[] = (orders ?? []).map((order: Record<string, unknown>) => {
    const od = order.order_deliveries as { delivered_quantity?: number }[] | undefined
    const totalDelivered =
      od && od.length > 0 ? od.reduce((sum, d) => sum + (d.delivered_quantity || 0), 0) : 0
    const rawSup = order.supplier as
      | BundleOrderRow['supplier']
      | BundleOrderRow['supplier'][]
      | null
      | undefined
    let sup: BundleOrderRow['supplier'] | null = null
    if (Array.isArray(rawSup)) {
      sup = rawSup[0]
        ? {
            id: rawSup[0].id,
            name: rawSup[0].name,
            contact_person: rawSup[0].contact_person ?? null,
            phone: rawSup[0].phone ?? null,
            email: rawSup[0].email ?? null,
          }
        : null
    } else if (rawSup) {
      sup = {
        id: rawSup.id,
        name: rawSup.name,
        contact_person: rawSup.contact_person ?? null,
        phone: rawSup.phone ?? null,
        email: rawSup.email ?? null,
      }
    }
    return {
      id: order.id as string,
      purchase_request_id: (order.purchase_request_id as string) ?? requestId,
      delivery_date: (order.delivery_date as string) ?? null,
      created_at: (order.created_at as string) ?? '',
      material_item_id: (order.material_item_id as string) ?? null,
      quantity: (order.quantity as number) || 0,
      is_delivered: Boolean(order.is_delivered),
      delivered_quantity: totalDelivered,
      returned_quantity: (order.returned_quantity as number) || 0,
      status: (order.status as string) ?? null,
      supplier_id: (order.supplier_id as string) ?? null,
      supplier: sup,
    }
  })

  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select('*')
    .eq('purchase_request_id', requestId)
    .order('shipped_at', { ascending: false })

  if (shipError) {
    console.warn('shipments fetch', shipError.message)
  }

  const shipmentData: Record<string, ShipmentInfo> = {}
  for (const shipment of shipments ?? []) {
    const s = shipment as { purchase_request_item_id?: string; shipped_quantity?: string | number }
    const itemId = s.purchase_request_item_id
    if (!itemId) continue
    const quantity = typeof s.shipped_quantity === 'string' ? parseFloat(s.shipped_quantity) : Number(s.shipped_quantity) || 0
    if (!shipmentData[itemId]) {
      shipmentData[itemId] = { total_shipped: 0, shipments: [] }
    }
    shipmentData[itemId].total_shipped += quantity
    shipmentData[itemId].shipments.push(shipment as Record<string, unknown>)
  }

  let currentOrder: Record<string, unknown> | null = null
  const { data: lastOrders } = await supabase
    .from('orders')
    .select(
      `
      *,
      supplier:suppliers ( id, name, contact_person, phone, email )
    `
    )
    .eq('purchase_request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (lastOrders?.length) {
    currentOrder = lastOrders[0] as Record<string, unknown>
  }

  return { request, materialOrders, shipmentData, currentOrder }
}
