import 'server-only'

import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'
import { getAnthropicClient, getAnthropicExtractionModel, getAnthropicModel } from '@/lib/ai/anthropicClient'
import {
  completeQuoteLineItems,
  extractedDataLooksIncomplete,
  mapPool,
  normalizeExtractedLineItems,
} from '@/lib/ai/extractQuoteLineItems'
import { toUserFacingAiErrorMessage } from '@/lib/ai/friendlyError'
import { normalizeCurrencyCode } from '@/lib/quoteComparison/currency'
import {
  comparePozKeys,
  inferPozNo,
  normalizePozKey,
  stripPozPrefix,
} from '@/lib/quoteComparison/pozNo'
import { extractQuoteDocumentContent } from '@/lib/pdf/extractQuoteText'
import {
  QUOTE_COMPARISON_STORAGE_BUCKET,
  type QuoteComparisonExecutiveAnalysisSection,
  type QuoteComparisonExtractedData,
  type QuoteComparisonLineItemRow,
  type QuoteComparisonNotableDifference,
  type QuoteComparisonProsCons,
  type QuoteComparisonTableRow,
} from '@/types/quoteComparison'

type JobClient = SupabaseClient

const EXTRACT_OFFER_TOOL: Anthropic.Tool = {
  name: 'extract_offer',
  description:
    'Bir tedarikçi teklif/fiyat teklifi (proforma) PDF dokümanından yapılandırılmış veriyi çıkarır.',
  input_schema: {
    type: 'object',
    properties: {
      supplier_name: { type: ['string', 'null'], description: 'Teklifi veren firmanın adı' },
      supplier_contact_person: { type: ['string', 'null'], description: 'Teklifi hazırlayan/imzalayan yetkili kişinin adı' },
      supplier_phone: { type: ['string', 'null'], description: 'Tedarikçi yetkilisinin telefon numarası' },
      supplier_email: { type: ['string', 'null'], description: 'Tedarikçi yetkilisinin e-posta adresi' },
      product_name: { type: ['string', 'null'], description: 'Teklif edilen ana ürün/malzemenin adı veya özeti' },
      quantity: { type: ['string', 'null'], description: 'Miktar (birimiyle birlikte, örn: "2 adet")' },
      unit_price: {
        type: ['number', 'null'],
        description:
          'Birim fiyat (sayısal, para birimi hariç). SADECE PDF\'de birim fiyatı gösteren AYRI/GERÇEK bir sütun/değer varsa doldur. Teklif birden fazla farklı fiyatlı kalem içeriyorsa null bırak. PDF\'de miktarın yanında SADECE tek bir fiyat sütunu varsa (birim fiyat için ayrı sütun yoksa, örn. sadece "Tutar/Toplam/KDV Dahil Fiyat" gibi bir sütun varsa), bu alanı null bırak — total_price/miktar bölerek KENDİN bir birim fiyat ÜRETME; PDF\'de yazmayan bir sayıyı var etme.',
      },
      total_price: {
        type: ['number', 'null'],
        description:
          'Toplam/genel tutar (sayısal, para birimi hariç, KDV dahilse belirt). Teklif birden fazla kalem içeriyorsa bu, TÜM kalemlerin toplamı (genel toplam) olmalı.',
      },
      currency: { type: ['string', 'null'], description: 'Para birimi kodu: TRY, USD, EUR, GBP vb.' },
      quote_date: { type: ['string', 'null'], description: 'Teklifin tarihi (PDF üzerinde yazıyorsa, YYYY-MM-DD veya olduğu gibi metin)' },
      delivery_time: { type: ['string', 'null'], description: 'Teslimat süresi (örn: "3-4 hafta")' },
      warranty: { type: ['string', 'null'], description: 'Garanti süresi/şartları' },
      payment_terms: { type: ['string', 'null'], description: 'Ödeme şekli/koşulları (örn: "%40 peşin, %30 sevk, %30 teslim")' },
      shipping_responsibility: { type: ['string', 'null'], description: 'Nakliye kime ait (örn: "Alıcı", "Satıcı", "Tedarikçi dahil")' },
      installation_responsibility: { type: ['string', 'null'], description: 'Montaj kime ait (örn: "Alıcı", "Satıcı", "Teklife dahil")' },
      vat_status: { type: ['string', 'null'], description: 'KDV durumu (örn: "KDV Hariç", "KDV Dahil %20")' },
      line_items: {
        type: 'array',
        description:
          'Fiyat tablosundaki HER ürün satırı ayrı bir eleman olsun (5 kalem de 150 kalem de). Kategori özeti, "çeşitli malzemeler" veya ilk 10 satırla yetinme — kalan kalemler sonraki adımda tamamlanır ama bu geçişte de mümkün olduğunca çok satır yaz. Teklif tek kalem/tek fiyatsa bu diziyi boş bırak.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kalemin/ünitenin adı (ürün açıklaması; poz numarasını tekrar etme)' },
            poz_no: {
              type: ['string', 'null'],
              description:
                'Poz / Poz No sütunu varsa (A1, A2, 01.02). Sıra/S.No düz numarasını yazma. Yoksa null.',
            },
            quantity: { type: ['string', 'null'], description: 'Bu kalemin miktarı' },
            unit: { type: ['string', 'null'], description: 'Birim (örn: "adet")' },
            model: { type: ['string', 'null'], description: 'Bu kalem için teklif edilen model/tip adı' },
            unit_price: {
              type: ['number', 'null'],
              description:
                'Bu kalemin TEK adedinin fiyatı (sayısal). SADECE PDF\'de bu satır için birim fiyat gösteren AYRI/GERÇEK bir sütun/değer varsa doldur (örn. "Birim Fiyatı" başlıklı sütun). PDF\'de bu kalem için sadece TEK bir fiyat sütunu varsa (örn. "Tutar", "Toplam", "Ara Toplam", "KDV Dahil Fiyat", "KDV Hariç Fiyat" gibi bir başlık altında, ayrı bir birim fiyat sütunu YOKSA), bu alanı null BIRAK — total_price\'ı quantity\'e bölerek KENDİN bir birim fiyat hesaplayıp buraya yazma; PDF\'de fiilen yazmayan bir kolonu/sayıyı var etme.',
            },
            total_price: {
              type: ['number', 'null'],
              description:
                'Bu kalemin TOPLAM fiyatı (sayısal). PDF\'de kalemin yanında yazılı olan tutarı OLDUĞU GİBİ al; kendi başına birim fiyatı miktarla çarparak yapay bir toplam ÜRETME. Eğer PDF\'de bu kalem için sadece TEK bir fiyat sütunu varsa (adı "Tutar/Toplam/Fiyat/KDV Dahil Fiyat/KDV Hariç Fiyat" ne olursa olsun) ve bu, o satırın quantity kadarlık tüm miktarı için geçerli tek tutar ise, o değeri direkt ve olduğu gibi buraya yaz.',
            },
            currency: {
              type: ['string', 'null'],
              description:
                'BU KALEMİN fiyatının para birimi (TRY, USD, EUR, GBP). PDF\'de sembol ($ € £ ₺) veya yazıyla (dolar, euro/avro, sterlin, TL/lira) belirtilmiş olabilir. ÇOK ÖNEMLİ: Bunu HER SATIR için ayrı ayrı kontrol et — aynı teklifte bir kalem "€" ile, bir başka kalem "TL" ile fiyatlandırılmış olabilir; üstteki genel currency alanıyla aynı olacağını VARSAYMA. Bu kalem için sembol/ifade net değilse null bırak (o zaman genel currency kullanılır).',
            },
          },
          required: ['name'],
        },
      },
      specs: {
        type: 'array',
        description:
          "Teknik özellikler ve PDF'de geçen tüm maddeler (malzeme, ölçü, kapasite, standart, kapsam, ek şart). Ödeme koşulları, teslimat süresi, garanti, nakliye/montaj sorumluluğu ve KDV durumunu buraya YAZMA — bunlar için yukarıda ayrı alanlar var. Yalnızca ortak olanları değil; bu teklife özgü maddeleri de yaz. Atlama, uydurma.",
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Özellik adı (örn: "Malzeme", "Kapasite", "Hız")' },
            value: { type: 'string', description: 'Özellik değeri' },
          },
          required: ['name', 'value'],
        },
      },
      notes: {
        type: ['array', 'string', 'null'],
        description:
          'PDF’deki not, şart, istisna, opsiyon süresi ve açıklamalar. HER MADDE ayrı bir dizi elemanı olsun; tek paragrafa sıkıştırma.',
        items: { type: 'string' },
      },
    },
    required: ['specs'],
  },
}

const COMPARE_OFFERS_TOOL: Anthropic.Tool = {
  name: 'compare_offers',
  description:
    'Birden fazla tedarikçi teklifini karşılaştırır. ÖNCE önerilen teklifi ve kısa gerekçeyi yaz, sonra karşılaştırma tablosunu doldur.',
  input_schema: {
    type: 'object',
    properties: {
      recommendedOfferId: {
        type: 'string',
        description: 'En optimum teklifin offerId değeri. Girişteki offerId ile birebir aynı UUID olmalı.',
      },
      summary: {
        type: 'string',
        description:
          '2-3 cümlelik Türkçe özet. İlk cümlede önerilen teklifin displayName adını açıkça yaz (örn: "DLX AI AQUASAN teklifini önerir, çünkü...").',
      },
      reasoning: {
        type: 'string',
        description:
          'Kısa Türkçe gerekçe (en fazla 4 cümle). Fiyat, teslimat, kapsam ve belirgin farklara değin.',
      },
      priorityConsideration: {
        type: 'string',
        description: 'Kullanıcı öncelikleri nasıl yansıdı; yoksa kısa bir cümle.',
      },
      executiveAnalysis: {
        type: 'array',
        description:
          'Deneyimli bir inşaat şirketi CEO\'su / satın alma direktörü gözüyle YAPILANDIRILMIŞ derinlemesine değerlendirme. Tam olarak şu 5 başlığı bu sırayla ve TÜM tekliflere atıfla, somut sayı/tarih/fark belirterek doldur: "Mali Etki" (fiyat farkları, toplam maliyet, ödeme planının nakit akışına etkisi), "Teslimat ve Operasyonel Risk" (teslim süresi farkları, gecikme riski, proje takvimine etkisi), "Teknik ve Kapsam Uygunluğu" (spesifikasyon/kapsam farkları, eksik/fazla kalemler), "Tedarikçi Güvenilirliği" (garanti, referans, iletişim bilgisi netliği, teklif ciddiyeti gibi ipuçlarından çıkarım), "Sonuç ve Karar" (net tavsiye, kısa vadeli ve uzun vadeli gerekçe, varsa dikkat edilmesi gereken risk). Her bölüm 2-4 somut cümle olsun, genel geçer laf kalabalığı yapma.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['title', 'detail'],
        },
      },
      notableDifferences: {
        type: 'array',
        description: 'En fazla 8 belirgin fark. Küçük yazım farklarını yazma.',
        items: {
          type: 'object',
          properties: {
            feature: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['feature', 'detail'],
        },
      },
      prosCons: {
        type: 'array',
        description: 'Her teklif için artı/eksi',
        items: {
          type: 'object',
          properties: {
            offerId: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
          },
          required: ['offerId', 'pros', 'cons'],
        },
      },
      comparisonRows: {
        type: 'array',
        description:
          'Normalize TEKNİK özellik karşılaştırma tablosu. Yalnızca ortak özellikleri değil: herhangi bir teklifte geçen her teknik madde bir satır olsun. Diğer teklifte yoksa value="Belirtilmemiş". Aynı anlama gelen isimleri birleştir. Ödeme koşulları, teslimat süresi, garanti, nakliye/montaj sorumluluğu, teklif tarihi ve KDV durumu için buraya satır EKLEME (bunlar ayrı bir ticari şartlar tablosunda gösteriliyor). Notlar satırında value’yu tek paragrafa yığma; her maddeyi satır sonu (\\n) ile ayır. Bu alanı EN SON doldur.',
        items: {
          type: 'object',
          properties: {
            feature: { type: 'string', description: 'Özellik/kriter adı (Türkçe)' },
            values: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  offerId: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['offerId', 'value'],
              },
            },
            isDistinct: { type: 'boolean' },
          },
          required: ['feature', 'values', 'isDistinct'],
        },
      },
      lineItemComparison: {
        type: 'array',
        description:
          'SADECE bir veya daha fazla teklifte line_items doluysa doldur; hiçbir teklifte line_items yoksa bu diziyi boş bırak. Farklı tekliflerdeki AYNI FİZİKSEL kalemi/üniteyi (örn. bir teklifte "ELV-1", diğerinde "AS-1", diğerinde "Asansör 1" hepsi aynı kalemi ifade ediyorsa) TEK satırda hizala; kullanım amacı/konum/sıra gibi ipuçlarından anla. Bir teklifte o kalem için hiç fiyat yoksa o teklifin values girdisini unitPrice/totalPrice=null ile ekle veya hiç ekleme.',
        items: {
          type: 'object',
          properties: {
            itemLabel: { type: 'string', description: 'Kalemin ortak/okunabilir adı. Poz varsa "A1" gibi poz kodu olsun.' },
            pozNo: { type: ['string', 'null'], description: 'Ortak poz no (A1). Yoksa null.' },
            quantity: { type: ['string', 'null'] },
            unit: { type: ['string', 'null'] },
            values: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  offerId: { type: 'string' },
                  itemName: { type: ['string', 'null'], description: 'Bu teklifteki ürün adı' },
                  model: { type: ['string', 'null'] },
                  unitPrice: { type: ['number', 'null'] },
                  totalPrice: { type: ['number', 'null'] },
                  currency: {
                    type: ['string', 'null'],
                    description:
                      'Bu hücrenin para birimi (TRY/USD/EUR/GBP). İlgili tekliften alınan line_items verisindeki currency değeriyle AYNI olmalı; aynı teklifte kalemden kaleme farklı olabilir, teklifin genel para birimiyle karıştırma.',
                  },
                },
                required: ['offerId'],
              },
            },
          },
          required: ['itemLabel', 'values'],
        },
      },
    },
    required: ['recommendedOfferId', 'summary', 'reasoning', 'executiveAnalysis', 'comparisonRows', 'prosCons'],
  },
}

const RECOMMEND_OFFER_TOOL: Anthropic.Tool = {
  name: 'recommend_offer',
  description: 'Karşılaştırma tablosuna bakarak en uygun teklifi seçer ve kısa Türkçe gerekçe yazar.',
  input_schema: {
    type: 'object',
    properties: {
      recommendedOfferId: {
        type: 'string',
        description: 'Önerilen teklifin offerId değeri (girişteki UUID ile birebir aynı)',
      },
      summary: {
        type: 'string',
        description: '2-3 cümle. İlk cümlede displayName ile hangi teklifin önerildiğini yaz.',
      },
      reasoning: {
        type: 'string',
        description: 'En fazla 4 cümlelik gerekçe.',
      },
      priorityConsideration: { type: 'string' },
      executiveAnalysis: {
        type: 'array',
        description:
          'Deneyimli bir inşaat şirketi CEO\'su gözüyle "Mali Etki", "Teslimat ve Operasyonel Risk", "Teknik ve Kapsam Uygunluğu", "Tedarikçi Güvenilirliği", "Sonuç ve Karar" başlıklarıyla kısa derinlemesine değerlendirme.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['title', 'detail'],
        },
      },
      prosCons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            offerId: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
          },
          required: ['offerId', 'pros', 'cons'],
        },
      },
    },
    required: ['recommendedOfferId', 'summary', 'reasoning'],
  },
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

export async function createQuoteComparisonJobClient(accessToken: string, refreshToken: string): Promise<JobClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const client = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    throw new Error('Arka plan oturumu oluşturulamadı.')
  }

  return client
}

/**
 * PDF'in sayfa sayısını okur. Bu, hem AI'a "kaç sayfası var, hepsini gez" bilgisini
 * vermek için hem de çok sayfalı (dolayısıyla çok kalemli olma olasılığı yüksek)
 * dokümanlarda daha güçlü/dikkatli bir modele geçmek için kullanılır. Okunamazsa
 * (bozuk/şifreli PDF gibi) analiz akışını kesmeden null döner.
 */
async function getPdfPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false })
    return doc.getPageCount()
  } catch (error) {
    console.warn('[getPdfPageCount] PDF sayfa sayısı okunamadı:', error)
    return null
  }
}

async function fetchOfferFileAsBase64(
  supabase: JobClient,
  filePath: string
): Promise<{ base64: string; buffer: Buffer }> {
  const { data, error } = await supabase.storage.from(QUOTE_COMPARISON_STORAGE_BUCKET).download(filePath)
  if (error || !data) {
    throw new Error(`PDF indirilemedi (${filePath}): ${error?.message || 'bilinmeyen hata'}`)
  }
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return { base64: buffer.toString('base64'), buffer }
}

async function extractOfferData(
  anthropic: Anthropic,
  headerModel: string,
  chunkModel: string,
  strongModel: string,
  pdfBase64: string,
  pageCount: number | null,
  pdfBuffer: Buffer,
  documentContent: Awaited<ReturnType<typeof extractQuoteDocumentContent>>
): Promise<QuoteComparisonExtractedData> {
  const pageCountBlock =
    pageCount && pageCount > 1
      ? `\n\nSAYFA SAYISI: Bu PDF TOPLAM ${pageCount} sayfadır. 1. sayfadan ${pageCount}. sayfaya kadar HER SAYFAYI ayrı ayrı, dikkatlice tara. Kalem/fiyat tablosu birden fazla sayfaya yayılmış olabilir (örn. sayfa 1-3 tablo başlıkları+ilk kalemler, sayfa 4-10 devam eden kalemler); sadece ilk sayfalara bakıp geri kalanını atlama. Her sayfadaki her satırı line_items dizisine ekle; ${pageCount} sayfalık bir dokümanda genellikle onlarca kalem olur, bunu az sayıda kalemle "özetleme".`
      : ''

  const extractionInstructions =
    "Bu bir tedarikçi teklif/fiyat teklifi (proforma) PDF dokümanıdır. extract_offer tool'unu kullanarak dokümandaki önemli bilgileri Türkçe olarak çıkar. PDF'de yazan teknik madde, kapsam, şart ve özelliği specs listesine ekle. Notları tek paragrafa yığma; her şartı ayrı madde yaz. Emin olmadığın alanları null bırak, uydurma bilgi ekleme.\n\nFİYAT SÜTUNLARINA ÇOK DİKKAT ET: Kalem/ünite bazlı fiyat tablosunda (line_items) her satırın kaç fiyat sütunu olduğuna bak. Eğer tabloda hem 'Birim Fiyat' hem 'Toplam Fiyat/Tutar' diye AYRI iki sütun varsa, her ikisini de PDF'de yazdığı gibi ayrı ayrı al. Eğer tabloda miktar (adet) sütununun yanında SADECE TEK bir fiyat sütunu varsa (başlığı 'Tutar', 'Toplam', 'Ara Toplam', 'Fiyat', 'KDV Dahil Fiyat', 'KDV Hariç Fiyat' gibi herhangi bir isimle olsun), bu tek değer o satırın TOPLAM tutarıdır: total_price'a yaz, unit_price'ı NULL bırak. Bu durumda unit_price'ı total_price'ı miktara bölerek KENDİN hesaplayıp doldurma — PDF'de yazmayan bir sütunu/sayıyı var etmiş olursun. ASLA bu tek toplam değeri unit_price'a yazıp miktarla çarparak yeni bir toplam üretme; bu ciddi bir hataya (fiyatın adet kadar katlanmasına) yol açar.\n\nKALEM LİSTESİ: Fiyat tablosundaki satırları line_items'a yaz. 20-30 satırdan fazlaysa bu geçişte ilk/görünen satırları yazman yeterli — kalan kalemler sonraki adımda tablodan tamamlanır. 'Çeşitli (Toplam 89+ kalem)' gibi özet SATIR yazma. Genel toplamı (Genel Toplam/Grand Total) total_price alanına yaz.\n\nPARA BİRİMİNE DİKKAT: Kalem bazlı fiyat tablosunda HER SATIRIN kendi para birimini (sembol: $ € £ ₺, veya yazı: dolar/euro/avro/sterlin/TL/lira) ayrı ayrı oku ve o kalemin currency alanına yaz. Bir PDF içinde farklı satırlar farklı para biriminde olabilir." +
    pageCountBlock

  // Not: .stream(...).finalMessage() kullanıyoruz (create() değil). Anthropic SDK,
  // büyük max_tokens değerlerinde ("10 dakikadan uzun sürebilir" tahmini) non-streaming
  // isteği reddediyor ve streaming zorunlu kılıyor; biz de tam mesajı bekleyip tek seferde
  // kullandığımız için stream()'in finalMessage() yardımcısı create() ile birebir aynı
  // sonucu (tam Message nesnesi) verir, sadece bu hatayı ortadan kaldırır.
  async function attempt(useModel: string, maxTokens: number, extraInstructions?: string): Promise<Anthropic.Message> {
    const stream = anthropic.messages.stream({
      model: useModel,
      max_tokens: maxTokens,
      tools: [EXTRACT_OFFER_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_OFFER_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: extraInstructions ? `${extractionInstructions}\n\n${extraInstructions}` : extractionInstructions,
            },
          ],
        },
      ],
    })
    return stream.finalMessage()
  }

  let message = await attempt(headerModel, 16000)
  // Çıkış token sınırına çarptıysa (çok kalemli/çok sayfalı teklif), çok daha büyük bir
  // bütçeyle tekrar dene; aksi halde kalemler yarıda kesilip veri kaybına yol açar.
  if (message.stop_reason === 'max_tokens') {
    console.warn('[extractOfferData] max_tokens sınırına ulaşıldı (16000), 32000 ile tekrar deneniyor.')
    message = await attempt(headerModel, 32000)
  }

  const extracted = normalizeExtractedOffer(getToolInput<QuoteComparisonExtractedData>(message, EXTRACT_OFFER_TOOL.name))

  // İlk geçiş metadata + kısmi kalem listesi üretir. Kalabalık tablolar (80-150 satır)
  // tek tool çıktısına sığmadığı için kalan satırlar tablo/metin/sayfa dilimleriyle tamamlanır.
  const lineItems = await completeQuoteLineItems({
    anthropic,
    extractionModel: chunkModel,
    strongModel,
    pdfBase64,
    pdfBuffer,
    pageCount,
    content: documentContent,
    seedItems: extracted.line_items,
    grandTotal: extracted.total_price,
    currency: extracted.currency,
  })

  return { ...extracted, line_items: lineItems }
}

function normalizeExtractedOffer(extracted: QuoteComparisonExtractedData): QuoteComparisonExtractedData {
  return {
    ...extracted,
    notes: normalizeNotesField((extracted as { notes?: unknown }).notes),
    line_items: normalizeExtractedLineItems((extracted as { line_items?: unknown }).line_items),
  }
}

interface CompareInput {
  offerId: string
  fileName: string
  displayName: string
  extracted: QuoteComparisonExtractedData
}

interface CompareResult {
  comparisonRows: QuoteComparisonTableRow[]
  lineItemComparison: QuoteComparisonLineItemRow[]
  recommendedOfferId: string
  summary: string
  reasoning: string
  notableDifferences: QuoteComparisonNotableDifference[]
  executiveAnalysis: QuoteComparisonExecutiveAnalysisSection[]
  priorityConsideration?: string
  prosCons: QuoteComparisonProsCons[]
}

function normalizeExecutiveAnalysis(value: unknown): QuoteComparisonExecutiveAnalysisSection[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw): QuoteComparisonExecutiveAnalysisSection | null => {
      const section = raw as Partial<QuoteComparisonExecutiveAnalysisSection> | null
      const title = section?.title ? String(section.title).trim() : ''
      const detail = section?.detail ? String(section.detail).trim() : ''
      if (!title || !detail) return null
      return { title, detail }
    })
    .filter((section): section is QuoteComparisonExecutiveAnalysisSection => section !== null)
}

function normalizeNotesField(notes: unknown): string | null {
  if (Array.isArray(notes)) {
    const items = notes.map((item) => String(item ?? '').trim()).filter(Boolean)
    return items.length > 0 ? items.join('\n') : null
  }
  if (typeof notes === 'string' && notes.trim()) return notes.trim()
  return null
}

function hasUsableExtractedData(value: unknown): value is QuoteComparisonExtractedData {
  if (!value || typeof value !== 'object') return false
  return Array.isArray((value as QuoteComparisonExtractedData).specs)
}

async function setAnalysisProgress(
  supabase: JobClient,
  comparisonId: string,
  progress: number,
  step: string
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)))
  const { error } = await supabase
    .from('quote_comparisons')
    .update({ analysis_progress: clamped, analysis_step: step })
    .eq('id', comparisonId)
    .eq('status', 'analyzing')
    .lt('analysis_progress', clamped)

  if (error) {
    console.warn('[quote-comparison/analyze] progress update failed:', error.message)
  }
}

function resolveOfferId(offers: CompareInput[], raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const value = raw.trim()
  const exact = offers.find((o) => o.offerId === value)
  if (exact) return exact.offerId

  const needle = value.toLocaleLowerCase('tr-TR')
  const byName = offers.find((o) =>
    [o.displayName, o.fileName, o.extracted.supplier_name || ''].some((n) => {
      const normalized = n.trim().toLocaleLowerCase('tr-TR')
      return normalized === needle || (normalized.length > 3 && (normalized.includes(needle) || needle.includes(normalized)))
    })
  )
  if (byName) return byName.offerId

  const asIndex = Number(value)
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < offers.length) {
    return offers[asIndex].offerId
  }
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= offers.length) {
    return offers[asIndex - 1].offerId
  }
  return null
}

function normalizeFeatureKey(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}

function collectOfferFeatures(offer: CompareInput): { feature: string; value: string }[] {
  const items: { feature: string; value: string }[] = []
  const extracted = offer.extracted
  const push = (feature: string, value: string | number | null | undefined) => {
    if (value == null || String(value).trim() === '') return
    items.push({ feature, value: String(value).trim() })
  }

  const hasLineItems = (extracted.line_items || []).length > 0

  push('Ürün / malzeme', extracted.product_name)
  // Kalem bazlı teklifte miktar/birim fiyat her kalem için ayrı olduğundan
  // genel özellik tablosuna değil, kalem karşılaştırma tablosuna yazılır.
  if (!hasLineItems) {
    push('Miktar', extracted.quantity)
    if (extracted.unit_price != null) push('Birim fiyat', String(extracted.unit_price))
  }
  // Teslimat süresi, garanti ve ödeme koşulları ayrı "ticari şartlar" tablosunda
  // gösterildiği için burada tekrar edilmez (bkz. buildCommercialTerms).
  push('Notlar', normalizeNotesField(extracted.notes))

  for (const spec of extracted.specs || []) {
    if (spec?.name?.trim() && spec?.value?.trim()) {
      items.push({ feature: spec.name.trim(), value: spec.value.trim() })
    }
  }

  return items
}

function mergeComparisonRows(
  aiRows: QuoteComparisonTableRow[] | undefined,
  offers: CompareInput[]
): QuoteComparisonTableRow[] {
  const offerIds = offers.map((o) => o.offerId)
  const rowsByKey = new Map<string, QuoteComparisonTableRow>()
  const order: string[] = []

  const ensureRow = (feature: string): QuoteComparisonTableRow => {
    const key = normalizeFeatureKey(feature)
    let row = rowsByKey.get(key)
    if (!row) {
      row = {
        feature,
        values: offerIds.map((id) => ({ offerId: id, value: 'Belirtilmemiş' })),
        isDistinct: false,
      }
      rowsByKey.set(key, row)
      order.push(key)
    }
    return row
  }

  for (const row of aiRows || []) {
    if (!row?.feature?.trim()) continue
    const next = ensureRow(row.feature)
    for (const cell of row.values || []) {
      const current = next.values.find((v) => v.offerId === cell.offerId)
      const incoming = cell.value?.trim()
      if (current && incoming && incoming !== 'Belirtilmemiş') {
        current.value = incoming
      }
    }
    if (row.isDistinct) next.isDistinct = true
  }

  for (const offer of offers) {
    for (const item of collectOfferFeatures(offer)) {
      const row = ensureRow(item.feature)
      const current = row.values.find((v) => v.offerId === offer.offerId)
      if (current && (!current.value || current.value === 'Belirtilmemiş')) {
        current.value = item.value
      }
    }
  }

  return order.map((key) => {
    const row = rowsByKey.get(key)!
    const filled = row.values
      .map((v) => v.value.trim())
      .filter((v) => v && v !== 'Belirtilmemiş')
    const missingSome = row.values.some((v) => !v.value || v.value === 'Belirtilmemiş')
    row.isDistinct =
      row.isDistinct || missingSome || new Set(filled.map((v) => v.toLocaleLowerCase('tr-TR'))).size > 1
    return row
  })
}

function normalizeItemKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Bir teklifin belirli bir model/kod için sadece BİR kez tabloya girmesini garanti
 * etmek için kullanılan anahtar. AI bazen aynı fiziksel kalemi hem doğru şekilde
 * (tüm tekliflerle birlikte) hem de tekliflerin kendi adlandırmasıyla tekrar tekrar
 * (her teklif için ayrı, "yalnız" bir satır olarak) döndürebiliyor. itemLabel farklı
 * yazıldığı için normalizeItemKey bunu yakalayamaz; model kodu ise genelde tutarlı
 * kaldığından daha güvenilir bir tekilleştirme anahtarı sağlar.
 */
function normalizeModelKey(model: string | null | undefined): string | null {
  if (!model?.trim()) return null
  const key = model.trim().toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '')
  return key || null
}

function cellDedupeKey(offerId: string, model: string | null | undefined): string | null {
  const modelKey = normalizeModelKey(model)
  if (!modelKey || modelKey.length < 4) return null
  return `${offerId}::${modelKey}`
}

/**
 * Farklı tekliflerde farklı adlandırılmış (ör. "ELV-1" ~ "AS-1" ~ "Asansör 1")
 * ama aynı fiziksel kalemi temsil eden satırları tek satırda birleştirir.
 * Önce AI'ın (bağlamı görerek yaptığı) hizalamasını esas alır; AI'ın gözden
 * kaçırdığı kalemleri tekliflerin kendi line_items listesinden tamamlar.
 *
 * Ayrıca aynı teklif+model ikilisinin (AI'ın kendi tool çıktısında ya da AI+ham veri
 * karışımında) birden fazla satırda tekrar etmesini engeller: bir (offerId, model)
 * çifti bir kez bir satıra yerleştirildikten sonra, aynı çift başka bir satırda tekrar
 * görünürse o hücre görmezden gelinir. Bu, toplam fiyatların iki katına çıkmasına
 * sebep olan "aynı kalemin tekrar satırı" sorununu (bkz. duplicate line item bug) önler.
 */
/**
 * Bir hücrenin para birimini belirler: önce o kalem için AI/PDF'ten okunan değeri
 * (varsa) kullanır; net değilse teklifin genel para birimine düşer. Bu sayede aynı
 * teklifte kalemden kaleme farklı para birimi olsa bile hiçbir hücre para birimsiz
 * (belirsiz) kalmaz.
 */
function resolveCellCurrency(rawCurrency: string | null | undefined, offer: CompareInput): string {
  return normalizeCurrencyCode(rawCurrency) || normalizeCurrencyCode(offer.extracted.currency) || 'TRY'
}

function mergeLineItems(
  aiRows: QuoteComparisonLineItemRow[] | undefined,
  offers: CompareInput[]
): QuoteComparisonLineItemRow[] {
  const offersWithItems = offers.filter((o) => (o.extracted.line_items || []).length > 0)
  if (offersWithItems.length === 0) return []

  const rows: QuoteComparisonLineItemRow[] = []
  const rowByKey = new Map<string, QuoteComparisonLineItemRow>()
  const seenCellKeys = new Set<string>()

  const makeRow = (
    label: string,
    pozNo: string | null,
    quantity: string | null,
    unit: string | null
  ): QuoteComparisonLineItemRow => ({
    itemLabel: label,
    pozNo,
    quantity: quantity ?? null,
    unit: unit ?? null,
    values: [],
  })

  const ensurePozRow = (poz: string, quantity: string | null, unit: string | null): QuoteComparisonLineItemRow => {
    const key = `poz:${normalizePozKey(poz) || poz}`
    let row = rowByKey.get(key)
    if (!row) {
      row = makeRow(poz, poz, quantity, unit)
      rowByKey.set(key, row)
      rows.push(row)
    }
    return row
  }

  const ensureNameRow = (label: string, quantity: string | null, unit: string | null): QuoteComparisonLineItemRow => {
    const key = `name:${normalizeItemKey(label)}`
    let row = rowByKey.get(key)
    if (!row) {
      row = makeRow(label, null, quantity, unit)
      rowByKey.set(key, row)
      rows.push(row)
    }
    return row
  }

  const ensureNameRowForOffer = (
    label: string,
    quantity: string | null,
    unit: string | null,
    offerId: string
  ): QuoteComparisonLineItemRow => {
    const row = ensureNameRow(label, quantity, unit)
    if (!row.values.some((v) => v.offerId === offerId)) return row
    const unique = makeRow(label, null, quantity, unit)
    rowByKey.set(`name:${normalizeItemKey(label)}#${rows.length}`, unique)
    rows.push(unique)
    return unique
  }

  const pushCell = (
    row: QuoteComparisonLineItemRow,
    cell: QuoteComparisonLineItemRow['values'][number],
    dedupeKey: string | null
  ) => {
    if (row.values.some((v) => v.offerId === cell.offerId)) return
    row.values.push(cell)
    if (dedupeKey) seenCellKeys.add(dedupeKey)
  }

  for (const offer of offersWithItems) {
    for (const item of offer.extracted.line_items || []) {
      if (!item?.name?.trim()) continue
      const poz = inferPozNo(item.poz_no, item.name)
      const pozKey = poz ? `${offer.offerId}::poz:${normalizePozKey(poz)}` : null
      const modelKey = cellDedupeKey(offer.offerId, item.model)
      if ((pozKey && seenCellKeys.has(pozKey)) || (modelKey && seenCellKeys.has(modelKey))) continue

      const itemName = stripPozPrefix(item.name.trim(), poz)
      const cell = {
        offerId: offer.offerId,
        itemName,
        model: item.model ?? null,
        unitPrice: typeof item.unit_price === 'number' ? item.unit_price : null,
        totalPrice: typeof item.total_price === 'number' ? item.total_price : null,
        currency: resolveCellCurrency(item.currency, offer),
      }

      if (poz) {
        const row = ensurePozRow(poz, item.quantity ?? null, item.unit ?? null)
        pushCell(row, cell, pozKey)
      } else {
        const row = ensureNameRowForOffer(item.name.trim(), item.quantity ?? null, item.unit ?? null, offer.offerId)
        pushCell(row, cell, modelKey)
      }
    }
  }

  for (const aiRow of aiRows || []) {
    if (!aiRow?.itemLabel?.trim()) continue
    const aiPoz = inferPozNo(aiRow.pozNo, aiRow.itemLabel)
    for (const cell of aiRow.values || []) {
      const offerId = resolveOfferId(offers, (cell as { offerId?: string }).offerId)
      if (!offerId) continue
      const offer = offers.find((o) => o.offerId === offerId)
      const pozKey = aiPoz ? `${offerId}::poz:${normalizePozKey(aiPoz)}` : null
      const modelKey = cellDedupeKey(offerId, cell.model)
      if ((pozKey && seenCellKeys.has(pozKey)) || (modelKey && seenCellKeys.has(modelKey))) continue

      const next = {
        offerId,
        itemName: (cell as { itemName?: string | null }).itemName?.trim() || stripPozPrefix(aiRow.itemLabel.trim(), aiPoz),
        model: cell.model ?? null,
        unitPrice: typeof cell.unitPrice === 'number' ? cell.unitPrice : null,
        totalPrice: typeof cell.totalPrice === 'number' ? cell.totalPrice : null,
        currency: offer ? resolveCellCurrency((cell as { currency?: string | null }).currency, offer) : null,
      }

      const row = aiPoz
        ? ensurePozRow(aiPoz, aiRow.quantity ?? null, aiRow.unit ?? null)
        : ensureNameRowForOffer(aiRow.itemLabel.trim(), aiRow.quantity ?? null, aiRow.unit ?? null, offerId)
      pushCell(row, next, pozKey || modelKey)
    }
  }

  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const pa = a.row.pozNo ? normalizePozKey(a.row.pozNo) : null
    const pb = b.row.pozNo ? normalizePozKey(b.row.pozNo) : null
    if (pa && pb) {
      const cmp = comparePozKeys(pa, pb)
      return cmp !== 0 ? cmp : a.index - b.index
    }
    if (pa) return -1
    if (pb) return 1
    return a.index - b.index
  })
  return indexed.map((entry) => entry.row)
}

function buildComparePrompt(
  materialName: string | null,
  offerCount: number,
  priorityCriteria: string | null,
  promptPayload: unknown,
  omitLineItemComparison: boolean
): string {
  const priorityBlock = priorityCriteria?.trim()
    ? `
KULLANICI ÖNCELİKLERİ (birincil kriterler):
"""
${priorityCriteria.trim()}
"""

Bu maddelere daha yüksek ağırlık ver; yine de bütüncül bak. Kararı tek maddeye kilitleme.
`
    : `
Kullanıcı özel bir öncelik belirtmedi. Tüm özellikleri dengeli karşılaştır.
`

  const lineItemRule = omitLineItemComparison
    ? `lineItemComparison kuralı: Kalem listesi çok uzun; Excel/tabloda PDF'ten çıkarılan TAM liste kullanılacak. lineItemComparison dizisini BOŞ bırak.`
    : `lineItemComparison kuralı: Tekliflerden biri veya birkaçı birden fazla kalem/ünite (line_items) içeriyorsa, tekliflerdeki AYNI FİZİKSEL kalemi (farklı adlandırılmış olsa bile: "ELV-1" ~ "AS-1" ~ "Asansör 1") tek satırda hizala. Sırayı, kapasiteyi, kullanım amacını ipucu olarak kullan. Hiçbir teklifte line_items yoksa bu diziyi boş bırak. ÇOK ÖNEMLİ: Her fiziksel kalem dizide TAM OLARAK BİR satırda yer almalı — o kalemi bir teklifin kendi orijinal adıyla (örn. teklif PDF'indeki ham isimle) AYRICA tekrar bir satır olarak EKLEME. Yani N farklı fiziksel kalem varsa dizide toplam N satır olmalı, N'den fazla OLAMAZ; her satırın values dizisinde o kalemi içeren TÜM tekliflerin hücreleri bulunmalı. Her hücrenin currency'sini de o kalemin (teklifteki line_items verisindeki) kendi para birimiyle doldur — aynı teklifte kalemden kaleme farklı olabileceğini unutma.`

  return `Sen deneyimli bir inşaat şirketinde satın alma direktörlüğü/CEO'luk yapmış, yüzlerce tedarikçi teklifini değerlendirmiş bir uzmansın. Aşağıda${materialName ? ` "${materialName}" malzemesi için` : ''} alınan ${offerCount} adet tedarikçi teklifi var.

compare_offers tool'unu kullan. ALAN SIRASI ÖNEMLİ:
1. Önce recommendedOfferId yaz — teklifin offerId UUID'sini birebir kopyala.
2. Sonra summary yaz — 2-3 cümle, ilk cümlede displayName ile hangi teklifi önerdiğini söyle.
3. Sonra kısa reasoning yaz.
4. Sonra executiveAnalysis'i doldur — bir CEO/satın alma direktörü gözüyle, şemadaki 5 başlıkla (Mali Etki, Teslimat ve Operasyonel Risk, Teknik ve Kapsam Uygunluğu, Tedarikçi Güvenilirliği, Sonuç ve Karar), somut rakam ve farklara atıfla derinlemesine değerlendirme.
5. Sonra comparisonRows (teknik özellik) tablosunu doldur.
6. En son lineItemComparison: ${omitLineItemComparison ? 'BOŞ bırak.' : 'herhangi bir teklifte line_items doluysa doldur.'}

comparisonRows kuralı: Bir teklif PDF'inde geçen her TEKNİK özellik/şart tabloya yazılır. Diğer tekliflerde yoksa o hücre "Belirtilmemiş" olur. Ortak olmayan maddeleri görmezden gelme; silme veya atlama. specs listesindeki her madde satır olsun. Ödeme koşulları, teslimat süresi, garanti, nakliye/montaj, KDV, teklif tarihi için satır ekleme.

${lineItemRule}

${priorityBlock}
Teklif verileri (JSON):
${JSON.stringify(promptPayload, null, 2)}`
}

async function pickRecommendation(
  anthropic: Anthropic,
  model: string,
  materialName: string | null,
  offers: CompareInput[],
  comparisonRows: QuoteComparisonTableRow[],
  priorityCriteria: string | null
): Promise<Pick<CompareResult, 'recommendedOfferId' | 'summary' | 'reasoning' | 'priorityConsideration' | 'prosCons' | 'executiveAnalysis'>> {
  const compact = offers.map((o) => ({
    offerId: o.offerId,
    displayName: o.displayName,
    fileName: o.fileName,
    total_price: o.extracted.total_price,
    currency: o.extracted.currency,
    delivery_time: o.extracted.delivery_time,
    warranty: o.extracted.warranty,
  }))

  const message = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    tools: [RECOMMEND_OFFER_TOOL],
    tool_choice: { type: 'tool', name: RECOMMEND_OFFER_TOOL.name },
    messages: [
      {
        role: 'user',
        content: `Sen deneyimli bir inşaat şirketinde satın alma direktörlüğü/CEO'luk yapmış bir uzmansın. Aşağıda${materialName ? ` "${materialName}" için` : ''} teklif listesi ve karşılaştırma tablosu var.
recommend_offer tool'u ile en uygun teklifi seç.
recommendedOfferId alanına offerId UUID'sini birebir yaz.
summary'nin ilk cümlesinde displayName ile önerilen teklifi açıkça belirt.
executiveAnalysis'i şemadaki 5 başlıkla (Mali Etki, Teslimat ve Operasyonel Risk, Teknik ve Kapsam Uygunluğu, Tedarikçi Güvenilirliği, Sonuç ve Karar) somut rakamlara atıfla doldur.
${priorityCriteria?.trim() ? `\nKullanıcı öncelikleri:\n${priorityCriteria.trim()}\n` : ''}
Teklifler:
${JSON.stringify(compact, null, 2)}

Tablo:
${JSON.stringify(comparisonRows.slice(0, 20), null, 2)}`,
      },
    ],
  })

  return getToolInput(message, RECOMMEND_OFFER_TOOL.name)
}

async function compareOffers(
  anthropic: Anthropic,
  model: string,
  materialName: string | null,
  offers: CompareInput[],
  priorityCriteria: string | null
): Promise<CompareResult> {
  const totalLineItems = offers.reduce((n, o) => n + (o.extracted.line_items?.length || 0), 0)
  const omitLineItemComparison = totalLineItems > 20

  const promptPayload = offers.map((o) => {
    const { line_items, ...rest } = o.extracted
    if (omitLineItemComparison) {
      return {
        offerId: o.offerId,
        displayName: o.displayName,
        fileName: o.fileName,
        ...rest,
        line_item_count: line_items?.length || 0,
        line_items_omitted: true,
      }
    }
    return {
      offerId: o.offerId,
      displayName: o.displayName,
      fileName: o.fileName,
      ...o.extracted,
    }
  })

  // Not: .stream(...).finalMessage() kullanıyoruz (create() değil) — bkz. extractOfferData
  // içindeki aynı notu; büyük max_tokens (örn. 32000) için Anthropic SDK non-streaming
  // isteği "10 dakikadan uzun sürebilir" diyerek reddediyor, streaming bu hatayı ortadan kaldırır.
  async function attempt(maxTokens: number): Promise<Anthropic.Message> {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      tools: [COMPARE_OFFERS_TOOL],
      tool_choice: { type: 'tool', name: COMPARE_OFFERS_TOOL.name },
      messages: [
        {
          role: 'user',
          content: buildComparePrompt(materialName, offers.length, priorityCriteria, promptPayload, omitLineItemComparison),
        },
      ],
    })
    return stream.finalMessage()
  }

  let message = await attempt(16000)
  // Çok kalemli tekliflerde (örn. 50-100+ kalem) lineItemComparison çıktısı token sınırına
  // çarpabilir; bu durumda kalemler yarıda kesilmesin diye çok daha büyük bütçeyle tekrar dene.
  if (message.stop_reason === 'max_tokens') {
    console.warn('[compareOffers] max_tokens sınırına ulaşıldı (16000), 32000 ile tekrar deneniyor.')
    message = await attempt(32000)
  }

  const first = getToolInput<CompareResult>(message, COMPARE_OFFERS_TOOL.name)
  let recommendedOfferId = resolveOfferId(offers, first.recommendedOfferId)
  let summary = first.summary?.trim() || ''
  let reasoning = first.reasoning?.trim() || ''
  let priorityConsideration = first.priorityConsideration
  let prosCons = first.prosCons || []
  let executiveAnalysis = normalizeExecutiveAnalysis(first.executiveAnalysis)

  const comparisonRows = mergeComparisonRows(first.comparisonRows, offers)
  const lineItemComparison = mergeLineItems(omitLineItemComparison ? [] : first.lineItemComparison, offers)

  if (!recommendedOfferId || !summary || executiveAnalysis.length === 0) {
    const fallback = await pickRecommendation(
      anthropic,
      model,
      materialName,
      offers,
      comparisonRows,
      priorityCriteria
    )
    recommendedOfferId = resolveOfferId(offers, fallback.recommendedOfferId) || recommendedOfferId
    summary = fallback.summary?.trim() || summary
    reasoning = fallback.reasoning?.trim() || reasoning
    priorityConsideration = fallback.priorityConsideration || priorityConsideration
    if (executiveAnalysis.length === 0) {
      executiveAnalysis = normalizeExecutiveAnalysis(fallback.executiveAnalysis)
    }
    if ((!prosCons || prosCons.length === 0) && fallback.prosCons) {
      prosCons = fallback.prosCons
    }
  }

  return {
    comparisonRows,
    lineItemComparison,
    recommendedOfferId: recommendedOfferId || '',
    summary,
    reasoning,
    notableDifferences: first.notableDifferences || [],
    executiveAnalysis,
    priorityConsideration,
    prosCons,
  }
}

/**
 * HTTP isteğinden bağımsız çalışır. Kullanıcı sekme/sayfa değiştirse bile
 * sonuç quote_comparisons tablosuna yazılır.
 */
export async function runQuoteComparisonAnalysis(supabase: JobClient, comparisonId: string): Promise<void> {
  try {
    const anthropic = getAnthropicClient()
    if (!anthropic) {
      throw new Error('ANTHROPIC_API_KEY tanımlı değil. Lütfen ortam değişkenlerini kontrol edin.')
    }
    const model = getAnthropicModel()
    // PDF çıkarımı teklif sayısıyla doğrusal ölçeklendiğinden (her teklif = 1 çağrı),
    // maliyeti düşürmek için burada daha ucuz/hızlı bir model kullanılır. Tek seferlik
    // ve kritik muhakeme gerektiren karşılaştırma/öneri adımında güçlü model korunur.
    const extractionModel = getAnthropicExtractionModel()

    const { data: comparison, error: comparisonError } = await supabase
      .from('quote_comparisons')
      .select('*')
      .eq('id', comparisonId)
      .single()

    if (comparisonError || !comparison) {
      throw new Error('Karşılaştırma bulunamadı.')
    }

    const { data: offers, error: offersError } = await supabase
      .from('quote_comparison_offers')
      .select('*')
      .eq('comparison_id', comparisonId)
      .order('sort_order', { ascending: true })

    if (offersError || !offers || offers.length === 0) {
      throw new Error('Karşılaştırmaya ait yüklenmiş teklif bulunamadı.')
    }

    await setAnalysisProgress(supabase, comparisonId, 8, `${offers.length} teklif hazırlanıyor`)

    let extractedCount = 0
    const markOfferDone = async (fileName: string) => {
      extractedCount += 1
      const snapshot = extractedCount
      const percent = 12 + Math.round((snapshot / offers.length) * 58)
      await setAnalysisProgress(
        supabase,
        comparisonId,
        percent,
        `Teklif okundu (${snapshot}/${offers.length}): ${fileName}`
      )
    }

    const extractedOffers: CompareInput[] = await mapPool(offers, 2, async (offer) => {
        const displayName = (offer.supplier_name || offer.file_name || '').trim() || offer.file_name

        if (hasUsableExtractedData(offer.extracted_data) && !extractedDataLooksIncomplete(offer.extracted_data)) {
          await markOfferDone(offer.file_name)
          return {
            offerId: offer.id,
            fileName: offer.file_name,
            displayName,
            extracted: offer.extracted_data,
          }
        }

        const { base64, buffer } = await fetchOfferFileAsBase64(supabase, offer.file_path)
        const pageCount = await getPdfPageCount(buffer)
        const documentContent = await extractQuoteDocumentContent(buffer)
        const tableRows = documentContent.tables.reduce((sum, table) => sum + Math.max(0, table.rows.length - 1), 0)
        const denseQuote = tableRows >= 20 || (documentContent.text?.split('\n').length || 0) > 40
        // Çok sayfalı veya yoğun kalemli belgelerde ucuz model satır atlıyor; güçlü modele geç.
        const modelForOffer = (pageCount != null && pageCount > 2) || denseQuote ? model : extractionModel
        const extracted = await extractOfferData(
          anthropic,
          modelForOffer,
          extractionModel,
          model,
          base64,
          pageCount,
          buffer,
          documentContent
        )

        await supabase
          .from('quote_comparison_offers')
          .update({
            extracted_data: extracted,
            supplier_name: offer.supplier_name || extracted.supplier_name || null,
            total_price: extracted.total_price ?? null,
            currency: extracted.currency ?? null,
            raw_text: documentContent.text,
          })
          .eq('id', offer.id)

        await markOfferDone(offer.file_name)
        return { offerId: offer.id, fileName: offer.file_name, displayName, extracted }
      })

    const priorityCriteria =
      typeof comparison.priority_criteria === 'string' && comparison.priority_criteria.trim()
        ? comparison.priority_criteria.trim()
        : null

    await setAnalysisProgress(supabase, comparisonId, 78, 'Teklifler karşılaştırılıyor')

    const compareResult = await compareOffers(
      anthropic,
      model,
      comparison.material_name,
      extractedOffers,
      priorityCriteria
    )

    const recommendedOfferId = resolveOfferId(extractedOffers, compareResult.recommendedOfferId)

    await setAnalysisProgress(supabase, comparisonId, 94, 'Sonuçlar kaydediliyor')

    await supabase
      .from('quote_comparisons')
      .update({
        status: 'completed',
        error_message: null,
        analysis_progress: 100,
        analysis_step: 'Tamamlandı',
        comparison_table: compareResult.comparisonRows,
        line_item_comparison: compareResult.lineItemComparison,
        ai_recommendation: {
          recommendedOfferId,
          summary: compareResult.summary || null,
          reasoning: compareResult.reasoning || null,
          notableDifferences: compareResult.notableDifferences || [],
          executiveAnalysis: compareResult.executiveAnalysis || [],
          priorityCriteria,
          priorityConsideration: compareResult.priorityConsideration || null,
          prosCons: compareResult.prosCons || [],
        },
        recommended_offer_id: recommendedOfferId,
      })
      .eq('id', comparisonId)
  } catch (error: any) {
    const userMessage = toUserFacingAiErrorMessage(error, 'quote-comparison/analyze')
    await supabase
      .from('quote_comparisons')
      .update({ status: 'failed', error_message: userMessage })
      .eq('id', comparisonId)
  }
}
