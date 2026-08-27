/**
 * AI Teklif Karşılaştırma - paylaşılan tipler
 */

export type QuoteComparisonStatus = 'draft' | 'analyzing' | 'completed' | 'failed'

export interface QuoteComparisonOfferSpec {
  name: string
  value: string
}

/**
 * Bir teklif PDF'i tek bir kalem yerine birden fazla farklı fiyatlı
 * kalem/ünite içeriyorsa (örn. aynı projede 5 farklı asansör), her biri
 * burada ayrı bir satır olarak tutulur.
 */
export interface QuoteComparisonLineItem {
  name: string
  quantity: string | null
  unit: string | null
  model: string | null
  unit_price: number | null
  total_price: number | null
}

export interface QuoteComparisonExtractedData {
  supplier_name: string | null
  supplier_contact_person: string | null
  supplier_phone: string | null
  supplier_email: string | null
  product_name: string | null
  quantity: string | null
  unit_price: number | null
  total_price: number | null
  currency: string | null
  quote_date: string | null
  delivery_time: string | null
  warranty: string | null
  payment_terms: string | null
  shipping_responsibility: string | null
  installation_responsibility: string | null
  vat_status: string | null
  specs: QuoteComparisonOfferSpec[]
  notes: string | null
  /** Teklif birden fazla farklı fiyatlı kalem içeriyorsa dolu olur, aksi halde boş dizi. */
  line_items: QuoteComparisonLineItem[]
}

export interface QuoteComparisonOffer {
  id: string
  comparison_id: string
  supplier_name: string | null
  file_name: string
  file_path: string
  file_size: number | null
  raw_text: string | null
  extracted_data: QuoteComparisonExtractedData | null
  total_price: number | null
  currency: string | null
  ai_score: number | null
  sort_order: number
  created_at: string
}

export interface QuoteComparisonTableRowValue {
  offerId: string
  value: string
}

export interface QuoteComparisonTableRow {
  feature: string
  values: QuoteComparisonTableRowValue[]
  /** Teklifler arasında anlamlı/belirgin fark varsa true */
  isDistinct?: boolean
}

/** Kalem bazlı fiyat karşılaştırma tablosunda bir teklifin tek bir satırdaki (kalemdeki) değeri. */
export interface QuoteComparisonLineItemOfferValue {
  offerId: string
  model: string | null
  unitPrice: number | null
  totalPrice: number | null
}

/** Tüm tekliflerde aynı kalemi (örn. "Asansör 1") temsil eden birleştirilmiş satır. */
export interface QuoteComparisonLineItemRow {
  itemLabel: string
  quantity: string | null
  unit: string | null
  values: QuoteComparisonLineItemOfferValue[]
}

export interface QuoteComparisonProsCons {
  offerId: string
  pros: string[]
  cons: string[]
}

export interface QuoteComparisonNotableDifference {
  feature: string
  detail: string
}

/** Yönetici (CEO) düzeyinde değerlendirmenin bir bölümü, örn. "Mali Etki", "Teslimat ve Risk". */
export interface QuoteComparisonExecutiveAnalysisSection {
  title: string
  detail: string
}

export interface QuoteComparisonRecommendation {
  recommendedOfferId: string | null
  summary: string
  reasoning: string
  prosCons: QuoteComparisonProsCons[]
  notableDifferences?: QuoteComparisonNotableDifference[]
  /** İnşaat şirketi CEO'su/satın alma direktörü bakış açısıyla, konu başlıklarına ayrılmış derinlemesine değerlendirme. */
  executiveAnalysis?: QuoteComparisonExecutiveAnalysisSection[]
  /** Bu öneriyi üretirken kullanılan kullanıcı öncelikleri */
  priorityCriteria?: string | null
  /** Önceliklerin karara nasıl yansıdığı; ödün varsa açıkça yazılır */
  priorityConsideration?: string | null
}

export interface QuoteComparison {
  id: string
  title: string
  /** Karşılaştırmanın ait olduğu proje/şantiye adı (opsiyonel). */
  project_name: string | null
  material_name: string | null
  status: QuoteComparisonStatus
  error_message: string | null
  comparison_table: QuoteComparisonTableRow[] | null
  /** Çoklu kalemli tekliflerde (örn. birden fazla ünite) kalem bazlı fiyat karşılaştırma matrisi. */
  line_item_comparison: QuoteComparisonLineItemRow[] | null
  ai_recommendation: QuoteComparisonRecommendation | null
  recommended_offer_id: string | null
  priority_criteria: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  analysis_progress: number
  analysis_step: string | null
}

export interface QuoteComparisonWithOffers extends QuoteComparison {
  quote_comparison_offers: QuoteComparisonOffer[]
}

export const QUOTE_COMPARISON_STORAGE_BUCKET = 'quote-comparisons'
