/**
 * Hata Mesajı Yardımcıları
 *
 * Microsoft Teams SDK, Office.js, MSAL ve fetch hataları çok farklı
 * şekillerde gelir (Error instance, plain object, string, vs.). Bu helper
 * her durumda kullanıcıya gösterilebilir bir string üretir ve
 * [object Object] tarzı kötü mesajları engeller.
 */

const FALLBACK_MESSAGE = 'Beklenmeyen bir hata oluştu'

type UnknownError = unknown

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Bir hata değerinden okunabilir bir mesaj çıkarır.
 * Asla "[object Object]" döndürmez.
 */
export function getErrorMessage(error: UnknownError, fallback: string = FALLBACK_MESSAGE): string {
  if (!error) return fallback

  if (typeof error === 'string') {
    return error.trim() || fallback
  }

  if (error instanceof Error) {
    return error.message?.trim() || fallback
  }

  if (isPlainObject(error)) {
    // Yaygın hata payload alanları
    const candidates = [
      error.message,
      error.error_description,
      error.errorMessage,
      (isPlainObject(error.error) ? (error.error as Record<string, unknown>).message : error.error),
      error.reason,
      error.description,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    // Son çare: JSON encode et (ama "[object Object]" değil)
    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      /* ignore */
    }
  }

  return fallback
}

/**
 * Bir auth callback URL parametresini insan tarafından okunabilir
 * Türkçe bir mesaja çevirir.
 */
export function translateAuthError(code: string | null | undefined): string | null {
  if (!code) return null

  switch (code) {
    case 'no_session':
      return 'Giriş tamamlanamadı. Lütfen tekrar deneyin.'
    case 'no_code':
      return 'Microsoft yetkilendirme kodu alınamadı.'
    case 'callback_failed':
      return 'Giriş geri çağrısı işlenemedi. Lütfen tekrar deneyin.'
    case 'access_denied':
      return 'Microsoft girişi iptal edildi.'
    case 'popup_blocked':
      return 'Açılır pencere engellendi. Lütfen tarayıcı ayarlarınızdan açılır pencerelere izin verin.'
    case 'sdk_unavailable':
      return 'Microsoft entegrasyonu başlatılamadı. Lütfen sayfayı yenileyin.'
    default:
      return `Hata: ${code}`
  }
}
