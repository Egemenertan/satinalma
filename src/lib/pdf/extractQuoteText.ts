import 'server-only'

/**
 * PDF'ten düz metin çıkarır. Sadece `raw_text` alanında saklanıp gösterilmek
 * için kullanılan best-effort bir yardımcıdır — AI analiz akışı buna bağımlı
 * değildir (AI, PDF'i doğrudan doküman olarak okuyabildiği için asıl
 * çıkarım işini kendisi yapar). Bu yüzden hata durumunda akışı kesmeden
 * `null` döner.
 */
export async function extractQuoteRawText(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
    try {
      const result = await parser.getText()
      const text = result.text?.trim()
      return text && text.length > 0 ? text : null
    } finally {
      await parser.destroy()
    }
  } catch (error) {
    console.warn('[extractQuoteRawText] PDF metni çıkarılamadı (analiz akışını etkilemez):', error)
    return null
  }
}
