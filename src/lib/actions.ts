'use server'

import { createClient } from './supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'



// Güvenlik: Kullanıcı kimlik doğrulaması
async function getAuthenticatedUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  // Kullanıcı detaylarını al
  const { data: userData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!userData) {
    throw new Error('Kullanıcı profili bulunamadı')
  }

  return userData
}

// Güvenlik: Role-based access control
async function checkRole(userRole: string, allowedRoles: string[]) {
  if (!allowedRoles.includes(userRole)) {
    throw new Error('Insufficient permissions')
  }
}

export async function createPurchaseRequest(data: {
  material: string
  quantity: number
  unit: string
  description: string
  purpose?: string
  site_id?: string
  site_name?: string
  brand?: string
  material_class?: string
  material_group?: string
  material_item_name?: string
  image_urls?: string[]
}) {
  try {
    // Gerçek kullanıcıyı al
    const user = await getAuthenticatedUser()
    const supabase = createClient()
    
    // Tarih ve request number oluştur
    const now = new Date()
    const requestNumber = `REQ-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    // Purchase request data hazırla - direkt pending status ile oluştur
    const requestData = {
      request_number: requestNumber,
      title: data.material,
      description: data.description,
      department: user.department || 'Genel',
      total_amount: 0,
      currency: 'TRY',
      urgency_level: 'normal' as const,
      status: 'pending' as const, // Direkt pending olarak oluştur
      requested_by: user.id,
      site_id: data.site_id || null,
      site_name: data.site_name || null,
      material_class: data.material_class || null,
      material_group: data.material_group || null,
      material_item_name: data.material_item_name || null,
      image_urls: data.image_urls || null
    }
    
    // Purchase request oluştur
    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .insert(requestData)
      .select()
      .single()

    if (requestError) {
      throw new Error(`Purchase request oluşturulamadı: ${requestError.message}`)
    }

    // Purchase request item ekle
    const itemData = {
      purchase_request_id: purchaseRequest.id,
      item_name: data.material,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unit_price: 0,
      specifications: data.purpose || 'Şantiye ihtiyacı'
    }
    
    const { error: itemError } = await supabase
      .from('purchase_request_items')
      .insert(itemData)

    if (itemError) {
      throw new Error(`Purchase request item oluşturulamadı: ${itemError.message}`)
    }

    // Approval history kaydı ekle (kritik değil)
    const historyData = {
      purchase_request_id: purchaseRequest.id,
      action: 'submitted' as const,
      performed_by: user.id,
      comments: 'Talep oluşturuldu'
    }
    
    await supabase
      .from('approval_history')
      .insert(historyData)

    revalidatePath('/dashboard/requests')
    return { success: true, data: purchaseRequest }
  } catch (error) {
    console.error('Error creating purchase request:', error)
    
    let errorMessage = 'Talep oluşturulurken hata oluştu'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return { success: false, error: errorMessage }
  }
}

export async function addOffers(requestId: string, offers: Array<{
  supplier_name: string
  unit_price: number
  total_price: number
  delivery_days: number
  delivery_date: string
  notes: string
  currency: string
  document_urls?: string[]
}>) {
  try {
    console.log('addOffers called with requestId:', requestId, 'offers:', offers)
    
    // Gerçek kullanıcıyı al
    const user = await getAuthenticatedUser()

    const supabase = createClient()
    
    // Talep var mı kontrol et ve şantiye bilgisini al
    const { data: request, error: requestError } = await supabase
      .from('purchase_requests')
      .select('id, status, site_id, site_name')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      console.error('Purchase request not found:', requestError)
      throw new Error('Satın alma talebi bulunamadı')
    }

    console.log('Found request:', request)

    // Teklifleri ekle (şantiye bilgisi dahil)
    const offerInserts = offers.map(offer => ({
      purchase_request_id: requestId,
      supplier_name: offer.supplier_name,
      unit_price: offer.unit_price,
      total_price: offer.total_price,
      delivery_days: offer.delivery_days,
      delivery_date: offer.delivery_date || null,
      notes: offer.notes || null,
      document_urls: offer.document_urls || [],
      currency: offer.currency,
      is_selected: false,
      site_id: request.site_id,
      site_name: request.site_name
    }))

    console.log('📥 Received offers with documents:', offers.map(o => ({ supplier: o.supplier_name, urls: o.document_urls })))
    console.log('📋 Inserting offers:', offerInserts)

    const { data: insertedOffers, error: offersError } = await supabase
      .from('offers')
      .insert(offerInserts)
      .select()

    if (offersError) {
      console.error('Error inserting offers:', offersError)
      throw offersError
    }

    console.log('Offers inserted successfully:', insertedOffers)

    // Toplam teklif sayısını kontrol et
    const { data: allOffers, error: countError } = await supabase
      .from('offers')
      .select('id')
      .eq('purchase_request_id', requestId)

    if (countError) {
      console.error('Error counting offers:', countError)
      throw countError
    }

    const totalOffers = allOffers?.length || 0
    console.log('Total offers for this request:', totalOffers)

    // Eğer toplam 3 veya daha fazla teklif varsa status'u 'awaiting_offers' yap
    if (totalOffers >= 3) {
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({ status: 'awaiting_offers' })
        .eq('id', requestId)

      if (updateError) {
        console.error('Error updating request status:', updateError)
        throw updateError
      }

      console.log('Request status updated to awaiting_offers (3+ offers received)')
    } else {
      console.log('Still waiting for more offers. Current count:', totalOffers)
    }

    // Approval history kaydı ekle
    await supabase
      .from('approval_history')
      .insert({
        purchase_request_id: requestId,
        action: 'submitted',
        performed_by: user.id,
        comments: `${offers.length} teklif eklendi`
      })

    revalidatePath('/dashboard/requests')
    return { success: true, data: insertedOffers }
  } catch (error) {
    console.error('Error adding offers:', error)
    
    let errorMessage = 'Teklifler eklenirken hata oluştu'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return { success: false, error: errorMessage }
  }
}

export async function createMaterialItem(data: {
  class: string
  group: string
  item_name: string
}) {
  try {
    console.log('🔧 createMaterialItem server action başlatıldı')
    console.log('📋 Received data:', data)
    
    // Gerçek kullanıcıyı al (authentication için)
    console.log('👤 Kullanıcı doğrulanıyor...')
    const user = await getAuthenticatedUser()
    console.log('✅ Kullanıcı doğrulandı:', { id: user.id, role: user.role })
    
    // Şimdilik basit çözüm: existing check yap, yoksa manual SQL ile ekle
    const supabase = createClient()
    
    // Önce kontrol et - bu malzeme zaten var mı?
    console.log('🔍 Malzeme mevcut mu kontrol ediliyor...')
    const { data: existingMaterial } = await supabase
      .from('all_materials')
      .select('*')
      .eq('class', data.class)
      .eq('group', data.group)
      .eq('item_name', data.item_name)
      .maybeSingle()
    
    if (existingMaterial) {
      console.log('✅ Malzeme zaten mevcut:', existingMaterial)
      return { success: true, data: existingMaterial }
    }
    
    console.log('💾 Malzeme mevcut değil, ekleme deneniyor...')
    
    // Önce tüm mevcut malzemeleri alalım (debug için)
    const { data: allMaterials, error: allError } = await supabase
      .from('all_materials')
      .select('id, class, group, item_name')
      .limit(5)
    
    console.log('📊 Mevcut malzemeler (ilk 5):', allMaterials)
    console.log('📊 Query error (if any):', allError)
    
    // Gerçek insert işlemini dene
    console.log('💾 Gerçek insert işlemi deneniyor...')
    const { data: newMaterial, error: insertError } = await supabase
      .from('all_materials')
      .insert([{
        class: data.class,
        group: data.group,
        item_name: data.item_name
      }])
      .select()
      .single()
    
    console.log('📥 Insert sonucu:', { newMaterial, insertError })
    
    if (insertError) {
      console.error('❌ Insert hatası:', insertError)
      throw new Error(`Malzeme ekleme hatası: ${insertError.message}`)
    }
    
    console.log('✅ Malzeme başarıyla eklendi:', newMaterial)
    return { success: true, data: newMaterial }
  } catch (error) {
    console.error('💥 createMaterialItem genel hatası:', error)
    
    let errorMessage = 'Malzeme öğesi oluşturulurken hata oluştu'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    console.error('📤 Error response:', { success: false, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

export async function createApproval(data: {
  request_id: string
  decision: 'approved' | 'rejected'
  comment: string
}) {
  try {
    const user = await getAuthenticatedUser()
    
    // Sadece approver'lar onay verebilir
    await checkRole(user.role, ['approver'])

    const supabase = createClient()
    
    // Talep var mı ve onay bekliyor mu kontrol et
    const { data: request, error: requestError } = await supabase
      .from('purchase_requests')
      .select('id, status')
      .eq('id', data.request_id)
      .eq('status', 'pending_approval')
      .single()

    if (requestError || !request) {
      throw new Error('Request not found or not awaiting approval')
    }

    const { data: result, error } = await supabase
      .from('approvals')
      .insert({
        request_id: data.request_id,
        approval_level: 1,
        approver_id: user.id,
        required_amount: 0,
        status: data.decision === 'approved' ? 'approved' : 'rejected',
        decision_date: new Date().toISOString(),
        comments: data.comment
      } as any)
      .select()
      .single()

    if (error) throw error

    // Update request status
    const newStatus = data.decision === 'approved' ? 'approved' : 'rejected'
    const { error: updateError } = await supabase
      .from('purchase_requests')
      .update({ status: newStatus } as any)
      .eq('id', data.request_id)

    if (updateError) throw updateError

    revalidatePath('/')
    return { success: true, data: result }
  } catch (error) {
    console.error('Error creating approval:', error)
    return { success: false, error: 'Onay oluşturulurken hata oluştu' }
  }
}

export async function markAsOrdered(requestId: string) {
  try {
    const user = await getAuthenticatedUser()
    
    // Sadece chief'lar sipariş işaretleyebilir
    await checkRole(user.role, ['chief'])

    const supabase = createClient()
    
    // Talep durumunu kontrol et
    const { data: request, error: requestError } = await supabase
      .from('purchase_requests')
      .select('id, status')
      .eq('id', requestId)
      .in('status', ['approved'])
      .single()

    if (requestError || !request) {
      throw new Error('Request not found or not ready for ordering')
    }

    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: 'ordered' } as any)
      .eq('id', requestId)

    if (error) throw error

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Error marking as ordered:', error)
    return { success: false, error: 'Sipariş işaretlenirken hata oluştu' }
  }
}

export async function getPurchaseRequests() {
  try {
    // Gerçek kullanıcıyı al
    const user = await getAuthenticatedUser()
    
    const supabase = createClient()
    
    let query = supabase
      .from('purchase_requests')
      .select(`
        *,
        profiles:requested_by (
          full_name,
          email,
          department
        ),
        purchase_request_items (
          id,
          item_name,
          quantity,
          unit,
          unit_price,
          total_price
        )
      `)
      .order('created_at', { ascending: false })

    // Role-based filtering - basit yaklaşım
    if (user.role === 'user') {
      // Normal kullanıcılar sadece kendi taleplerini görebilir
      query = query.eq('requested_by', user.id)
    }
    // Manager ve admin'ler tüm talepleri görebilir

    const { data, error } = await query

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching purchase requests:', error)
    return { success: false, error: 'Talepler yüklenirken hata oluştu' }
  }
}

export async function getOffers() {
  try {
    const user = await getAuthenticatedUser()
    
    // Sadece chief'lar teklifleri görebilir
    await checkRole(user.role, ['chief'])

    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching offers:', error)
    return { success: false, error: 'Teklifler yüklenirken hata oluştu' }
  }
}

export async function getApprovals() {
  try {
    const user = await getAuthenticatedUser()
    
    // Sadece approver'lar onayları görebilir
    await checkRole(user.role, ['approver'])

    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return { success: false, error: 'Onaylar yüklenirken hata oluştu' }
  }
}

// Şantiye harcama tutarını güncelle
export async function updateSiteExpenses(siteId: string, approvedAmount: number) {
  try {
    const supabase = createClient()
    
    // Mevcut harcama tutarını al
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('approved_expenses')
      .eq('id', siteId)
      .single()
    
    if (siteError) {
      console.error('Site fetch error:', siteError)
      return { success: false, error: 'Şantiye bilgisi alınamadı' }
    }
    
    const currentExpenses = parseFloat(site.approved_expenses) || 0
    const newTotal = currentExpenses + approvedAmount
    
    // Şantiye harcama tutarını güncelle
    const { error: updateError } = await supabase
      .from('sites')
      .update({ 
        approved_expenses: newTotal,
        updated_at: new Date().toISOString()
      })
      .eq('id', siteId)
    
    if (updateError) {
      console.error('Site expense update error:', updateError)
      return { success: false, error: 'Harcama tutarı güncellenemedi' }
    }
    
    console.log(`✅ Site ${siteId} expenses updated: ${currentExpenses} + ${approvedAmount} = ${newTotal}`)
    return { success: true, newTotal }
    
  } catch (error) {
    console.error('Error updating site expenses:', error)
    return { success: false, error: 'Harcama güncellemesi sırasında hata oluştu' }
  }
}

// Güvenlik: Kullanıcı çıkışı
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
