import type { SupabaseClient, User } from '@supabase/supabase-js'
import { SPECIAL_SITE_ID } from './constants'
import {
  IT_STATUS_INCELEMEDE,
  normalizeMaterialGroupToken,
  purchaseLinesTriggerItWorkflow,
} from './it-workflow'
import type { ProfileRow } from './purchaseRequestsQuery'

export type CreateMaterialLine = {
  material_name: string
  quantity: number
  unit: string
  brand?: string
  material_class?: string
  material_group?: string
  material_item_name?: string
  specifications?: string
  purpose: string
  delivery_date?: string
  image_urls?: string[]
  product_id?: string
}

async function loadActiveItMaterialGroupTokens(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from('material_group_it_routes').select('material_group').eq('is_active', true)
  const set = new Set<string>()
  for (const row of data ?? []) {
    const t = normalizeMaterialGroupToken((row as { material_group?: string }).material_group)
    if (t) set.add(t)
  }
  return set
}

const HASAN_AUTO_APPROVE_EMAIL = 'hasan.oztunc@dovecgroup.com'

/**
 * Web createMultiMaterialPurchaseRequest ile aynı başlangıç durumu ve IT tetikleyici.
 * Bildirim / e-posta web sunucusunda kalır; approval_history eklenir.
 */
export async function createMultiMaterialPurchaseRequest(
  supabase: SupabaseClient,
  user: User,
  profile: ProfileRow,
  data: {
    materials: CreateMaterialLine[]
    site_id?: string
    site_name?: string
  }
): Promise<{ success: true; requestId: string; requestNumber: string } | { success: false; error: string }> {
  try {
    const itGroupTokens = await loadActiveItMaterialGroupTokens(supabase)
    const useItWorkflow = purchaseLinesTriggerItWorkflow(
      itGroupTokens,
      data.materials.map((m) => ({ material_class: m.material_class, material_group: m.material_group }))
    )

    const now = new Date()
    const requestNumber = `REQ-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const title =
      data.materials.length > 1
        ? `Çoklu Malzeme Talebi (${data.materials.length} adet)`
        : data.materials[0]?.material_name || 'Malzeme Talebi'

    const role = profile.role ?? ''
    const email = (user.email ?? '').toLowerCase()

    let initialStatus = 'pending'
    if (useItWorkflow) {
      initialStatus = IT_STATUS_INCELEMEDE
    } else if (email === HASAN_AUTO_APPROVE_EMAIL) {
      initialStatus = 'satın almaya gönderildi'
    } else if (role === 'santiye_depo_yonetici') {
      initialStatus = 'satın almaya gönderildi'
    } else if (role === 'santiye_depo' || role === 'purchasing_officer') {
      initialStatus = 'depoda mevcut değil'
    } else if (role === 'site_personnel' && data.site_id === SPECIAL_SITE_ID) {
      initialStatus = 'departman_onayı_bekliyor'
    } else if (role === 'department_head' && data.site_id === SPECIAL_SITE_ID) {
      initialStatus = 'pending'
    }

    const department = profile.department || 'Genel'

    const requestData = {
      request_number: requestNumber,
      title,
      description: null as string | null,
      department,
      total_amount: 0,
      currency: 'TRY',
      urgency_level: 'normal' as const,
      status: initialStatus,
      requested_by: user.id,
      site_id: data.site_id ?? null,
      site_name: data.site_name ?? null,
      delivery_date: null as string | null,
      image_urls: data.materials[0]?.image_urls ?? null,
      it_workflow_applies: useItWorkflow,
    }

    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .insert(requestData)
      .select()
      .single()

    if (requestError) throw new Error(requestError.message)
    if (!purchaseRequest) throw new Error('Talep oluşturulamadı')

    const itemsData = data.materials.map((material) => ({
      purchase_request_id: purchaseRequest.id,
      item_name: material.material_name,
      description: `${material.brand || ''} ${material.material_name}`.trim(),
      quantity: Math.round(material.quantity),
      original_quantity: Math.round(material.quantity),
      unit: material.unit,
      unit_price: 0,
      specifications: material.specifications || '',
      purpose: material.purpose,
      delivery_date: material.delivery_date || null,
      brand: material.brand || null,
      material_class: material.material_class || null,
      material_group: material.material_group || null,
      image_urls: material.image_urls || null,
      product_id: material.product_id || null,
      material_item_name: material.material_item_name?.trim() || material.material_name || null,
    }))

    const { error: itemsError } = await supabase.from('purchase_request_items').insert(itemsData)
    if (itemsError) throw new Error(itemsError.message)

    let historyComment = useItWorkflow
      ? `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme) — IT Yönetim incelemesinde (tetikleyici grup)`
      : `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme)`
    if (!useItWorkflow && email === HASAN_AUTO_APPROVE_EMAIL) {
      historyComment = `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme) - Hasan Öztunç tarafından otomatik olarak "Satın Almaya Gönderildi" durumunda oluşturuldu`
    } else if (!useItWorkflow && role === 'santiye_depo_yonetici') {
      historyComment = `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme) - Şantiye Depo Yöneticisi tarafından otomatik olarak "Satın Almaya Gönderildi" durumunda oluşturuldu`
    } else if (!useItWorkflow && role === 'santiye_depo') {
      historyComment = `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme) - Şantiye Depo tarafından otomatik olarak "Depoda Mevcut Değil" durumunda oluşturuldu`
    } else if (!useItWorkflow && role === 'purchasing_officer') {
      historyComment = `Çoklu malzeme talebi oluşturuldu (${data.materials.length} adet malzeme) - Satın Alma Sorumlusu tarafından otomatik olarak "Depoda Mevcut Değil" durumunda oluşturuldu`
    }

    await supabase.from('approval_history').insert({
      purchase_request_id: purchaseRequest.id,
      action: 'submitted',
      performed_by: user.id,
      comments: historyComment,
    })

    return {
      success: true,
      requestId: purchaseRequest.id as string,
      requestNumber: requestNumber,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Talep oluşturulamadı'
    return { success: false, error: msg }
  }
}
