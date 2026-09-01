import 'server-only'

import type Anthropic from '@anthropic-ai/sdk'
import { normalizeCurrencyCode } from '@/lib/quoteComparison/currency'
import { inferPozNo } from '@/lib/quoteComparison/pozNo'
import {
  estimatePricedLineCount,
  serializeQuoteTables,
  type QuotePdfContent,
} from '@/lib/pdf/extractQuoteText'
import { copyPdfPageRange } from '@/lib/pdf/splitPdfPages'
import type { QuoteComparisonExtractedData, QuoteComparisonLineItem } from '@/types/quoteComparison'

const EXTRACT_LINE_ITEMS_TOOL: Anthropic.Tool = {
  name: 'extract_line_items',
  description:
    'Teklif/fiyat tablosundaki HER ürün satırını ayrı bir kalem olarak çıkarır. Özetleme, gruplama veya atlama YASAK; 150+ satır olsa bile hepsini yaz.',
  input_schema: {
    type: 'object',
    properties: {
      line_items: {
        type: 'array',
        description:
          'Bu parçada/sayfada görülen HER fiyatlı ürün satırı. Ara toplam, genel toplam, KDV, iskonto satırlarını EKLEME.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kalemin adı (ürün/malzeme açıklaması, poz numarasını tekrar etme)' },
            poz_no: {
              type: ['string', 'null'],
              description:
                'Poz / Poz No / Pozisyon sütunu (A1, A2, B.1, 01.02). Sıra/S.No/No gibi düz 1,2,3 satır numarasını BURAYA YAZMA. Sütun yoksa ve adın başında A1 gibi bir kod yoksa null.',
            },
            quantity: { type: ['string', 'null'], description: 'Miktar (sayı veya "100 adet" gibi)' },
            unit: { type: ['string', 'null'], description: 'Birim (adet, kg, m, kutu vb.)' },
            model: { type: ['string', 'null'], description: 'Model/kod/SKU varsa' },
            unit_price: {
              type: ['number', 'null'],
              description:
                'Birim fiyat. SADECE belgede ayrı bir birim fiyat sütunu/değeri varsa doldur; yoksa null. total_price / miktar ile üretme.',
            },
            total_price: {
              type: ['number', 'null'],
              description:
                'Satırın toplam tutarı. Belgede tek fiyat sütunu varsa o değeri buraya yaz. Sayıları 1250.50 gibi noktalı ondalık olarak ver (Türkçe 1.250,50 → 1250.5).',
            },
            currency: {
              type: ['string', 'null'],
              description: 'Bu satırın para birimi (TRY/USD/EUR/GBP). Net değilse null.',
            },
          },
          required: ['name'],
        },
      },
      is_complete: {
        type: 'boolean',
        description:
          'Bu kaynakta (parça/sayfa/devam isteği) başka ürün satırı kalmadıysa true. Hâlâ çıkarılmamış satır varsa false.',
      },
    },
    required: ['line_items', 'is_complete'],
  },
}

const TABLE_CHUNK_ROWS = 40
const TEXT_CHUNK_CHARS = 8000
const MAX_CONTINUATION_ROUNDS = 10
const MAX_PAGE_CHUNKS = 24
const PAGE_EXTRACT_CONCURRENCY = 2
const TABLE_EXTRACT_CONCURRENCY = 1
const COMPLETENESS_RATIO = 0.92
const EXTRACT_MAX_TOKENS = 16000
const AI_RETRY_ATTEMPTS = 3

const SUMMARY_ROW_RE =
  /^(genel\s*)?(ara\s*)?toplam$|grand\s*total|^kdv(\s*%?\s*\d+)?$|^kdv\s*(dahil|hariç|tutarı|toplamı)$|^iskonto$|^indirim$|^yuvarlama$|^net\s*toplam$|^brüt\s*toplam$|^brut\s*toplam$/i

interface ExtractLineItemsResult {
  line_items: QuoteComparisonLineItem[]
  is_complete?: boolean
}

function getToolInput<T>(message: Anthropic.Message, toolName: string): T {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName
  )
  if (!block) {
    throw new Error(`AI yanıtında beklenen "${toolName}" tool çağrısı bulunamadı`)
  }
  return block.input as T
}

function itemDedupeKey(item: QuoteComparisonLineItem): string {
  const name = item.name.trim().toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '')
  const qty = (item.quantity || '').trim().toLocaleLowerCase('tr-TR')
  const poz = (item.poz_no || '').trim().toLocaleLowerCase('tr-TR')
  return `${poz}|${name}|${qty}|${item.unit_price ?? ''}|${item.total_price ?? ''}`
}

export function isSummaryLineItemName(name: string): boolean {
  return SUMMARY_ROW_RE.test(name.trim())
}

export function normalizeExtractedLineItems(value: unknown): QuoteComparisonLineItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw): QuoteComparisonLineItem | null => {
      const item = raw as Partial<QuoteComparisonLineItem> | null
      const name = item?.name ? String(item.name).trim() : ''
      if (!name || isSummaryLineItemName(name)) return null
      const rawPoz =
        (item as { poz_no?: string | null } | null)?.poz_no != null
          ? String((item as { poz_no?: string | null }).poz_no).trim()
          : ''
      return {
        name,
        poz_no: inferPozNo(rawPoz || null, name),
        quantity: item?.quantity != null && String(item.quantity).trim() ? String(item.quantity).trim() : null,
        unit: item?.unit != null && String(item.unit).trim() ? String(item.unit).trim() : null,
        model: item?.model != null && String(item.model).trim() ? String(item.model).trim() : null,
        unit_price: typeof item?.unit_price === 'number' && Number.isFinite(item.unit_price) ? item.unit_price : null,
        total_price: typeof item?.total_price === 'number' && Number.isFinite(item.total_price) ? item.total_price : null,
        currency: normalizeCurrencyCode((item as { currency?: string | null } | null)?.currency),
      }
    })
    .filter((item): item is QuoteComparisonLineItem => item !== null)
}

export function dedupeLineItems(items: QuoteComparisonLineItem[]): QuoteComparisonLineItem[] {
  const seen = new Set<string>()
  const result: QuoteComparisonLineItem[] = []
  for (const item of items) {
    const key = itemDedupeKey(item)
    if (!key.startsWith('|') && seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

export function mergeLineItemLists(
  ...lists: (QuoteComparisonLineItem[] | null | undefined)[]
): QuoteComparisonLineItem[] {
  return dedupeLineItems(lists.flatMap((list) => list || []))
}

export function sumLineItemTotalsIfSingleCurrency(
  items: QuoteComparisonLineItem[],
  fallbackCurrency: string | null
): number | null {
  let sum = 0
  let sawAny = false
  let commonCurrency: string | null = null
  for (const item of items) {
    if (item.total_price == null) continue
    const currency = normalizeCurrencyCode(item.currency) || fallbackCurrency
    if (commonCurrency == null) commonCurrency = currency
    else if (currency != null && currency !== commonCurrency) return null
    sum += item.total_price
    sawAny = true
  }
  return sawAny ? sum : null
}

export function lineItemsLookIncomplete(
  items: QuoteComparisonLineItem[],
  grandTotal: number | null,
  currency: string | null,
  hints?: { pageCount?: number | null; pricedLineHint?: number; tableRowCount?: number }
): boolean {
  if (grandTotal != null) {
    const sum = sumLineItemTotalsIfSingleCurrency(items, currency)
    if (sum != null && sum < grandTotal * COMPLETENESS_RATIO) return true
  }

  const tableRows = hints?.tableRowCount ?? 0
  if (tableRows >= 8 && items.length < Math.floor(tableRows * 0.6)) return true

  const pricedHint = hints?.pricedLineHint ?? 0
  if (pricedHint >= 25 && items.length < Math.min(pricedHint * 0.45, pricedHint - 8)) return true

  const pages = hints?.pageCount ?? 0
  if (pages >= 3 && items.length > 0 && items.length < pages * 4) return true

  return false
}

function countTableDataRows(tables: QuotePdfContent['tables']): number {
  return tables.reduce((sum, table) => sum + Math.max(0, table.rows.length - 1), 0)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function chunkText(text: string, size: number, overlap = 400): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= size) return [trimmed]
  const chunks: string[] = []
  let start = 0
  while (start < trimmed.length) {
    const end = Math.min(trimmed.length, start + size)
    chunks.push(trimmed.slice(start, end))
    if (end >= trimmed.length) break
    start = Math.max(0, end - overlap)
  }
  return chunks
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function isRetryableAiError(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : 0
  const msg = error instanceof Error ? error.message : String(error)
  return (
    status === 429 ||
    status === 529 ||
    status === 503 ||
    /rate.?limit|overloaded|timeout|temporar|529|too many requests/i.test(msg)
  )
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= AI_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRetryableAiError(error) || attempt === AI_RETRY_ATTEMPTS) throw error
      const waitMs = 1500 * attempt * attempt
      console.warn(`[${label}] ${attempt}. deneme başarısız, ${waitMs}ms sonra tekrar:`, error)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
  throw lastError
}

async function callExtractLineItems(
  anthropic: Anthropic,
  model: string,
  content: Anthropic.MessageParam['content'],
  maxTokens = EXTRACT_MAX_TOKENS
): Promise<QuoteComparisonLineItem[]> {
  return withRetry(async () => {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      tools: [EXTRACT_LINE_ITEMS_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_LINE_ITEMS_TOOL.name },
      messages: [{ role: 'user', content }],
    })
    const message = await stream.finalMessage()
    const raw = getToolInput<ExtractLineItemsResult>(message, EXTRACT_LINE_ITEMS_TOOL.name)
    return normalizeExtractedLineItems(raw.line_items)
  }, 'extract_line_items')
}

const PRICE_COLUMN_RULES =
  "FİYAT SÜTUNU: Tabloda hem birim fiyat hem toplam varsa ikisini de al. Sadece tek fiyat sütunu varsa onu total_price'a yaz, unit_price null kalsın. Çarpma/bölme ile eksik sütun üretme. Ara toplam / genel toplam / KDV / iskonto satırlarını listeye EKLEME. POZ: Tabloda Poz / Poz No / Pozisyon sütunu varsa (A1, A2, 01.02 gibi) her satırın poz_no alanına yaz. Sıra No / S.No sütunundaki düz 1,2,3 değerlerini poz sanma."

async function extractFromTableChunks(
  anthropic: Anthropic,
  model: string,
  tables: QuotePdfContent['tables']
): Promise<QuoteComparisonLineItem[]> {
  const serialized = serializeQuoteTables(tables)
  if (!serialized) return []

  const tableChunks = tables.flatMap((table) => {
    const [header, ...body] = table.rows
    if (body.length === 0) return []
    return chunkArray(body, TABLE_CHUNK_ROWS).map((chunk, index, all) =>
      serializeQuoteTables([
        {
          page: table.page,
          rows: header ? [header, ...chunk] : chunk,
        },
      ]) + (all.length > 1 ? `\n(Bu tablo parçası ${index + 1}/${all.length})` : '')
    )
  })

  const parts = await mapPool(tableChunks, TABLE_EXTRACT_CONCURRENCY, async (chunk, index) => {
    try {
      return await callExtractLineItems(anthropic, model, [
        {
          type: 'text',
          text: `Aşağıda bir tedarikçi teklif PDF'inden çıkarılmış fiyat tablosu parçası var (${index + 1}/${tableChunks.length}). extract_line_items tool'u ile HER ürün satırını ayrı kalem olarak çıkar. Satır atlama, gruplama, "çeşitli malzemeler" diye özetleme. ${PRICE_COLUMN_RULES}\n\n${chunk}`,
        },
      ])
    } catch (error) {
      console.warn(`[extractFromTableChunks] parça ${index + 1} başarısız:`, error)
      return []
    }
  })

  return mergeLineItemLists(...parts)
}

async function extractFromTextChunks(
  anthropic: Anthropic,
  model: string,
  text: string
): Promise<QuoteComparisonLineItem[]> {
  const chunks = chunkText(text, TEXT_CHUNK_CHARS)
  const parts = await mapPool(chunks, TABLE_EXTRACT_CONCURRENCY, async (chunk, index) => {
    try {
      return await callExtractLineItems(anthropic, model, [
        {
          type: 'text',
          text: `Aşağıda bir tedarikçi teklif PDF'inin düz metni var (parça ${index + 1}/${chunks.length}). extract_line_items ile fiyat tablosundaki HER ürün satırını çıkar. Bu parçada ürün yoksa boş dizi döndür. ${PRICE_COLUMN_RULES}\n\n${chunk}`,
        },
      ])
    } catch (error) {
      console.warn(`[extractFromTextChunks] parça ${index + 1} başarısız:`, error)
      return []
    }
  })
  return mergeLineItemLists(...parts)
}

async function extractFromPdfPageChunks(
  anthropic: Anthropic,
  model: string,
  pdfBuffer: Buffer,
  pageCount: number
): Promise<QuoteComparisonLineItem[]> {
  const chunkSize = pageCount > 8 ? 2 : 1
  const ranges: Array<{ start: number; end: number }> = []
  for (let start = 0; start < Math.min(pageCount, MAX_PAGE_CHUNKS * chunkSize); start += chunkSize) {
    ranges.push({ start, end: Math.min(pageCount, start + chunkSize) })
  }

  const parts = await mapPool(ranges, PAGE_EXTRACT_CONCURRENCY, async (range) => {
    try {
      const slice = await copyPdfPageRange(pdfBuffer, range.start, range.end)
      const pageLabel =
        range.end - range.start === 1
          ? `${range.start + 1}. sayfa`
          : `${range.start + 1}-${range.end}. sayfalar`
      return await callExtractLineItems(anthropic, model, [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: slice.toString('base64') },
        },
        {
          type: 'text',
          text: `Bu PDF dilimi teklifin ${pageLabel} kısmıdır (toplam ${pageCount} sayfa). extract_line_items ile bu sayfalardaki HER fiyatlı ürün satırını çıkar. Diğer sayfalardaki kalemleri uydurma. ${PRICE_COLUMN_RULES}`,
        },
      ])
    } catch (error) {
      console.warn(`[extractFromPdfPageChunks] sayfa ${range.start + 1}-${range.end} başarısız:`, error)
      return []
    }
  })

  return mergeLineItemLists(...parts)
}

function formatKnownItems(items: QuoteComparisonLineItem[], limit = 12): string {
  if (items.length === 0) return '(henüz kalem yok)'
  const tail = items.slice(-limit)
  const head = items.length > limit ? `… ve önceki ${items.length - limit} kalem\n` : ''
  return (
    head +
    tail
      .map((item, i) => {
        const n = items.length - tail.length + i + 1
        const price = item.total_price ?? item.unit_price
        return `${n}. ${item.name}${price != null ? ` — ${price}` : ''}`
      })
      .join('\n')
  )
}

async function continueUntilComplete(
  anthropic: Anthropic,
  model: string,
  pdfBase64: string,
  current: QuoteComparisonLineItem[],
  grandTotal: number | null,
  currency: string | null,
  hints: { pageCount?: number | null; pricedLineHint?: number; tableRowCount?: number }
): Promise<QuoteComparisonLineItem[]> {
  let items = current
  for (let round = 0; round < MAX_CONTINUATION_ROUNDS; round++) {
    if (!lineItemsLookIncomplete(items, grandTotal, currency, hints)) break

    const sum = sumLineItemTotalsIfSingleCurrency(items, currency)
    const totalHint =
      grandTotal != null
        ? `PDF genel toplamı ${grandTotal.toLocaleString('tr-TR')}${currency ? ` ${currency}` : ''}. Şu ana kadar ${items.length} kalemin toplamı ${sum != null ? sum.toLocaleString('tr-TR') : '?'}. Fark, atlanan satırlar olduğunu gösteriyor.`
        : `Şu ana kadar ${items.length} kalem çıkarıldı; belgede daha fazla satır olabilir.`

    try {
      const next = await callExtractLineItems(
        anthropic,
        model,
        [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `DEVAM ÇIKARIMI — henüz listelenmemiş kalemleri çıkar.\n${totalHint}\nZaten çıkarılmış kalemleri TEKRAR YAZMA. Sadece listedeki son kalemlerden SONRA gelen ürün satırlarını döndür. Belgede başka ürün satırı yoksa boş dizi ve is_complete=true ver.\n\nZaten çıkan kalemlerin sonu:\n${formatKnownItems(items)}\n\n${PRICE_COLUMN_RULES}`,
          },
        ],
        32000
      )
      const before = items.length
      items = mergeLineItemLists(items, next)
      console.warn(
        `[continueUntilComplete] tur ${round + 1}: +${items.length - before} kalem (toplam ${items.length})`
      )
      if (items.length === before) break
    } catch (error) {
      console.warn(`[continueUntilComplete] tur ${round + 1} başarısız:`, error)
      break
    }
  }
  return items
}

function documentLooksLikeMultiItemQuote(
  seedItems: QuoteComparisonLineItem[],
  content: QuotePdfContent
): boolean {
  if (seedItems.length >= 2) return true
  if (countTableDataRows(content.tables) >= 5) return true
  if (estimatePricedLineCount(content.text) >= 18) return true
  return false
}

export interface CompleteLineItemsInput {
  anthropic: Anthropic
  extractionModel: string
  strongModel: string
  pdfBase64: string
  pdfBuffer: Buffer
  pageCount: number | null
  content: QuotePdfContent
  seedItems: QuoteComparisonLineItem[]
  grandTotal: number | null
  currency: string | null
}

/**
 * İlk AI geçişinde (özet/metadata) kaçırılan kalemleri tablo metni, sayfa dilimleri
 * ve devam çağrılarıyla tamamlar. 80-150 satırlık tekliflerde tek tool çıktısının
 * yarıda kesilmesi bu yüzden oluşuyordu.
 */
export async function completeQuoteLineItems(input: CompleteLineItemsInput): Promise<QuoteComparisonLineItem[]> {
  const { anthropic, extractionModel, strongModel, pdfBase64, pdfBuffer, pageCount, content } = input
  const currency = normalizeCurrencyCode(input.currency)
  const hints = {
    pageCount,
    pricedLineHint: estimatePricedLineCount(content.text),
    tableRowCount: countTableDataRows(content.tables),
  }

  let items = dedupeLineItems(input.seedItems)

  if (!documentLooksLikeMultiItemQuote(items, content) && items.length <= 1) {
    return items
  }

  const needsWork = items.length < 2 || lineItemsLookIncomplete(items, input.grandTotal, currency, hints)
  if (!needsWork) return items

  if (content.tables.length > 0 && hints.tableRowCount >= 5) {
    console.warn(
      `[completeQuoteLineItems] PDF tablosu bulundu (${hints.tableRowCount} satır), kalemler tablodan çıkarılıyor.`
    )
    const fromTables = await extractFromTableChunks(anthropic, extractionModel, content.tables)
    items = mergeLineItemLists(items, fromTables)
  }

  if (
    lineItemsLookIncomplete(items, input.grandTotal, currency, hints) &&
    content.text &&
    content.text.length > 400
  ) {
    console.warn('[completeQuoteLineItems] Kalemler hâlâ eksik, düz metinden çıkarılıyor.')
    const fromText = await extractFromTextChunks(anthropic, extractionModel, content.text)
    items = mergeLineItemLists(items, fromText)
  }

  if (lineItemsLookIncomplete(items, input.grandTotal, currency, hints) && pageCount != null && pageCount > 1) {
    console.warn(`[completeQuoteLineItems] Kalemler hâlâ eksik, ${pageCount} sayfa dilimlenerek taranıyor.`)
    const fromPages = await extractFromPdfPageChunks(anthropic, extractionModel, pdfBuffer, pageCount)
    items = mergeLineItemLists(items, fromPages)
  }

  if (lineItemsLookIncomplete(items, input.grandTotal, currency, hints)) {
    console.warn('[completeQuoteLineItems] Tamlık kontrolü hâlâ düşük, devam çıkarımı çalışıyor.')
    items = await continueUntilComplete(
      anthropic,
      strongModel,
      pdfBase64,
      items,
      input.grandTotal,
      currency,
      hints
    )
  }

  console.warn(`[completeQuoteLineItems] Sonuç: ${items.length} kalem`)
  return items
}

export function extractedDataLooksIncomplete(extracted: QuoteComparisonExtractedData): boolean {
  return lineItemsLookIncomplete(extracted.line_items || [], extracted.total_price, extracted.currency)
}
