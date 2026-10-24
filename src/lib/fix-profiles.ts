'use server'

import { createClient } from './supabase/server'

/**
 * Profiles tablosunda full_name alanı boş olan kayıtları email'den oluşturulmuş isimle günceller
 * Bu fonksiyon admin panelinden veya maintenance script olarak çalıştırılabilir
 */
export async function fixMissingProfileNames() {
  try {
    const supabase = await createClient()
    
    // 1. full_name boş olan profilleri bul
    const { data: emptyProfiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .or('full_name.is.null,full_name.eq.')
      .not('email', 'is', null)
    
    if (fetchError) {
      console.error('❌ Profiller alınırken hata:', fetchError)
      return { success: false, error: fetchError.message }
    }
    
    if (!emptyProfiles || emptyProfiles.length === 0) {
      console.log('✅ Tüm profillerde full_name mevcut')
      return { success: true, updated: 0, message: 'Güncellenecek profil bulunamadı' }
    }
    
    console.log(`📋 ${emptyProfiles.length} adet boş full_name bulundu, güncelleniyor...`)
    
    // 2. Her bir profil için email'den isim oluştur ve güncelle
    const updatePromises = emptyProfiles.map(async (profile) => {
      if (!profile.email) return null
      
      // Email'den isim oluştur
      const displayName = profile.email.split('@')[0]
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
      
      // Güncelle
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          full_name: displayName,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)
      
      if (updateError) {
        console.error(`❌ Profile güncelleme hatası (${profile.email}):`, updateError)
        return { success: false, email: profile.email, error: updateError.message }
      }
      
      console.log(`✅ Profile güncellendi: ${profile.email} → ${displayName}`)
      return { success: true, email: profile.email, newName: displayName }
    })
    
    const results = await Promise.all(updatePromises)
    const successCount = results.filter(r => r?.success).length
    const failCount = results.filter(r => r && !r.success).length
    
    console.log(`\n📊 Güncelleme Sonuçları:`)
    console.log(`   ✅ Başarılı: ${successCount}`)
    console.log(`   ❌ Başarısız: ${failCount}`)
    
    return {
      success: true,
      updated: successCount,
      failed: failCount,
      message: `${successCount} profil güncellendi, ${failCount} hata`
    }
    
  } catch (error) {
    console.error('💥 fixMissingProfileNames genel hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }
  }
}

/**
 * Auth.users'da olan ancak profiles'da olmayan kullanıcıları profiles'a ekler
 * Bu fonksiyon sadece admin tarafından çalıştırılmalıdır
 */
export async function syncAuthUsersToProfiles() {
  try {
    const supabase = await createClient()
    
    console.log('🔄 Auth kullanıcıları profiles ile senkronize ediliyor...')
    
    // Not: auth.users tablosuna doğrudan erişim RLS politikaları nedeniyle mümkün olmayabilir
    // Bu durumda Supabase Dashboard'dan SQL çalıştırılmalıdır
    
    return {
      success: false,
      message: 'Bu işlem için Supabase Dashboard SQL Editor kullanın: /sql/fix_missing_profiles.sql'
    }
    
  } catch (error) {
    console.error('💥 syncAuthUsersToProfiles hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }
  }
}

