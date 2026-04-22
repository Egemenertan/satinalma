import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Auth Handoff Endpoint
 * =====================
 *
 * Teams/Outlook embedded popup ↔ parent iframe token transit kanalı.
 *
 * - **POST**: Popup, OAuth tamamlandıktan sonra access/refresh token'ları
 *   `handoff_id` ile sunucuya yazar.
 * - **GET**:  Parent iframe handoff_id ile çeker; satır one-shot olarak
 *   okunup hemen silinir.
 *
 * Güvenlik:
 *   - handoff_id 32 karakterlik random UUID (parent tarafından üretilir,
 *     popup'a URL parametresiyle geçer; tahmin edilemez).
 *   - 5 dakika TTL.
 *   - Tek kullanım: GET satırı silerek atomik döner.
 *   - Yalnızca service_role kullanılır (RLS bypass).
 */

const HANDOFF_TTL_MINUTES = 5

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Sunucu yapılandırma hatası: Supabase env eksik')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: { id: string }
}

interface HandoffPayload {
  access_token: string
  refresh_token: string
  expires_at?: number
  user_email?: string
}

function validateHandoffId(id: string | undefined): string | null {
  if (!id || !UUID_REGEX.test(id)) return null
  return id.toLowerCase()
}

function isValidPayload(payload: unknown): payload is HandoffPayload {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  return typeof p.access_token === 'string' && typeof p.refresh_token === 'string'
}

/**
 * POST /api/auth/handoff/[id]
 * Popup tarafından çağrılır — token'ları kaydeder.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const id = validateHandoffId(params.id)
  if (!id) {
    return NextResponse.json({ error: 'Geçersiz handoff ID' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: 'Eksik token bilgisi' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MINUTES * 60 * 1000).toISOString()

    // Upsert: aynı id ile yeniden gelirse üzerine yaz (popup re-mount'a karşı)
    const { error } = await supabase
      .from('auth_handoffs')
      .upsert({
        id,
        tokens: payload,
        expires_at: expiresAt,
      })

    if (error) {
      console.error('[handoff] insert error', error)
      return NextResponse.json({ error: 'Handoff kaydedilemedi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[handoff] POST exception', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

/**
 * GET /api/auth/handoff/[id]
 * Parent iframe tarafından polling ile çağrılır.
 *  - Henüz yazılmamışsa 404 döner (parent retry eder).
 *  - Yazılmışsa: kaydı döner ve siler (one-shot).
 *  - Süresi geçmişse 410 (Gone).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const id = validateHandoffId(params.id)
  if (!id) {
    return NextResponse.json({ error: 'Geçersiz handoff ID' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()

    // Atomik delete + return (RETURNING gibi)
    const { data, error } = await supabase
      .from('auth_handoffs')
      .delete()
      .eq('id', id)
      .select('tokens, expires_at')
      .maybeSingle()

    if (error) {
      console.error('[handoff] delete-select error', error)
      return NextResponse.json({ error: 'Handoff okunamadı' }, { status: 500 })
    }

    if (!data) {
      // Henüz popup yazmadı → parent polling'e devam etsin
      return NextResponse.json({ error: 'pending' }, { status: 404 })
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
    if (expiresAt && expiresAt < Date.now()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }

    return NextResponse.json({ tokens: data.tokens })
  } catch (err) {
    console.error('[handoff] GET exception', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
