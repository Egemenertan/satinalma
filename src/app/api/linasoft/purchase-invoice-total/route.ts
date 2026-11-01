import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LinasoftNotConfiguredError } from '@/lib/linasoft/client'
import { fetchPurchaseInvoiceTotal } from '@/lib/linasoft/purchase-invoices'
import { getLinasoftSiteMapping } from '@/lib/linasoft/site-mapping'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const siteId = request.nextUrl.searchParams.get('siteId')
  if (!siteId) return NextResponse.json({ error: 'siteId gerekli' }, { status: 400 })

  const mapping = getLinasoftSiteMapping(siteId)
  if (!mapping) return NextResponse.json({ status: 'not_configured', reason: 'site_mapping' })

  try {
    const result = await fetchPurchaseInvoiceTotal(mapping)
    return NextResponse.json({ status: 'ok', ...result })
  } catch (error) {
    if (error instanceof LinasoftNotConfiguredError) {
      return NextResponse.json({ status: 'not_configured', reason: error.message })
    }
    console.error('Linasoft alış faturası hatası:', error)
    return NextResponse.json({ status: 'error' }, { status: 502 })
  }
}
