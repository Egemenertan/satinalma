/**
 * AI sağlayıcılarından (Anthropic/OpenAI) gelen ham hata mesajları — kota/kredi
 * bitmesi, rate limit, token/context limiti, "overloaded" gibi teknik durumlar —
 * kullanıcıya ASLA doğrudan gösterilmez. Bu tür detaylar sadece sunucu
 * loglarına yazılır; kullanıcı arayüzünde her zaman aynı, nazik ve genel bir
 * mesaj gösterilir.
 *
 * Hem sunucu (route/job) hem de istemci (chatbot) tarafında kullanılabilir;
 * bu yüzden 'server-only' değildir ve gizli bilgi barındırmaz.
 */
export function toUserFacingAiErrorMessage(error: unknown, context: string): string {
  console.error(`[ai-error] ${context}:`, error)
  return 'Şu anda bu isteği tamamlayamadık. Lütfen birkaç dakika sonra tekrar deneyin.'
}
