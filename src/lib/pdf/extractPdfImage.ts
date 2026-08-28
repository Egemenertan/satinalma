/**
 * Teklif PDF'lerinin içine gömülü JPEG görsellerini (ürün fotoğrafları) çıkarır.
 * PDF'in ham iç yapısını (XObject kaynakları) tarayarak çalışır; harici bir
 * render/dönüştürme servisi gerektirmez, tarayıcıda da Node'da da çalışır.
 *
 * Görseller, PDF içindeki görünüm sırasına (sayfa sırası, sayfa içinde XObject
 * kaynak sözlüğündeki sıra) göre döndürülür — bu sıra, tedarikçi PDF'lerinde
 * genellikle kalemlerin listelendiği sırayla örtüşür ve dışarıda kalem bazlı
 * eşleştirme için kullanılır (bkz. quoteComparisonXlsx.ts).
 *
 * Not: Yalnızca `DCTDecode` (JPEG) ile sıkıştırılmış görseller destekleniyor — gerçek
 * dünyadaki tedarikçi tekliflerinde gömülü ürün fotoğrafları neredeyse her zaman bu
 * biçimdedir ve bu durumda PDF akışındaki ham baytlar zaten geçerli bir .jpg dosyasıdır
 * (yeniden kodlamaya gerek yoktur). Diğer biçimler (ör. ham bitmap/FlateDecode, taranmış
 * belgeler için CCITT/JBIG2) sessizce atlanır; export bu görsel olmadan devam eder.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFStream } from 'pdf-lib'

export interface ExtractedPdfImage {
  /** Zaten JPEG olarak kodlanmış ham bayt dizisi */
  bytes: Uint8Array
  width: number
  height: number
}

const NAME_XOBJECT = PDFName.of('XObject')
const NAME_SUBTYPE = PDFName.of('Subtype')
const NAME_FILTER = PDFName.of('Filter')
const NAME_WIDTH = PDFName.of('Width')
const NAME_HEIGHT = PDFName.of('Height')
const IMAGE_SUBTYPE_STR = PDFName.of('Image').asString()
const JPEG_FILTER_STR = PDFName.of('DCTDecode').asString()

function lastFilterName(dict: PDFDict): string | null {
  const filter = dict.get(NAME_FILTER)
  if (filter instanceof PDFName) return filter.asString()
  if (filter instanceof PDFArray && filter.size() > 0) {
    const last = filter.get(filter.size() - 1)
    if (last instanceof PDFName) return last.asString()
  }
  return null
}

export interface ExtractJpegImagesOptions {
  /** Bu boyuttan küçük görseller (logo, ikon, CE/kalite damgası vb.) atlanır. */
  minWidth?: number
  minHeight?: number
  /**
   * En/boy oranı bu değeri aşan görseller atlanır — üstbilgi/altbilgi şeridi gibi
   * ince-uzun banner logolar genelde bu şekilde elenir, gerçek ürün fotoğrafları
   * (kısa-geniş çekimler dahil) makul bir en/boy oranında kalır.
   */
  maxAspectRatio?: number
}

/** Görsel içeriğine göre hafif bir parmak izi üretir (tam kriptografik hash değil, tekrar eden görselleri ayıklamak için yeterli). */
function hashImageBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  const step = Math.max(1, Math.floor(bytes.length / 4096))
  for (let i = 0; i < bytes.length; i += step) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return `${bytes.length}:${hash >>> 0}`
}

/**
 * Bir PDF'in tüm sayfalarındaki resim XObject'lerini belge sırasıyla tarar; ürün
 * fotoğrafı olması muhtemel JPEG'leri döndürür. Aşağıdaki üç filtre, tipik bir teklif
 * PDF'inde ürün fotoğrafı OLMAYAN görselleri (üstbilgi/logo, CE damgası, kaşe, filigran)
 * ayıklamak için birlikte kullanılır:
 *  1. Minimum boyut — küçük logo/damga/ikonları eler.
 *  2. Maksimum en/boy oranı — ince-uzun banner logoları/ayraçları eler.
 *  3. İçerik tekrarı — belgede birden fazla kez (ör. her sayfanın üstbilgisinde) aynen
 *     tekrar eden bir görsel neredeyse kesinlikle sabit bir logo/filigrandır, benzersiz
 *     bir ürün fotoğrafı değildir; bu yüzden tamamen elenir.
 * Bulamazsa veya PDF okunamazsa boş dizi döner.
 */
export async function extractJpegImagesFromPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  { minWidth = 120, minHeight = 120, maxAspectRatio = 3 }: ExtractJpegImagesOptions = {}
): Promise<ExtractedPdfImage[]> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })

    const candidates: ExtractedPdfImage[] = []

    for (const page of pdfDoc.getPages()) {
      const resources = page.node.Resources()
      const xObjects = resources?.lookupMaybe(NAME_XOBJECT, PDFDict)
      if (!xObjects) continue

      for (const name of xObjects.keys()) {
        const stream = xObjects.lookupMaybe(name, PDFStream)
        if (!stream) continue

        const subtype = stream.dict.get(NAME_SUBTYPE)
        if (!(subtype instanceof PDFName) || subtype.asString() !== IMAGE_SUBTYPE_STR) continue
        if (lastFilterName(stream.dict) !== JPEG_FILTER_STR) continue

        const widthObj = stream.dict.get(NAME_WIDTH)
        const heightObj = stream.dict.get(NAME_HEIGHT)
        const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : 0
        const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : 0
        if (width < minWidth || height < minHeight) continue
        if (Math.max(width, height) / Math.min(width, height) > maxAspectRatio) continue

        candidates.push({ bytes: stream.getContents(), width, height })
      }
    }

    const hashCounts = new Map<string, number>()
    const hashes = candidates.map((image) => {
      const hash = hashImageBytes(image.bytes)
      hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1)
      return hash
    })

    return candidates.filter((_, idx) => hashCounts.get(hashes[idx]) === 1)
  } catch {
    return []
  }
}

/** Genişlik/yükseklik oranını koruyarak, verilen maksimum sınırlar içinde bir küçük resim (thumbnail) boyutu hesaplar. */
export function computeThumbnailSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (!width || !height) return { width: maxWidth, height: maxHeight }
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
