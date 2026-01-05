import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Kullanıcı authentication kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yetkilendirme hatası. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    // Mevcut kullanıcının rolünü ve site_id'sini kontrol et
    const { data: currentUserProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, site_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentUserProfile) {
      return NextResponse.json(
        { error: 'Kullanıcı profili bulunamadı' },
        { status: 404 }
      )
    }

    // Sadece site_manager rolündeki kullanıcılar rol değiştirebilir
    if (currentUserProfile.role !== 'site_manager') {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok. Sadece Site Manager rolü rol değiştirebilir.' },
        { status: 403 }
      )
    }

    // Request body'den userId ve newRole al
    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: 'userId ve newRole parametreleri gerekli' },
        { status: 400 }
      )
    }

    // Sadece site_manager ve site_personnel rolleri değiştirilebilir
    if (newRole !== 'site_manager' && newRole !== 'site_personnel') {
      return NextResponse.json(
        { error: 'Sadece site_manager ve site_personnel rolleri atanabilir' },
        { status: 400 }
      )
    }

    // Hedef kullanıcının profilini al
    const { data: targetUserProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, site_id')
      .eq('id', userId)
      .single()

    if (targetProfileError || !targetUserProfile) {
      return NextResponse.json(
        { error: 'Hedef kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Site ID kontrolü - aynı sitede olmalılar
    const currentUserSiteIds = Array.isArray(currentUserProfile.site_id) 
      ? currentUserProfile.site_id 
      : [currentUserProfile.site_id]
    
    const targetUserSiteIds = Array.isArray(targetUserProfile.site_id) 
      ? targetUserProfile.site_id 
      : [targetUserProfile.site_id]

    const hasCommonSite = currentUserSiteIds.some(siteId => 
      targetUserSiteIds.includes(siteId)
    )

    if (!hasCommonSite) {
      return NextResponse.json(
        { error: 'Sadece kendi sitenizde bulunan kullanıcıların rollerini değiştirebilirsiniz' },
        { status: 403 }
      )
    }

    // Admin ve purchasing_officer rolündeki kullanıcıların rolü değiştirilemez
    if (targetUserProfile.role === 'admin' || targetUserProfile.role === 'purchasing_officer') {
      return NextResponse.json(
        { error: 'Admin ve Purchasing Officer rolündeki kullanıcıların rolü değiştirilemez' },
        { status: 403 }
      )
    }

    // Hedef kullanıcı zaten bu role sahipse
    if (targetUserProfile.role === newRole) {
      return NextResponse.json(
        { error: `Bu kullanıcı zaten ${newRole === 'site_manager' ? 'Site Manager' : 'Site Personnel'} rolüne sahip` },
        { status: 400 }
      )
    }

    // Rolü güncelle (geçici rol bilgilerini temizle)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        role: newRole,
        // Geçici rol bilgilerini temizle
        original_role: null,
        temporary_role_start_date: null,
        temporary_role_end_date: null,
        temporary_role_assigned_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Rol güncelleme hatası:', updateError)
      return NextResponse.json(
        { error: 'Rol güncellenemedi: ' + updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ Rol başarıyla değiştirildi:', {
      targetUserId: userId,
      targetUserEmail: targetUserProfile.email,
      oldRole: targetUserProfile.role,
      newRole: newRole,
      changedBy: user.email
    })

    const roleNames = {
      site_manager: 'Site Manager',
      site_personnel: 'Site Personnel'
    }

    return NextResponse.json({
      success: true,
      message: `${targetUserProfile.full_name || targetUserProfile.email} rolü ${roleNames[targetUserProfile.role as keyof typeof roleNames] || targetUserProfile.role} → ${roleNames[newRole as keyof typeof roleNames]} olarak değiştirildi`,
      user: {
        id: userId,
        email: targetUserProfile.email,
        full_name: targetUserProfile.full_name,
        old_role: targetUserProfile.role,
        new_role: newRole
      }
    })

  } catch (error: any) {
    console.error('❌ Rol değiştirme API hatası:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası: ' + (error.message || 'Bilinmeyen hata') },
      { status: 500 }
    )
  }
}

