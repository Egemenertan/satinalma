import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fixMissingProfileNames } from '@/lib/fix-profiles'

/**
 * Admin endpoint - Eksik profile isimlerini düzelt
 * GET /api/admin/fix-profiles
 */
export async function GET() {
  try {
    // Kullanıcı kontrolü
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Oturum bulunamadı' },
        { status: 401 }
      )
    }
    
    // Admin kontrolü
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Bu işlem için admin yetkisi gerekli' },
        { status: 403 }
      )
    }
    
    // Profilleri düzelt
    const result = await fixMissingProfileNames()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        updated: result.updated,
        failed: result.failed || 0
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Fix profiles API error:', error)
    return NextResponse.json(
      { error: 'Profiller düzeltilirken hata oluştu' },
      { status: 500 }
    )
  }
}

