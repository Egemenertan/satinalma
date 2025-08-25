// Demo kullanıcıları oluşturma scripti
// npm run demo-users komutuyla çalıştırın

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key gerekli

const supabase = createClient(supabaseUrl, supabaseKey)

const demoUsers = [
  {
    email: 'demo@engineer.com',
    password: '123456',
    name: 'Demo Şantiye Sorumlusu',
    role: 'engineer'
  },
  {
    email: 'demo@procurement.com',
    password: '123456', 
    name: 'Demo Satın Alma Uzmanı',
    role: 'procurement_specialist'
  },
  {
    email: 'demo@manager.com',
    password: '123456',
    name: 'Demo Yönetici',
    role: 'project_manager'
  }
]

async function createDemoUsers() {
  console.log('Demo kullanıcıları oluşturuluyor...')
  
  for (const user of demoUsers) {
    try {
      // Auth kullanıcısını oluştur
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`✅ ${user.email} zaten mevcut`)
          continue
        }
        throw authError
      }

      // Users tablosuna profil ekle
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          password: 'auth_user',
          is_active: true,
          approval_limit: user.role === 'project_manager' ? 20000 : 
                         user.role === 'procurement_specialist' ? 5000 : 0
        })

      if (profileError) {
        console.error(`❌ ${user.email} profil hatası:`, profileError)
      } else {
        console.log(`✅ ${user.email} başarıyla oluşturuldu`)
      }

    } catch (error) {
      console.error(`❌ ${user.email} hatası:`, error)
    }
  }

  console.log('\nDemo kullanıcıları hazır!')
  console.log('Giriş bilgileri:')
  demoUsers.forEach(user => {
    console.log(`- ${user.email} / ${user.password} (${user.role})`)
  })
}

createDemoUsers().catch(console.error)


