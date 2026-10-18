import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireReportsAdmin() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: NextResponse.json({ error: titleSafe('Oturum bulunamadı') }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: titleSafe('Bu Rapor Yalnızca Admin İçindir') }, { status: 403 }) }
  }
  return { supabase }
}

function titleSafe(message: string) {
  return message
}

export type ReportsSupabase = ReturnType<typeof createClient>
