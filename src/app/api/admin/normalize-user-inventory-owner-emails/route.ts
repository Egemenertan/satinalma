import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildDovecGroupWorkEmailFromDisplayName } from '@/lib/dovec-work-email'

export const dynamic = 'force-dynamic'

const PAGE = 500

/**
 * Mevcut user_inventory kayıtlarında owner_email alanını owner_name (veya user_id → profil adı) ile
 * standart ad.soyad@dovecgroup.com formatına getirir. Sadece admin / super_admin.
 */
export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role as string)) {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    let updatedFromOwnerName = 0
    let updatedFromProfile = 0

    let offset = 0
    for (;;) {
      const { data: rows, error } = await supabase
        .from('user_inventory')
        .select('id, owner_name, owner_email')
        .not('owner_name', 'is', null)
        .range(offset, offset + PAGE - 1)

      if (error) throw error
      if (!rows?.length) break

      for (const row of rows) {
        const name = (row.owner_name || '').trim()
        if (!name) continue
        const nextEmail = buildDovecGroupWorkEmailFromDisplayName(name)
        if (!nextEmail || nextEmail === row.owner_email) continue
        const { error: upErr } = await supabase
          .from('user_inventory')
          .update({ owner_email: nextEmail })
          .eq('id', row.id)
        if (!upErr) updatedFromOwnerName++
      }

      if (rows.length < PAGE) break
      offset += PAGE
    }

    offset = 0
    for (;;) {
      const { data: rows, error } = await supabase
        .from('user_inventory')
        .select('id, user_id, owner_name, owner_email')
        .is('owner_name', null)
        .not('user_id', 'is', null)
        .range(offset, offset + PAGE - 1)

      if (error) throw error
      if (!rows?.length) break

      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])]
      if (uids.length === 0) {
        if (rows.length < PAGE) break
        offset += PAGE
        continue
      }

      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', uids)

      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]))

      for (const row of rows) {
        if (!row.user_id) continue
        const p = pmap[row.user_id]
        const name = p?.full_name?.trim()
        if (!name) continue
        const nextEmail = buildDovecGroupWorkEmailFromDisplayName(name) || null
        const { error: upErr } = await supabase
          .from('user_inventory')
          .update({ owner_name: name, owner_email: nextEmail })
          .eq('id', row.id)
        if (!upErr) updatedFromProfile++
      }

      if (rows.length < PAGE) break
      offset += PAGE
    }

    return NextResponse.json({
      success: true,
      updatedFromOwnerName,
      updatedFromProfile,
      message: `${updatedFromOwnerName + updatedFromProfile} kayıt güncellendi (isimden: ${updatedFromOwnerName}, profilden: ${updatedFromProfile})`,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Bilinmeyen hata'
    console.error(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
