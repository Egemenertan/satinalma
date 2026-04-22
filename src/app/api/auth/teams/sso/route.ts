import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AZURE_CLIENT_ID = 'c3ee343a-b5dc-4ffa-9915-cffd6b8ce4b1'
const AZURE_TENANT_ID = '7d50fe1f-81de-4d1d-b8e9-7fcab3559841'
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET

export async function POST(request: NextRequest) {
  try {
    const { teamsToken } = await request.json()

    if (!teamsToken) {
      return NextResponse.json(
        { error: 'Teams token gerekli' },
        { status: 400 }
      )
    }

    if (!AZURE_CLIENT_SECRET) {
      console.error('AZURE_CLIENT_SECRET ortam değişkeni tanımlı değil')
      return NextResponse.json(
        { error: 'Sunucu yapılandırma hatası' },
        { status: 500 }
      )
    }

    console.log('🔷 Teams SSO token exchange başlatılıyor...')

    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: teamsToken,
      requested_token_use: 'on_behalf_of',
      scope: 'email openid profile User.Read'
    })

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('❌ Azure token exchange hatası:', errorData)
      return NextResponse.json(
        { error: 'Token exchange başarısız', details: errorData },
        { status: 400 }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Azure access token alındı')

    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    })

    if (!graphResponse.ok) {
      console.error('❌ Graph API hatası')
      return NextResponse.json(
        { error: 'Kullanıcı bilgileri alınamadı' },
        { status: 400 }
      )
    }

    const userData = await graphResponse.json()
    console.log('✅ Kullanıcı bilgileri alındı:', userData.mail || userData.userPrincipalName)

    const email = userData.mail || userData.userPrincipalName
    
    const allowedDomains = ['dovecgroup.com']
    const isAllowedDomain = allowedDomains.some(domain => email?.endsWith(`@${domain}`))
    
    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: 'Bu email adresi ile giriş yapılamaz' },
        { status: 403 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    
    let userId: string | null = null
    const users = existingUsers?.users || []
    const existingUser = users.find((u: { email?: string; id: string }) => u.email === email)
    
    if (existingUser) {
      userId = existingUser.id
      console.log('✅ Mevcut kullanıcı bulundu:', userId)
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: userData.displayName,
          provider: 'teams_sso'
        }
      })

      if (createError) {
        console.error('❌ Kullanıcı oluşturma hatası:', createError)
        return NextResponse.json(
          { error: 'Kullanıcı oluşturulamadı' },
          { status: 500 }
        )
      }

      userId = newUser.user.id
      console.log('✅ Yeni kullanıcı oluşturuldu:', userId)

      const DEFAULT_SITES = {
        MERKEZ_OFIS: '9cf48170-f37f-4fc2-91d8-fe65e5f5b921',
        COURTYARD: '18e8e316-1291-429d-a591-5cec97d235b7'
      }

      await supabaseAdmin.from('profiles').insert({
        id: userId,
        email,
        full_name: userData.displayName,
        role: 'site_personnel',
        site_id: [DEFAULT_SITES.MERKEZ_OFIS, DEFAULT_SITES.COURTYARD],
        created_at: new Date().toISOString()
      })
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.dovec.app'}/dashboard/requests`
      }
    })

    if (sessionError || !sessionData) {
      console.error('❌ Session oluşturma hatası:', sessionError)
      return NextResponse.json(
        { error: 'Oturum oluşturulamadı' },
        { status: 500 }
      )
    }

    console.log('✅ Teams SSO tamamlandı')

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name: userData.displayName
      },
      actionLink: sessionData.properties?.action_link
    })

  } catch (error) {
    console.error('🔥 Teams SSO error:', error)
    return NextResponse.json(
      { error: 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    )
  }
}
