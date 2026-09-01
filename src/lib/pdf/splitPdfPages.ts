import 'server-only'

import { PDFDocument } from 'pdf-lib'

/**
 * Kaynak PDF'ten [startIndex, endIndexExclusive) sayfa aralığını yeni bir PDF
 * olarak kopyalar. AI'ya 70-80 kalemli belgeyi tek seferde vermek yerine
 * sayfa sayfa taramak için kullanılır.
 */
export async function copyPdfPageRange(
  source: Buffer,
  startIndex: number,
  endIndexExclusive: number
): Promise<Buffer> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false })
  const dest = await PDFDocument.create()
  const last = Math.min(endIndexExclusive, src.getPageCount())
  const indices: number[] = []
  for (let i = Math.max(0, startIndex); i < last; i++) indices.push(i)
  if (indices.length === 0) {
    throw new Error('PDF sayfa aralığı boş')
  }
  const pages = await dest.copyPages(src, indices)
  for (const page of pages) dest.addPage(page)
  return Buffer.from(await dest.save())
}
