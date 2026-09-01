import 'server-only'

export interface QuotePdfTable {
  page: number
  rows: string[][]
}

export interface QuotePdfContent {
  text: string | null
  pageTexts: string[]
  tables: QuotePdfTable[]
}

function trimCell(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function isMostlyEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => !cell) || cells.join('').length < 2
}

/**
 * PDF'ten düz metin, sayfa metinleri ve çizgili tabloları tek geçişte çıkarır.
 * Tablo tespiti vektör çizgilerine (Excel'den basılmış teklif ızgarası) dayanır;
 * çizgisiz/taranmış belgelerde `tables` boş kalabilir — o durumda `text` yedektir.
 * Hata halinde akışı kesmez.
 */
export async function extractQuoteDocumentContent(pdfBuffer: Buffer): Promise<QuotePdfContent> {
  const empty: QuotePdfContent = { text: null, pageTexts: [], tables: [] }
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
    try {
      const textResult = await parser.getText()
      const pageTexts = (textResult.pages || [])
        .sort((a, b) => a.num - b.num)
        .map((page) => (page.text || '').trim())
      const text = textResult.text?.trim() || pageTexts.filter(Boolean).join('\n\n') || null

      const tables: QuotePdfTable[] = []
      try {
        const tableResult = await parser.getTable()
        for (const page of tableResult.pages || []) {
          for (const table of page.tables || []) {
            const rows = (table || [])
              .map((row) => (row || []).map(trimCell))
              .filter((row) => !isMostlyEmptyRow(row))
            if (rows.length >= 2) {
              tables.push({ page: page.num, rows })
            }
          }
        }
      } catch (error) {
        console.warn('[extractQuoteDocumentContent] Tablo çıkarımı atlandı:', error)
      }

      return { text: text && text.length > 0 ? text : null, pageTexts, tables }
    } finally {
      await parser.destroy()
    }
  } catch (error) {
    console.warn('[extractQuoteDocumentContent] PDF içeriği çıkarılamadı:', error)
    return empty
  }
}

/**
 * PDF'ten düz metin çıkarır. Sadece `raw_text` alanında saklanıp gösterilmek
 * için kullanılan best-effort bir yardımcıdır — AI analiz akışı buna bağımlı
 * değildir. Hata durumunda akışı kesmeden `null` döner.
 */
export async function extractQuoteRawText(pdfBuffer: Buffer): Promise<string | null> {
  const content = await extractQuoteDocumentContent(pdfBuffer)
  return content.text
}

/** Tabloyu AI'ya verilecek TSV benzeri düz metne çevirir. */
export function serializeQuoteTables(tables: QuotePdfTable[]): string {
  if (tables.length === 0) return ''
  return tables
    .map((table, index) => {
      const header = `--- Sayfa ${table.page}, Tablo ${index + 1} (${table.rows.length} satır) ---`
      const body = table.rows.map((row) => row.join('\t')).join('\n')
      return `${header}\n${body}`
    })
    .join('\n\n')
}

/** Metindeki fiyat/miktar içeren satır sayısına bakarak kalem yoğunluğu tahmini. */
export function estimatePricedLineCount(text: string | null | undefined): number {
  if (!text?.trim()) return 0
  return text.split(/\n/).filter((line) => {
    const trimmed = line.trim()
    if (trimmed.length < 6) return false
    return /\d/.test(trimmed) && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(trimmed)
  }).length
}
