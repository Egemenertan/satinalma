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

    // Sadece site_manager rolündeki kullanıcılar rol atayabilir
    if (currentUserProfile.role !== 'site_manager') {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok. Sadece Site Manager rolü rol atayabilir.' },
        { status: 403 }
      )
    }

    // Request body'den userId, role ve tarih bilgilerini al
    const { userId, role, startDate, endDate } = await request.json()

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId ve role parametreleri gerekli' },
        { status: 400 }
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Başlangıç ve bitiş tarihleri gerekli' },
        { status: 400 }
      )
    }

    // Tarih validasyonu
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()

    if (start < now) {
      return NextResponse.json(
        { error: 'Başlangıç tarihi geçmiş bir tarih olamaz' },
        { status: 400 }
      )
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır' },
        { status: 400 }
      )
    }

    // Sadece site_manager rolü atanabilir
    if (role !== 'site_manager') {
      return NextResponse.json(
        { error: 'Sadece site_manager rolü atanabilir' },
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
        { error: 'Sadece kendi sitenizde bulunan kullanıcılara rol atayabilirsiniz' },
        { status: 403 }
      )
    }

    // Hedef kullanıcı zaten site_manager ise
    if (targetUserProfile.role === 'site_manager') {
      return NextResponse.json(
        { error: 'Bu kullanıcı zaten Site Manager rolüne sahip' },
        { status: 400 }
      )
    }

    // Geçici rolü ata (orijinal rolü kaydet)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        original_role: targetUserProfile.role, // Mevcut rolü kaydet
        role: role, // Yeni rolü ata
        temporary_role_start_date: start.toISOString(),
        temporary_role_end_date: end.toISOString(),
        temporary_role_assigned_by: user.id,
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

    console.log('✅ Geçici rol başarıyla atandı:', {
      targetUserId: userId,
      targetUserEmail: targetUserProfile.email,
      originalRole: targetUserProfile.role,
      newRole: role,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      assignedBy: user.email
    })

    // Tarih formatı (Türkçe)
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return NextResponse.json({
      success: true,
      message: `${targetUserProfile.full_name || targetUserProfile.email} ${formatDate(start)} - ${formatDate(end)} tarihleri arasında Site Manager rolüne atandı. Bu süre sonunda rol otomatik olarak eski haline dönecektir.`,
      user: {
        id: userId,
        email: targetUserProfile.email,
        full_name: targetUserProfile.full_name,
        role: role,
        original_role: targetUserProfile.role,
        temporary_role_start_date: start.toISOString(),
        temporary_role_end_date: end.toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ Rol atama API hatası:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası: ' + (error.message || 'Bilinmeyen hata') },
      { status: 500 }
    )
  }
}

