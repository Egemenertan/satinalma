'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔐 OAuth callback işleniyor...')
        console.log('🌐 URL:', window.location.href)

        // URL parametrelerinden code veya error kontrolü
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        console.log('🔍 URL params:', { hasCode: !!code, error, errorDescription })

        if (error) {
          console.error('❌ OAuth error:', error, errorDescription)
          window.location.href = `/auth/login?error=${error}`
          return
        }

        // Eğer code varsa, session'a exchange et
        if (code) {
          console.log('🔄 Code exchange ediliyor...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            console.error('❌ Code exchange error:', exchangeError)
            window.location.href = '/auth/login?error=code_exchange_failed'
            return
          }
          
          console.log('✅ Code exchange başarılı, session oluşturuldu')
          
          // Cookie'lerin set edilmesi için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Session bilgisini al
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        console.log('🔍 Session check:', { hasSession: !!session, error: sessionError })

        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          window.location.href = '/auth/login?error=session_error'
          return
        }

        if (!session) {
          console.log('⚠️  Session bulunamadı, login\'e yönlendiriliyor')
          window.location.href = '/auth/login?error=no_session'
          return
        }

        console.log('✅ Session bulundu:', session.user.id)
        console.log('📧 User email:', session.user.email)
        console.log('👤 User metadata:', session.user.user_metadata)
        console.log('🔑 Access token var mı?', !!session.access_token)
        console.log('⏰ Token expiry:', new Date(session.expires_at! * 1000).toLocaleString())

        // GÜVENLİK: Sadece şirket email'lerine izin ver
        const email = session.user.email || ''
        const allowedDomains = ['dovecgroup.com'] // İzin verilen domain'ler
        const isAllowedDomain = allowedDomains.some(domain => email.endsWith(`@${domain}`))
        
        if (!isAllowedDomain) {
          console.error('❌ Yetkisiz domain:', email)
          await supabase.auth.signOut() // Oturumu kapat
          window.location.href = '/auth/login?error=unauthorized_domain'
          return
        }
        
        console.log('✅ Yetkili domain: @dovecgroup.com')

        // Kullanıcının profilini kontrol et
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, email, full_name')
          .eq('id', session.user.id)
          .single()

        console.log('🔍 Profile check:', { profile, error: profileError })

        // Eğer profil yoksa oluştur (ilk Microsoft login)
        if (profileError && profileError.code === 'PGRST116') {
          console.log('📝 Profil bulunamadı, kontrol ediliyor...')
          
          const email = session.user.email || ''
          const allowedDomains = ['dovecgroup.com']
          const isCompanyEmail = allowedDomains.some(domain => email.endsWith(`@${domain}`))
          
          // ÖNEMLI: Aynı email ile başka bir profil var mı kontrol et
          const { data: existingProfile, error: existingError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single()
          
          if (existingProfile) {
            console.log('⚠️  Aynı email ile mevcut profil bulundu!')
            console.log('🔗 Hesap birleştirme yapılıyor...')
            console.log('📧 Mevcut profil ID:', existingProfile.id)
            console.log('🆕 Yeni Microsoft auth ID:', session.user.id)
            console.log('👤 Mevcut rol:', existingProfile.role)
            
            // ÇÖZÜM: Yeni Microsoft user'ı mevcut profile'a bağla
            // Mevcut profili kullan, yeni auth ID'yi kaydet
            
            // Eski auth user'ı sil (eğer varsa)
            try {
              await supabase.auth.admin.deleteUser(existingProfile.id)
              console.log('🗑️  Eski auth user silindi')
            } catch (e) {
              console.log('⚠️  Eski auth user silinemedi (sorun değil)')
            }
            
            // Mevcut profil verilerini yeni ID ile yeni profil oluştur
            // Eğer site_id yoksa ve rol site_personnel ise, default şantiyeleri ata
            const DEFAULT_SITES = {
              MERKEZ_OFIS: '9cf48170-f37f-4fc2-91d8-fe65e5f5b921',
              COURTYARD: '18e8e316-1291-429d-a591-5cec97d235b7'
            }
            
            let siteIds = existingProfile.site_id
            if (!siteIds && existingProfile.role === 'site_personnel') {
              siteIds = [DEFAULT_SITES.MERKEZ_OFIS, DEFAULT_SITES.COURTYARD]
              console.log('🏗️  Default şantiyeler atandı: Merkez Ofis + Courtyard')
            }
            
            const { error: newProfileError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id, // Yeni Microsoft auth ID
                email: existingProfile.email,
                full_name: existingProfile.full_name,
                role: existingProfile.role, // Mevcut rolü koru!
                department: existingProfile.department,
                site_id: siteIds,
                phone: existingProfile.phone,
                created_at: existingProfile.created_at
              })
            
            if (newProfileError) {
              console.error('❌ Profil birleştirme başarısız:', newProfileError)
              window.location.href = '/auth/login?error=profile_merge_failed'
              return
            }
            
            // Eski profili sil
            await supabase.from('profiles').delete().eq('id', existingProfile.id)
            
            console.log('✅ Hesap başarıyla birleştirildi! Mevcut rol korundu:', existingProfile.role)
            
            // Dashboard'a yönlendir - window.location.href kullanarak hard refresh
            if (existingProfile.role === 'site_manager' || existingProfile.role === 'site_personnel' || 
                existingProfile.role === 'santiye_depo' || existingProfile.role === 'santiye_depo_yonetici') {
              window.location.href = '/dashboard/requests'
            } else {
              window.location.href = '/dashboard'
            }
            return
          }
          
          console.log('📝 Yeni profil oluşturuluyor...')
          
          // Şirket email'i ise site_personnel, değilse user rolü ver
          const defaultRole = isCompanyEmail ? 'site_personnel' : 'user'
          
          // Site personnel için default şantiyeler: Merkez Ofis ve Courtyard
          const DEFAULT_SITES = {
            MERKEZ_OFIS: '9cf48170-f37f-4fc2-91d8-fe65e5f5b921',
            COURTYARD: '18e8e316-1291-429d-a591-5cec97d235b7'
          }
          
          const defaultSiteIds = isCompanyEmail && defaultRole === 'site_personnel' 
            ? [DEFAULT_SITES.MERKEZ_OFIS, DEFAULT_SITES.COURTYARD]
            : null
          
          console.log('📧 Email:', email)
          console.log('🏢 Şirket email\'i:', isCompanyEmail)
          console.log('👤 Atanan rol:', defaultRole)
          console.log('🏗️  Atanan şantiyeler:', defaultSiteIds)
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
              role: defaultRole,
              site_id: defaultSiteIds,
              created_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('❌ Profil oluşturulamadı:', insertError)
            window.location.href = '/auth/login?error=profile_creation_failed'
            return
          }

          console.log('✅ Profil oluşturuldu, rol:', defaultRole)
          
          // Eğer user rolü verilmişse (şirket dışı email) erişim reddet
          if (defaultRole === 'user') {
            window.location.href = '/auth/login?error=access_denied'
            return
          }
          
          // Şirket email'i ise direkt dashboard'a yönlendir - window.location.href kullanarak hard refresh
          console.log('🚀 Şirket kullanıcısı, dashboard\'a yönlendiriliyor...')
          window.location.href = '/dashboard/requests'
          return
        }

        if (profileError) {
          console.error('❌ Profile fetch error:', profileError)
          window.location.href = '/auth/login?error=profile_error'
          return
        }

        // User rolü dashboard'a erişemez - ama şirket email'i ise otomatik güncelle
        if (profile?.role === 'user') {
          const email = session.user.email || ''
          const isCompanyEmail = email.endsWith('@dovecgroup.com')
          
          if (isCompanyEmail) {
            console.log('🔄 Şirket email\'i tespit edildi, rol güncelleniyor: user → site_personnel')
            
            // Rolü otomatik güncelle
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'site_personnel' })
              .eq('id', session.user.id)
            
            if (updateError) {
              console.error('❌ Rol güncellenemedi:', updateError)
              window.location.href = '/auth/login?error=role_update_failed'
              return
            }
            
            console.log('✅ Rol güncellendi: site_personnel')
            // Requests sayfasına yönlendir - window.location.href kullanarak hard refresh
            window.location.href = '/dashboard/requests'
            return
          } else {
            console.log('❌ User role detected (şirket dışı email), access denied')
            window.location.href = '/auth/login?error=access_denied'
            return
          }
        }

        console.log('🚀 Redirecting to dashboard...')
        
        // Rol bazlı yönlendirme - window.location.href kullanarak hard refresh
        // Bu, cookie'lerin sunucu tarafında güncellenmesini sağlar
        if (profile?.role === 'site_manager' || profile?.role === 'site_personnel' || 
            profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
          window.location.href = '/dashboard/requests'
        } else {
          window.location.href = '/dashboard'
        }

      } catch (error) {
        console.error('🔥 Callback error:', error)
        window.location.href = '/auth/login?error=callback_failed'
      }
    }

    handleCallback()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <Loading size="lg" text="Giriş yapılıyor..." />
        <p className="mt-4 text-gray-600">Microsoft hesabınız doğrulanıyor...</p>
      </div>
    </div>
  )
}
