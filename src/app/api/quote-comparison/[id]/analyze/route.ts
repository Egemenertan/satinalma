import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/anthropicClient'
import {
  createQuoteComparisonJobClient,
  runQuoteComparisonAnalysis,
} from '@/lib/ai/runQuoteComparisonAnalysis'

export const runtime = 'nodejs'
// Çok kalemli/çok sayfalı tekliflerde AI çıkışı (max_tokens) büyüdükçe analiz süresi de
// uzayabiliyor; 180s bazı büyük dokümanlarda yetersiz kalıp fonksiyonu ortasında kesiyordu.
// 300s hem Hobby hem Pro planında ek konfigürasyon gerektirmeyen güvenli üst sınır.
export const maxDuration = 300

const ALLOWED_ROLES = ['admin', 'manager', 'purchasing_officer']
const MAX_PRIORITY_CRITERIA_LENGTH = 2000

async function readPriorityCriteria(request: NextRequest): Promise<string | undefined> {
  try {
    const body = await request.json()
    if (typeof body?.priorityCriteria !== 'string') return undefined
    const trimmed = body.priorityCriteria.trim().slice(0, MAX_PRIORITY_CRITERIA_LENGTH)
    return trimmed
  } catch {
    return undefined
  }
}

/**
 * Analizi HTTP yanıtından bağımsız arka planda başlatır.
 * Kullanıcı sayfa/sekme değiştirse bile iş kesilmez; sonuç veritabanına yazılır.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const comparisonId = params.id
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json({ error: 'Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Bu özelliğe erişim yetkiniz yok.' }, { status: 403 })
  }

  if (!getAnthropicClient()) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY tanımlı değil. Lütfen ortam değişkenlerini kontrol edin.' },
      { status: 500 }
    )
  }

  const priorityCriteria = await readPriorityCriteria(request)

  const { data: comparison, error: comparisonError } = await supabase
    .from('quote_comparisons')
    .select('id, status')
    .eq('id', comparisonId)
    .single()

  if (comparisonError || !comparison) {
    return NextResponse.json({ error: 'Karşılaştırma bulunamadı.' }, { status: 404 })
  }

  const { count: offerCount, error: offersError } = await supabase
    .from('quote_comparison_offers')
    .select('id', { count: 'exact', head: true })
    .eq('comparison_id', comparisonId)

  if (offersError || !offerCount) {
    return NextResponse.json({ error: 'Karşılaştırmaya ait yüklenmiş teklif bulunamadı.' }, { status: 400 })
  }

  if (comparison.status === 'analyzing') {
    return NextResponse.json({ started: true, alreadyRunning: true }, { status: 202 })
  }

  const { error: statusError } = await supabase
    .from('quote_comparisons')
    .update({
      status: 'analyzing',
      error_message: null,
      analysis_progress: 5,
      analysis_step: 'Analiz başlatıldı',
      ...(priorityCriteria !== undefined ? { priority_criteria: priorityCriteria || null } : {}),
    })
    .eq('id', comparisonId)

  if (statusError) {
    return NextResponse.json({ error: 'Analiz başlatılamadı.' }, { status: 500 })
  }

  const jobClient = await createQuoteComparisonJobClient(session.access_token, session.refresh_token)
  waitUntil(runQuoteComparisonAnalysis(jobClient, comparisonId))

  return NextResponse.json({ started: true }, { status: 202 })
}
