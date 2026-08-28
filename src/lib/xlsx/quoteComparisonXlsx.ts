/**
 * AI Teklif Karşılaştırma - Excel (.xlsx) Export
 *
 * Şirketlerde kullanılan klasik "Teklif Değerlendirme Formu" (bkz. referans şablon)
 * ile aynı mantıkta profesyonel bir tablo üretir: tedarikçi başlık bloğu (firma/
 * yetkili/telefon/e-posta), kalem bazlı fiyat matrisi (her satırda en ucuz teklif
 * yeşille vurgulanır), ticari şartlar ve teknik özellik karşılaştırması — hepsi
 * tek bir sayfada.
 *
 * Not: Önerilen (AI) teklifin sütununa kasıtlı olarak özel bir çerçeve/renk
 * uygulanmaz; bu tablo referans şablon gibi tarafsız bir karşılaştırma formudur.
 */
import ExcelJS from 'exceljs'
import { getCurrencySymbol } from '@/components/offers/types'
import { getOfferFileUrl } from '@/components/quoteComparison/OfferHeaderCell'
import { convertAmountViaEurCross, type EurCrossRates } from '@/lib/fx/convertViaEurRates'
import { computeLineItemGrandTotal, getLineItemRowStats } from '@/lib/quoteComparison/lineItems'
import { getOfferVatStatus } from '@/lib/quoteComparison/vat'
import { computeThumbnailSize, extractJpegImagesFromPdf } from '@/lib/pdf/extractPdfImage'
import type {
  QuoteComparisonExtractedData,
  QuoteComparisonLineItemRow,
  QuoteComparisonOffer,
  QuoteComparisonRecommendation,
  QuoteComparisonTableRow,
} from '@/types/quoteComparison'

/**
 * PDF'ten ürün görseli çıkarıp kalem satırlarına yerleştirme özelliği geçici olarak
 * kapatıldı (yanlış/istenmeyen görsellerin - logo, CE damgası vb. - sızma riski hâlâ
 * mevcut). Alt yapı (extractPdfImage.ts, aşağıdaki fetch/yerleştirme kodu) olduğu gibi
 * duruyor; tekrar açmak için bunu `true` yapmak yeterli.
 */
const PRODUCT_IMAGE_EXTRACTION_ENABLED = false

export interface QuoteComparisonXlsxInput {
  title: string
  projectName: string | null
  materialName: string | null
  createdAt: string
  comparisonTable: QuoteComparisonTableRow[] | null
  lineItemComparison: QuoteComparisonLineItemRow[] | null
  recommendation: QuoteComparisonRecommendation | null
  recommendedOfferId: string | null
  offers: QuoteComparisonOffer[]
}

// Dashboard'un tasarım diliyle uyumlu, sade bir renk paleti (bkz. tailwind.config.js
// `primary`/`elegant` renkleri ve src/app/globals.css `--destructive`). Excel export'u
// kasıtlı olarak yalnızca birkaç renk kullanır: nötr gri tonları (yapı/metin),
// marka yeşili (en uygun/önerilen vurgusu) ve yumuşak kırmızı (eksik bilgi uyarısı).
const TEXT_DARK = 'FF0A0A0A' // elegant.black / --foreground
const TEXT_BODY = 'FF404040' // elegant.gray.700
const TEXT_MUTED = 'FF737373' // elegant.gray.500
const TEXT_FAINT = 'FFA3A3A3' // elegant.gray.400

const FILL_TITLE = 'FF0A0A0A' // elegant.black
const FILL_SECTION = 'FF262626' // elegant.gray.800
const FILL_HEADER = 'FFE5E5E5' // elegant.gray.200
const FILL_VENDOR_HEADER = 'FFF5F5F5' // elegant.gray.100
const FILL_ALT_ROW = 'FFFAFAFA' // elegant.gray.50
const BORDER_COLOR = 'FFD4D4D4' // elegant.gray.300

// Marka yeşili (primary) - en uygun fiyat / önerilen teklif vurgusu; ayrıca
// TOPLAM satırı da nihai/ana tutar olduğu için aynı vurgu rengini taşır.
const FILL_BEST = 'FFD1F5E8' // primary-100
const TEXT_BEST = 'FF007944' // primary-800 (primary-100 zemin üzerinde okunaklı)
const FILL_TOTAL_ROW = FILL_BEST
const TEXT_TOTAL_ROW = TEXT_BEST

// Dashboard'da bilgi/ikincil vurgu için kullanılan yumuşak mavi - TOPLAM (GBP)
// satırı, ana tutardan türetilmiş "bilgi amaçlı" bir değer olduğu için bu tonu kullanır.
const FILL_GBP_ROW = 'FFEFF6FF' // blue-50
const TEXT_GBP_ROW = 'FF1D4ED8' // blue-700

// Ağırbaşlı, profesyonel bir lacivert-gri (slate) - firma adı ve kaynak PDF dosya
// adı gibi "kimlik" bilgilerini düz siyah/gri metinden ayırmak için kullanılır.
const TEXT_COMPANY = 'FF1E293B' // slate-800
const TEXT_FILENAME = 'FF64748B' // slate-500
const FILL_COMPANY = 'FFFFF2CC' // eskiden TOPLAM satırında kullanılan pastel sarı - firma adı hücresinin zemini

// Yumuşak kırmızı - ticari şartlarda eksik/boş bilgi uyarısı
const FILL_MISSING = 'FFFEF2F2' // red-50
const BORDER_MISSING_COLOR = 'FFF87171' // red-400
const TEXT_CON = 'FFDC2626' // --destructive

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
}

// Ticari şartlarda bir tedarikçinin hücresi boşsa (örn. ödeme planı, nakliye,
// teslim süresi belirtilmemişse) hafif kırmızı çerçeveyle fark edilir hale getirir.
const MISSING_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_MISSING_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_MISSING_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_MISSING_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_MISSING_COLOR } },
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function offerDisplayName(offer: QuoteComparisonOffer): string {
  return offer.supplier_name?.trim() || offer.extracted_data?.supplier_name?.trim() || offer.file_name
}

const CURRENCY_SYMBOLS: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }

function currencyNumFmt(currency: string | null | undefined): string {
  const code = (currency || 'TRY').toUpperCase()
  const symbol = CURRENCY_SYMBOLS[code] || getCurrencySymbol(code)
  return `"${symbol}"#,##0.00`
}

interface CellStyle {
  font?: Partial<ExcelJS.Font>
  fill?: ExcelJS.Fill
  alignment?: Partial<ExcelJS.Alignment>
  border?: Partial<ExcelJS.Borders>
  numFmt?: string
}

/** Belirtilen aralığı birleştirir, değeri sol üst hücreye yazar, stili (kenarlık/dolgu dahil) aralıktaki TÜM hücrelere uygular. */
function setRange(
  sheet: ExcelJS.Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  value: ExcelJS.CellValue,
  style: CellStyle = {}
): void {
  if (colEnd > colStart) sheet.mergeCells(row, colStart, row, colEnd)
  for (let c = colStart; c <= colEnd; c++) {
    const cell = sheet.getCell(row, c)
    if (c === colStart) cell.value = value
    if (style.font) cell.font = style.font
    if (style.fill) cell.fill = style.fill
    if (style.alignment) cell.alignment = style.alignment
    if (style.border) cell.border = style.border
    if (style.numFmt) cell.numFmt = style.numFmt
  }
}

function sanitizeFileName(name: string): string {
  return (name || 'teklif-karsilastirma').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'teklif-karsilastirma'
}

/** `public/` altındaki bir logoyu data URL'e çevirir; bulunamazsa (offline vb.) export'u bozmadan null döner. */
async function loadLogoAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path)
    if (!response.ok) return null
    const blob = await response.blob()
    return await bytesToDataUrl(blob)
  } catch {
    return null
  }
}

function bytesToDataUrl(source: Uint8Array | Blob, mimeType?: string): Promise<string> {
  // `Uint8Array`'in `buffer` tipi TS'te `ArrayBufferLike` (SharedArrayBuffer'ı da kapsar) olduğu
  // için `BlobPart` ile doğrudan uyuşmuyor; burada her zaman düz bir `ArrayBuffer`'dan
  // (pdf-lib/fetch çıktısı) geldiğinden emin olduğumuz için güvenle cast ediyoruz.
  const blob = source instanceof Blob ? source : new Blob([source as BlobPart], { type: mimeType })
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

interface OfferProductImage {
  dataUrl: string
  width: number
  height: number
}

/**
 * Bir teklifin kaynak PDF'ini indirir ve içine gömülü ürün fotoğraflarını (JPEG)
 * belge sırasıyla çıkarır. Bu sıra, kalem/fiyat matrisindeki satır sırasıyla
 * eşleştirilerek her görsel kendi ürününün hizasına yerleştirilir (bkz.
 * exportQuoteComparisonXlsx). PDF'te uygun görsel yoksa, indirme başarısız olursa ya
 * da görseller desteklenmeyen bir biçimdeyse (JPEG dışı) export'u bozmadan sessizce
 * boş dizi döner — logo yüklemede olduğu gibi bu özellik "best effort"tur.
 */
async function fetchOfferProductImages(offer: QuoteComparisonOffer): Promise<OfferProductImage[]> {
  try {
    const url = getOfferFileUrl(offer.file_path)
    const response = await fetch(url)
    if (!response.ok) return []
    const buffer = await response.arrayBuffer()
    const images = await extractJpegImagesFromPdf(buffer)
    return await Promise.all(
      images.map(async (image) => ({
        dataUrl: await bytesToDataUrl(image.bytes, 'image/jpeg'),
        width: image.width,
        height: image.height,
      }))
    )
  } catch {
    return []
  }
}

/** Bir listeden en büyük (piksel alanı) `maxCount` görseli seçer, belgedeki orijinal sırayı korur. */
function selectLargestImagesInOriginalOrder(images: OfferProductImage[], maxCount: number): OfferProductImage[] {
  if (images.length <= maxCount) return images
  return images
    .map((image, index) => ({ image, index }))
    .sort((a, b) => b.image.width * b.image.height - a.image.width * a.image.height)
    .slice(0, maxCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.image)
}

function sumColumnWidths(sheet: ExcelJS.Worksheet, colStart: number, colEnd: number): number {
  let total = 0
  for (let c = colStart; c <= colEnd; c++) {
    total += sheet.getColumn(c).width || 10
  }
  return total
}

/** Sarmalanan (wrapText) bir hücre için, metin uzunluğuna ve sütun genişliğine göre kaba bir satır yüksekliği tahmini yapar. */
function estimateWrappedRowHeight(text: string, approxCharsPerLine: number, minLines = 1): number {
  const charsPerLine = Math.max(20, approxCharsPerLine)
  const paragraphs = (text || '').split('\n').filter(Boolean)
  const lineCount = paragraphs.reduce((sum, p) => sum + Math.max(1, Math.ceil(p.length / charsPerLine)), 0)
  const lines = Math.max(minLines, lineCount)
  return Math.min(400, 18 + (lines - 1) * 14)
}

async function fetchEurCrossRates(): Promise<{ rates: EurCrossRates; date: string | null } | null> {
  try {
    const response = await fetch('/api/fx/latest')
    if (!response.ok) return null
    const data = (await response.json()) as { date?: string; rates?: EurCrossRates }
    if (!data.rates) return null
    return { rates: data.rates, date: typeof data.date === 'string' ? data.date : null }
  } catch {
    return null
  }
}

function offerCurrency(offer: QuoteComparisonOffer): string {
  return (offer.currency || offer.extracted_data?.currency || 'TRY').toUpperCase()
}

function toGbp(amount: number | null, currency: string, rates: EurCrossRates | null): number | null {
  if (amount == null || !rates) return null
  return convertAmountViaEurCross(amount, currency, 'GBP', rates)
}

function formatFxDate(isoDate: string | null): string | null {
  if (!isoDate) return null
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('tr-TR')
}

function termRowsFor(extracted: QuoteComparisonExtractedData | null | undefined) {
  return [
    { label: 'Teklif Tarihi', value: extracted?.quote_date || null },
    { label: 'Ödeme Planı', value: extracted?.payment_terms || null },
    { label: 'Nakliye', value: extracted?.shipping_responsibility || null },
    { label: 'Montaj', value: extracted?.installation_responsibility || null },
    { label: 'Teslim Süresi', value: extracted?.delivery_time || null },
    { label: 'Garanti', value: extracted?.warranty || null },
  ]
}

/**
 * "Teklif Değerlendirme Formu" düzenine sadık, tek sayfalık profesyonel bir
 * .xlsx dosyası üretip tarayıcıda indirir.
 */
export async function exportQuoteComparisonXlsx(input: QuoteComparisonXlsxInput): Promise<void> {
  const offers = input.offers || []
  const n = offers.length
  if (n === 0) throw new Error('Karşılaştırmada teklif bulunamadı')

  const [dovecLogo, dlxLogo, fx, offerImagesList] = await Promise.all([
    loadLogoAsDataUrl('/d-black.png'),
    loadLogoAsDataUrl('/DLX.png'),
    fetchEurCrossRates(),
    PRODUCT_IMAGE_EXTRACTION_ENABLED ? Promise.all(offers.map(fetchOfferProductImages)) : Promise.resolve(offers.map(() => [])),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DLX AI'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Teklif Değerlendirme', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  // ---- Sütun düzeni -------------------------------------------------------
  const FIRST_COL = 2 // B
  const ITEM_START = 3 // C
  const ITEM_END = 4 // D (C:D birleşik "Kalem" alanı)
  const QTY_COL = 5 // E
  const UNIT_COL = 6 // F
  const LABEL_END = UNIT_COL
  const SPACER_COL = 7 // G
  const VENDOR_START = 8 // H
  const BLOCK_W = 4 // Model, Birim Fiyat, Toplam Tutar, boşluk
  const vendorStart = (i: number) => VENDOR_START + i * BLOCK_W
  const lastCol = vendorStart(n - 1) + 2

  sheet.getColumn(1).width = 2
  sheet.getColumn(FIRST_COL).width = 6
  sheet.getColumn(ITEM_START).width = 15
  sheet.getColumn(ITEM_END).width = 15
  sheet.getColumn(QTY_COL).width = 9
  sheet.getColumn(UNIT_COL).width = 8
  sheet.getColumn(SPACER_COL).width = 2
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    sheet.getColumn(s).width = 20
    sheet.getColumn(s + 1).width = 14
    sheet.getColumn(s + 2).width = 15
    if (i < n - 1) sheet.getColumn(s + 3).width = 2
  }

  let r = 2

  // ---- Başlık ---------------------------------------------------------
  setRange(sheet, r, FIRST_COL, lastCol, 'TEKLİF DEĞERLENDİRME FORMU', {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: solidFill(FILL_TITLE),
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  sheet.getRow(r).height = 30
  r += 1

  setRange(sheet, r, FIRST_COL, lastCol, `Oluşturulma: ${new Date(input.createdAt).toLocaleDateString('tr-TR')}`, {
    font: { italic: true, size: 9, color: { argb: TEXT_MUTED } },
    alignment: { horizontal: 'center' },
  })
  r += 1

  // ---- Sol üst logo alanı (Dovec × DLX) - başlık şeridinin altında, sola dayalı, birbirine yakın ----
  // Not: ExcelJS'in resim çapasında tam sayı sütun index'i sütunun SOL kenarına
  // karşılık gelir; ondalık kısım ise kütüphanenin iç hesaplaması nedeniyle o
  // sütunun görsel genişliğinin çok altında (yalnızca birkaç piksellik) bir ince
  // ayar sağlar — bu yüzden isabetli/öngörülebilir bir yakınlık için DLX logosu
  // bir SONRAKİ sütunun sol kenarına sabitlenir; aradaki dar boşluğa "×" konur.
  const logoRow = r
  sheet.getRow(logoRow).height = 30
  const logoAnchorCol = FIRST_COL - 1 // ExcelJS resim çapası 0-tabanlı; FIRST_COL ile aynı sol kenara hizalar
  if (dovecLogo) {
    const dovecImageId = workbook.addImage({ base64: dovecLogo, extension: 'png' })
    sheet.addImage(dovecImageId, { tl: { col: logoAnchorCol, row: logoRow - 1 + 0.1 }, ext: { width: 88, height: 27 } })
  }
  // Logolar arasındaki "×" işareti (ortak marka/işbirliği gösterimi)
  setRange(sheet, logoRow, ITEM_START, ITEM_START, '×', {
    font: { bold: true, size: 13, color: { argb: TEXT_FAINT } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  if (dlxLogo) {
    const dlxImageId = workbook.addImage({ base64: dlxLogo, extension: 'png' })
    sheet.addImage(dlxImageId, { tl: { col: ITEM_END - 1, row: logoRow - 1 + 0.1 }, ext: { width: 74, height: 27 } })
  }
  r += 2

  // ---- Proje / İş bilgisi ------------------------------------------------
  // Etiket dar bir alanda (B:C), değer hemen yanında (D'den itibaren) başlar.
  const projectLabel = input.projectName?.trim() || input.title
  setRange(sheet, r, FIRST_COL, ITEM_START, 'PROJE:', { font: { bold: true } })
  setRange(sheet, r, ITEM_END, lastCol, projectLabel, { font: { bold: true, size: 12 } })
  r += 1
  if (input.projectName?.trim()) {
    setRange(sheet, r, FIRST_COL, ITEM_START, 'TEKLİF:', { font: { bold: true } })
    setRange(sheet, r, ITEM_END, lastCol, input.title, {})
    r += 1
  }
  if (input.materialName?.trim()) {
    setRange(sheet, r, FIRST_COL, ITEM_START, 'İŞ:', { font: { bold: true } })
    setRange(sheet, r, ITEM_END, lastCol, input.materialName.trim(), {})
    r += 1
  }
  r += 1

  // ---- Tedarikçi başlık bloğu (firma / yetkili / telefon / e-posta) ------
  const vendorHeaderFont = { bold: true, size: 12, color: { argb: TEXT_COMPANY } }
  setRange(sheet, r, FIRST_COL, LABEL_END, '', { fill: solidFill(FILL_COMPANY) })
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    setRange(sheet, r, s, s + 2, offerDisplayName(offers[i]), {
      font: vendorHeaderFont,
      fill: solidFill(FILL_COMPANY),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: THIN_BORDER,
    })
  }
  sheet.getRow(r).height = 30
  r += 1

  const contactRows: { get: (o: QuoteComparisonOffer) => string | null }[] = [
    { get: (o) => o.extracted_data?.supplier_contact_person || null },
    { get: (o) => o.extracted_data?.supplier_phone || null },
    { get: (o) => o.extracted_data?.supplier_email || null },
  ]
  for (const contactRow of contactRows) {
    const anyValue = offers.some((o) => contactRow.get(o)?.trim())
    if (!anyValue) continue
    for (let i = 0; i < n; i++) {
      const s = vendorStart(i)
      setRange(sheet, r, s, s + 2, contactRow.get(offers[i]) || '', {
        font: { size: 9, color: { argb: 'FF525252' } }, // elegant.gray.600
        alignment: { horizontal: 'center' },
      })
    }
    r += 1
  }

  // Kaynak dosya adı (izlenebilirlik için)
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    setRange(sheet, r, s, s + 2, offers[i].file_name, {
      font: { size: 8, italic: true, color: { argb: TEXT_FILENAME } },
      alignment: { horizontal: 'center' },
    })
  }
  r += 2

  // ---- Genel toplam satırı ------------------------------------------------
  const lineItemRows = input.lineItemComparison || []
  const hasLineItems = lineItemRows.length > 0
  const grandTotals = offers.map((offer) =>
    hasLineItems ? computeLineItemGrandTotal(lineItemRows, offer.id) : offer.total_price ?? null
  )

  // PDF'ten çıkarılan görsel sayısı kalem sayısını aşarsa (ör. gözden kaçan bir damga/
  // logo filtreyi atlattıysa), en büyük N görseli tutup belge sırasını koruyarak
  // fazlalıkları eleriz — böylece kalemlerle 1:1 eşleşme her zaman korunur.
  const targetImageCountPerOffer = hasLineItems ? lineItemRows.length : 1
  const cappedOfferImagesList = offerImagesList.map((images) =>
    selectLargestImagesInOriginalOrder(images, targetImageCountPerOffer)
  )

  setRange(sheet, r, FIRST_COL, LABEL_END, 'TOPLAM', {
    font: { bold: true, size: 12, color: { argb: TEXT_TOTAL_ROW } },
    fill: solidFill(FILL_TOTAL_ROW),
    border: THIN_BORDER,
  })
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    setRange(sheet, r, s, s + 2, grandTotals[i] ?? '', {
      font: { bold: true, size: 13, color: { argb: TEXT_TOTAL_ROW } },
      fill: solidFill(FILL_TOTAL_ROW),
      alignment: { horizontal: 'center' },
      border: THIN_BORDER,
      numFmt: currencyNumFmt(offerCurrency(offers[i])),
    })
  }
  sheet.getRow(r).height = 22
  r += 1

  // ---- KDV (fiyatın hemen altında; ticari şartlar / notlardan taşındı) ----
  let vatLineCount = 1
  setRange(sheet, r, FIRST_COL, LABEL_END, 'KDV', {
    font: { bold: true, size: 10 },
    fill: solidFill(FILL_HEADER),
    border: THIN_BORDER,
    alignment: { vertical: 'middle', wrapText: true },
  })
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    const vat = getOfferVatStatus(offers[i]) || ''
    if (vat) vatLineCount = Math.max(vatLineCount, vat.split('\n').length)
    setRange(sheet, r, s, s + 2, vat || '—', {
      font: { bold: true, size: 10 },
      fill: solidFill(FILL_HEADER),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: THIN_BORDER,
    })
  }
  sheet.getRow(r).height = Math.max(22, vatLineCount * 16 + 8)
  r += 1

  // ---- GBP karşılığı (ECB / Frankfurter çapraz kur) ------------------------
  const gbpLabelDate = formatFxDate(fx?.date ?? null)
  setRange(
    sheet,
    r,
    FIRST_COL,
    LABEL_END,
    gbpLabelDate ? `TOPLAM (GBP)\nKur: ${gbpLabelDate}` : 'TOPLAM (GBP)',
    {
      font: { bold: true, size: 10, color: { argb: TEXT_GBP_ROW } },
      fill: solidFill(FILL_GBP_ROW),
      border: THIN_BORDER,
      alignment: { vertical: 'middle', wrapText: true },
    }
  )
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    const gbpTotal = toGbp(grandTotals[i], offerCurrency(offers[i]), fx?.rates ?? null)
    setRange(sheet, r, s, s + 2, gbpTotal ?? (fx?.rates ? '—' : 'Kur alınamadı'), {
      font: { bold: true, size: 11, color: { argb: TEXT_GBP_ROW } },
      fill: solidFill(FILL_GBP_ROW),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: THIN_BORDER,
      numFmt: currencyNumFmt('GBP'),
    })
  }
  sheet.getRow(r).height = gbpLabelDate ? 28 : 22
  r += 2

  // ---- Kolon başlıkları ----------------------------------------------------
  const headerRowNumber = r
  const headerStyle: CellStyle = {
    font: { bold: true, size: 10 },
    fill: solidFill(FILL_HEADER),
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: THIN_BORDER,
  }
  setRange(sheet, r, FIRST_COL, FIRST_COL, 'S.NO', headerStyle)
  setRange(sheet, r, ITEM_START, ITEM_END, 'KALEM', headerStyle)
  setRange(sheet, r, QTY_COL, QTY_COL, 'MİKTAR', headerStyle)
  setRange(sheet, r, UNIT_COL, UNIT_COL, 'BİRİM', headerStyle)
  for (let i = 0; i < n; i++) {
    const s = vendorStart(i)
    setRange(sheet, r, s, s, 'MODEL', { ...headerStyle, fill: solidFill(FILL_VENDOR_HEADER) })
    setRange(sheet, r, s + 1, s + 1, 'BİRİM FİYAT', { ...headerStyle, fill: solidFill(FILL_VENDOR_HEADER) })
    setRange(sheet, r, s + 2, s + 2, 'TOPLAM TUTAR', { ...headerStyle, fill: solidFill(FILL_VENDOR_HEADER) })
  }
  sheet.getRow(r).height = 26
  r += 1

  // ---- Kalem satırları (kalem bazlı fiyat matrisi ya da tek özet satır) ----
  // Her tedarikçinin PDF'inden çıkarılan ürün görselleri, belge sırasına göre aynı
  // sıradaki kaleme eşlenir (i. görsel -> i. kalem satırı) ve ilgili kalemin MODEL
  // hücresinin üstüne, o kalemin tam hizasına yerleştirilir.
  const ITEM_THUMB_MAX_W = 60
  const ITEM_THUMB_MAX_H = 42
  const ITEM_ROW_HEIGHT_WITH_IMAGE = ITEM_THUMB_MAX_H + 28

  if (hasLineItems) {
    lineItemRows.forEach((row, idx) => {
      const odd = idx % 2 === 0
      const rowFill = odd ? undefined : solidFill(FILL_ALT_ROW)
      const { bestOfferId, bestUnitPrice } = getLineItemRowStats(row)
      const rowImages = cappedOfferImagesList.map((imgs) => imgs[idx] || null)
      const rowHasImage = rowImages.some(Boolean)

      setRange(sheet, r, FIRST_COL, FIRST_COL, idx + 1, { border: THIN_BORDER, fill: rowFill, alignment: { horizontal: 'center' } })
      setRange(sheet, r, ITEM_START, ITEM_END, row.itemLabel, { border: THIN_BORDER, fill: rowFill, font: { bold: true } })
      setRange(sheet, r, QTY_COL, QTY_COL, row.quantity || '', { border: THIN_BORDER, fill: rowFill, alignment: { horizontal: 'center' } })
      setRange(sheet, r, UNIT_COL, UNIT_COL, row.unit || '', { border: THIN_BORDER, fill: rowFill, alignment: { horizontal: 'center' } })

      for (let i = 0; i < n; i++) {
        const s = vendorStart(i)
        const offer = offers[i]
        const cell = (row.values || []).find((v) => v.offerId === offer.id)
        const isBest = bestOfferId != null && cell?.offerId === bestOfferId && cell?.unitPrice === bestUnitPrice
        const cellFill = isBest ? solidFill(FILL_BEST) : rowFill
        setRange(sheet, r, s, s, cell?.model || '', {
          border: THIN_BORDER,
          fill: cellFill,
          font: { size: 9, color: { argb: 'FF525252' } },
          alignment: rowImages[i] ? { vertical: 'bottom', horizontal: 'center', wrapText: true } : undefined,
        })
        setRange(sheet, r, s + 1, s + 1, cell?.unitPrice ?? '', {
          border: THIN_BORDER,
          fill: cellFill,
          numFmt: currencyNumFmt(offer.currency),
          font: isBest ? { bold: true, color: { argb: TEXT_BEST } } : undefined,
        })
        setRange(sheet, r, s + 2, s + 2, cell?.totalPrice ?? '', {
          border: THIN_BORDER,
          fill: cellFill,
          numFmt: currencyNumFmt(offer.currency),
        })
      }

      if (rowHasImage) {
        sheet.getRow(r).height = ITEM_ROW_HEIGHT_WITH_IMAGE
        for (let i = 0; i < n; i++) {
          const image = rowImages[i]
          if (!image) continue
          const s = vendorStart(i)
          const { width, height } = computeThumbnailSize(image.width, image.height, ITEM_THUMB_MAX_W, ITEM_THUMB_MAX_H)
          const imageId = workbook.addImage({ base64: image.dataUrl, extension: 'jpeg' })
          sheet.addImage(imageId, { tl: { col: s - 1 + 0.25, row: r - 1 + 0.08 }, ext: { width, height } })
        }
      }
      r += 1
    })
  } else {
    const rowImages = cappedOfferImagesList.map((imgs) => imgs[0] || null)
    const rowHasImage = rowImages.some(Boolean)

    setRange(sheet, r, FIRST_COL, FIRST_COL, 1, { border: THIN_BORDER, alignment: { horizontal: 'center' } })
    setRange(sheet, r, ITEM_START, ITEM_END, input.materialName || input.title, { border: THIN_BORDER, font: { bold: true } })
    setRange(sheet, r, QTY_COL, QTY_COL, '', { border: THIN_BORDER })
    setRange(sheet, r, UNIT_COL, UNIT_COL, '', { border: THIN_BORDER })
    const prices = offers.map((o) => o.total_price).filter((p): p is number => p != null)
    const min = prices.length > 0 ? Math.min(...prices) : null
    for (let i = 0; i < n; i++) {
      const s = vendorStart(i)
      const offer = offers[i]
      const isBest = min != null && offer.total_price === min
      const cellFill = isBest ? solidFill(FILL_BEST) : undefined
      setRange(sheet, r, s, s, '', {
        border: THIN_BORDER,
        fill: cellFill,
        alignment: rowImages[i] ? { vertical: 'bottom' } : undefined,
      })
      setRange(sheet, r, s + 1, s + 1, offer.total_price ?? '', {
        border: THIN_BORDER,
        fill: cellFill,
        numFmt: currencyNumFmt(offer.currency),
        font: isBest ? { bold: true, color: { argb: TEXT_BEST } } : undefined,
      })
      setRange(sheet, r, s + 2, s + 2, offer.total_price ?? '', { border: THIN_BORDER, fill: cellFill, numFmt: currencyNumFmt(offer.currency) })
    }

    if (rowHasImage) {
      sheet.getRow(r).height = ITEM_ROW_HEIGHT_WITH_IMAGE
      for (let i = 0; i < n; i++) {
        const image = rowImages[i]
        if (!image) continue
        const s = vendorStart(i)
        const { width, height } = computeThumbnailSize(image.width, image.height, ITEM_THUMB_MAX_W, ITEM_THUMB_MAX_H)
        const imageId = workbook.addImage({ base64: image.dataUrl, extension: 'jpeg' })
        sheet.addImage(imageId, { tl: { col: s - 1 + 0.25, row: r - 1 + 0.08 }, ext: { width, height } })
      }
    }
    r += 1
  }
  r += 2

  // ---- Ticari şartlar -------------------------------------------------
  const termRows = termRowsFor(offers[0]?.extracted_data).map((row, idx) => ({
    label: row.label,
    values: offers.map((o) => termRowsFor(o.extracted_data)[idx].value),
  }))
  const visibleTermRows = termRows.filter((row) => row.values.some((v) => v?.trim()))

  if (visibleTermRows.length > 0) {
    setRange(sheet, r, FIRST_COL, lastCol, 'TİCARİ ŞARTLAR', {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(FILL_SECTION),
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
    sheet.getRow(r).height = 22
    r += 1

    for (const row of visibleTermRows) {
      setRange(sheet, r, FIRST_COL, LABEL_END, row.label, {
        font: { bold: true, size: 10 },
        fill: solidFill(FILL_HEADER),
        border: THIN_BORDER,
        alignment: { vertical: 'top', wrapText: true },
      })
      for (let i = 0; i < n; i++) {
        const s = vendorStart(i)
        const value = row.values[i]?.trim()
        const isMissing = !value
        setRange(sheet, r, s, s + 2, value || '—', {
          border: isMissing ? MISSING_BORDER : THIN_BORDER,
          fill: isMissing ? solidFill(FILL_MISSING) : undefined,
          alignment: { vertical: 'top', horizontal: isMissing ? 'center' : undefined, wrapText: true },
          font: isMissing ? { size: 10, italic: true, color: { argb: TEXT_FAINT } } : { size: 10 },
        })
      }
      sheet.getRow(r).height = 34
      r += 1
    }
    r += 1
  }

  // ---- Teknik özellikler -----------------------------------------------
  const specRows = (input.comparisonTable || []).filter((row) => (row.values || []).some((v) => v.value?.trim() && v.value !== 'Belirtilmemiş'))
  if (specRows.length > 0) {
    setRange(sheet, r, FIRST_COL, lastCol, 'TEKNİK ÖZELLİKLER', {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(FILL_SECTION),
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
    sheet.getRow(r).height = 22
    r += 1

    specRows.forEach((row, idx) => {
      const odd = idx % 2 === 0
      const rowFill = odd ? undefined : solidFill(FILL_ALT_ROW)
      setRange(sheet, r, FIRST_COL, LABEL_END, row.feature, {
        font: { bold: true, size: 10 },
        fill: rowFill || solidFill(FILL_HEADER),
        border: THIN_BORDER,
        alignment: { vertical: 'top', wrapText: true },
      })
      for (let i = 0; i < n; i++) {
        const s = vendorStart(i)
        const offer = offers[i]
        const value = (row.values || []).find((v) => v.offerId === offer.id)?.value?.trim()
        setRange(sheet, r, s, s + 2, value && value !== 'Belirtilmemiş' ? value : '', {
          border: THIN_BORDER,
          fill: rowFill,
          alignment: { vertical: 'top', wrapText: true },
          font: { size: 10 },
        })
      }
      sheet.getRow(r).height = 28
      r += 1
    })
    r += 1
  }

  // ---- DLX AI Değerlendirmesi --------------------------------------------
  // Not: Bu bölümdeki vurgular (öneri satırı, artı/eksi renkleri) yalnızca bu
  // bağımsız değerlendirme bloğuna aittir; yukarıdaki fiyat matrisi tablosu
  // referans şablon gibi tarafsız kalmaya devam eder (bkz. dosya başı notu).
  const rec = input.recommendation
  const hasRecommendationContent =
    !!rec &&
    (rec.summary?.trim() || rec.reasoning?.trim() || (rec.executiveAnalysis && rec.executiveAnalysis.length > 0))

  if (rec && hasRecommendationContent) {
    const recommendedOffer =
      offers.find((o) => o.id === (input.recommendedOfferId || rec.recommendedOfferId)) || null
    const fullWidthChars = sumColumnWidths(sheet, FIRST_COL, lastCol) * 1.15
    const valueWidthChars = sumColumnWidths(sheet, VENDOR_START, lastCol) * 1.15

    setRange(sheet, r, FIRST_COL, lastCol, 'DLX AI DEĞERLENDİRMESİ', {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(FILL_SECTION),
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
    sheet.getRow(r).height = 22
    r += 1

    if (recommendedOffer) {
      const priceText =
        recommendedOffer.total_price != null
          ? `  •  ${getCurrencySymbol(recommendedOffer.currency || 'TRY')}${recommendedOffer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
          : ''
      setRange(
        sheet,
        r,
        FIRST_COL,
        lastCol,
        `Önerilen Teklif: ${offerDisplayName(recommendedOffer)}${priceText}`,
        {
          font: { bold: true, size: 12, color: { argb: TEXT_BEST } },
          fill: solidFill(FILL_BEST),
          alignment: { horizontal: 'left', vertical: 'middle' },
        }
      )
      sheet.getRow(r).height = 22
      r += 1
    }

    if (rec.summary?.trim()) {
      setRange(sheet, r, FIRST_COL, lastCol, rec.summary.trim(), {
        font: { size: 11, bold: true },
        alignment: { vertical: 'top', wrapText: true },
      })
      sheet.getRow(r).height = estimateWrappedRowHeight(rec.summary.trim(), fullWidthChars)
      r += 1
    }

    if (rec.reasoning?.trim()) {
      setRange(sheet, r, FIRST_COL, lastCol, rec.reasoning.trim(), {
        font: { size: 10, color: { argb: TEXT_BODY } },
        alignment: { vertical: 'top', wrapText: true },
      })
      sheet.getRow(r).height = estimateWrappedRowHeight(rec.reasoning.trim(), fullWidthChars)
      r += 1
    }
    r += 1

    const analysisSections = rec.executiveAnalysis || []
    if (analysisSections.length > 0) {
      analysisSections.forEach((section, idx) => {
        const odd = idx % 2 === 0
        const rowFill = odd ? undefined : solidFill(FILL_ALT_ROW)
        setRange(sheet, r, FIRST_COL, LABEL_END, section.title, {
          font: { bold: true, size: 10 },
          fill: rowFill || solidFill(FILL_HEADER),
          border: THIN_BORDER,
          alignment: { vertical: 'top', wrapText: true },
        })
        setRange(sheet, r, VENDOR_START, lastCol, section.detail, {
          border: THIN_BORDER,
          fill: rowFill,
          alignment: { vertical: 'top', wrapText: true },
          font: { size: 10 },
        })
        sheet.getRow(r).height = estimateWrappedRowHeight(section.detail, valueWidthChars, 2)
        r += 1
      })
      r += 1
    }

    // ---- Teklif başına artı/eksi ------------------------------------------
    const prosCons = rec.prosCons || []
    if (prosCons.length > 0) {
      const prosConsByOffer = new Map(prosCons.map((pc) => [pc.offerId, pc]))
      const anyPros = prosCons.some((pc) => (pc.pros || []).length > 0)
      const anyCons = prosCons.some((pc) => (pc.cons || []).length > 0)

      if (anyPros) {
        setRange(sheet, r, FIRST_COL, LABEL_END, 'Artılar', {
          font: { bold: true, size: 10, color: { argb: TEXT_BEST } },
          fill: solidFill(FILL_HEADER),
          border: THIN_BORDER,
          alignment: { vertical: 'top', wrapText: true },
        })
        let maxLines = 1
        for (let i = 0; i < n; i++) {
          const s = vendorStart(i)
          const pros = prosConsByOffer.get(offers[i].id)?.pros || []
          maxLines = Math.max(maxLines, pros.length)
          setRange(sheet, r, s, s + 2, pros.map((p) => `• ${p}`).join('\n'), {
            border: THIN_BORDER,
            alignment: { vertical: 'top', wrapText: true },
            font: { size: 9, color: { argb: TEXT_BEST } },
          })
        }
        sheet.getRow(r).height = Math.max(28, maxLines * 14 + 8)
        r += 1
      }

      if (anyCons) {
        setRange(sheet, r, FIRST_COL, LABEL_END, 'Eksiler', {
          font: { bold: true, size: 10, color: { argb: TEXT_CON } },
          fill: solidFill(FILL_HEADER),
          border: THIN_BORDER,
          alignment: { vertical: 'top', wrapText: true },
        })
        let maxLines = 1
        for (let i = 0; i < n; i++) {
          const s = vendorStart(i)
          const cons = prosConsByOffer.get(offers[i].id)?.cons || []
          maxLines = Math.max(maxLines, cons.length)
          setRange(sheet, r, s, s + 2, cons.map((c) => `• ${c}`).join('\n'), {
            border: THIN_BORDER,
            alignment: { vertical: 'top', wrapText: true },
            font: { size: 9, color: { argb: TEXT_CON } },
          })
        }
        sheet.getRow(r).height = Math.max(28, maxLines * 14 + 8)
        r += 1
      }
      r += 1
    }
  }

  sheet.views = [
    { state: 'frozen', xSplit: ITEM_END, ySplit: headerRowNumber, showGridLines: false },
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFileName(input.title)}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
