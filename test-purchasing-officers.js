// Test: Purchasing Officer kullanıcılarını kontrol et
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testPurchasingOfficers() {
  console.log('🔍 Purchasing Officer kullanıcıları kontrol ediliyor...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Purchasing officer rolündeki kullanıcıları al
    const { data: officers, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('role', 'purchasing_officer');
    
    if (error) {
      console.error('❌ Hata:', error);
      return;
    }
    
    if (!officers || officers.length === 0) {
      console.log('⚠️  Hiç purchasing_officer rolünde kullanıcı bulunamadı!');
      console.log('\n📝 Çözüm: Supabase\'de bir kullanıcının role\'ünü "purchasing_officer" yapın.\n');
      return;
    }
    
    console.log(`✅ ${officers.length} purchasing officer bulundu:\n`);
    
    officers.forEach((officer, index) => {
      console.log(`${index + 1}. ${officer.full_name || 'İsimsiz'}`);
      console.log(`   Email: ${officer.email || '❌ Email yok!'}`);
      console.log(`   ID: ${officer.id}`);
      console.log('');
    });
    
    const withoutEmail = officers.filter(o => !o.email);
    if (withoutEmail.length > 0) {
      console.log(`⚠️  ${withoutEmail.length} kullanıcının email adresi yok!`);
    }
    
    const withEmail = officers.filter(o => o.email);
    console.log(`\n📧 Email gönderilecek: ${withEmail.length} kullanıcı`);
    
  } catch (error) {
    console.error('❌ Hata:', error);
  }
}

testPurchasingOfficers();
