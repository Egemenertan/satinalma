import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/**
 * AI (Anthropic) client - lazy initialization.
 * getOpenAIClient() deseninin Anthropic karşılığı (bkz. src/app/api/ai-chat/route.ts).
 */

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5'

/**
 * Maliyet-etkin model, PDF metin/veri çıkarımı gibi tekrarlayan (teklif başına bir kez
 * çağrılan, dolayısıyla teklif sayısıyla doğrusal ölçeklenen) mekanik görevler için.
 * Karşılaştırma/öneri gibi tek seferlik ama kritik muhakeme gerektiren adımlarda
 * DEFAULT_ANTHROPIC_MODEL (daha güçlü model) kullanılmaya devam eder; böylece kaliteden
 * ödün vermeden toplam token maliyeti düşürülür.
 */
export const DEFAULT_ANTHROPIC_EXTRACTION_MODEL = 'claude-haiku-4-5'

let anthropicClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic | null {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

/** Karşılaştırma ve öneri (recommend) çağrıları için - daha güçlü muhakeme, teklif sayısından bağımsız tek çağrı. */
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
}

/** Teklif PDF'lerinden yapılandırılmış veri çıkarımı için - teklif başına bir kez çağrılır, ucuz/hızlı model yeterlidir. */
export function getAnthropicExtractionModel(): string {
  return process.env.ANTHROPIC_EXTRACTION_MODEL?.trim() || DEFAULT_ANTHROPIC_EXTRACTION_MODEL
}
