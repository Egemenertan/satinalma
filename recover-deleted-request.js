/**
 * Silinmiş Talep Kurtarma Script
 * 
 * Kullanım:
 * 1. Talep bilgilerini aşağıya gir
 * 2. node recover-deleted-request.js
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase connection (SERVICE_ROLE_KEY gerekli - RLS'i bypass etmek için)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ .env dosyasında SUPABASE_SERVICE_ROLE_KEY eksik!')
  console.log('Şunu ekle: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ============================================================================
// SİLİNMİŞ TALEBİN BİLGİLERİ
// ============================================================================
const DELETED_REQUEST = {
  // Site
  site_id: 'b99e2366-82c5-43a4-9b0f-9e8b90a22f6c', // Courtyard Platinum
  
  // Talep oluşturan (USER_ID'yi buraya gir)
  requested_by: 'YOUR_USER_ID_HERE', // Talep oluşturan kişinin ID'si
  
  // Malzeme bilgileri
  items: [
    {
      item_name: 'BALKON SÜZGEÇİ SUGAR',
      quantity: 310,
      unit: 'adet',
      brand: '', // Marka biliniyorsa
      specifications: '', // Açıklama
      material_class: '', // Varsa
      material_group: '', // Varsa
    }
  ],
  
  // Talep detayları
  urgency_level: 'normal', // normal, high, urgent
  specifications: 'Yanlışlıkla silinen talep - tekrar oluşturuldu',
  status: 'santiye ön onayı bekliyor', // Başlangıç durumu
}

// ============================================================================
// KURTARMA FONKSİYONU
// ============================================================================
async function recoverRequest() {
  try {
    console.log('🔍 Talep kurtarma başlatılıyor...')
    
    // 1. Purchase request oluştur
    const { data: newRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .insert({
        site_id: DELETED_REQUEST.site_id,
        requested_by: DELETED_REQUEST.requested_by,
        urgency_level: DELETED_REQUEST.urgency_level,
        specifications: DELETED_REQUEST.specifications,
        status: DELETED_REQUEST.status,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (requestError) {
      console.error('❌ Talep oluşturulamadı:', requestError)
      return
    }
    
    console.log('✅ Talep oluşturuldu:', newRequest.request_number)
    
    // 2. Malzemeleri ekle
    const items = DELETED_REQUEST.items.map(item => ({
      purchase_request_id: newRequest.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit,
      brand: item.brand,
      specifications: item.specifications,
      material_class: item.material_class,
      material_group: item.material_group,
    }))
    
    const { error: itemsError } = await supabase
      .from('purchase_request_items')
      .insert(items)
    
    if (itemsError) {
      console.error('❌ Malzemeler eklenemedi:', itemsError)
      return
    }
    
    console.log('✅ Malzemeler eklendi:', items.length, 'adet')
    
    // 3. Audit log kaydı
    await supabase
      .from('audit_log')
      .insert({
        purchase_request_id: newRequest.id,
        action_type: 'request_recovered',
        performed_by: DELETED_REQUEST.requested_by,
        user_role: 'admin',
        user_name: 'System Recovery',
        description: 'Yanlışlıkla silinmiş talep kurtarıldı',
        performed_at: new Date().toISOString(),
        metadata: {
          recovery_reason: 'Manual recovery',
          original_items: DELETED_REQUEST.items
        }
      })
    
    console.log('✅ Audit log kaydı oluşturuldu')
    console.log('')
    console.log('🎉 BAŞARILI! Talep kurtarıldı:')
    console.log('   - Request Number:', newRequest.request_number)
    console.log('   - Request ID:', newRequest.id)
    console.log('   - Site:', 'Courtyard Platinum')
    console.log('   - Link:', `https://satinalma.dovecgroup.com/dashboard/requests/${newRequest.id}`)
    
  } catch (error) {
    console.error('🔥 Beklenmeyen hata:', error)
  }
}

// ============================================================================
// ARAMA FONKSİYONU - Silinen talebi bulmayı dene
// ============================================================================
async function searchDeletedRequest() {
  console.log('🔍 Silinmiş talep aranıyor...\n')
  
  // Audit log'da ara
  const { data: auditLogs, error } = await supabase
    .from('audit_log')
    .select('*')
    .or('description.ilike.%balkon%,description.ilike.%süzgeç%,metadata::text.ilike.%310%')
    .order('performed_at', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error('❌ Audit log okunamadı:', error)
  } else if (auditLogs && auditLogs.length > 0) {
    console.log('📋 Audit log kayıtları bulundu:', auditLogs.length)
    auditLogs.forEach(log => {
      console.log(`  - ${log.performed_at}: ${log.action_type} - ${log.description}`)
    })
  } else {
    console.log('⚠️  Audit log'da kayıt bulunamadı')
  }
  
  console.log('\n' + '='.repeat(80) + '\n')
}

// ============================================================================
// ÇALIŞTIR
// ============================================================================
async function main() {
  console.log('=' .repeat(80))
  console.log('SİLİNMİŞ TALEP KURTARMA')
  console.log('=' .repeat(80))
  console.log('')
  
  // Önce ara
  await searchDeletedRequest()
  
  // UYARI göster
  console.log('⚠️  UYARI: Bu script yeni bir talep oluşturacak.')
  console.log('   Önce DELETED_REQUEST nesnesini güncelle!')
  console.log('')
  console.log('   1. requested_by: Talep oluşturan kişinin USER_ID\'si')
  console.log('   2. items: Malzeme bilgilerini kontrol et')
  console.log('   3. urgency_level, specifications vb. düzenle')
  console.log('')
  console.log('   Hazır olduğunda, bu satırın yorumunu kaldır:')
  console.log('   // await recoverRequest()')
  console.log('')
  
  // Kurtarma fonksiyonunu çalıştırmak için yorum satırını kaldır:
  // await recoverRequest()
}

main()
