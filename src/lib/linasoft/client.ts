import 'server-only'

/**
 * Linasoft DisServis API istemcisi (yalnızca sunucu tarafı, salt okuma).
 * Kimlik bilgileri env'den okunur; tarayıcıya asla gönderilmez.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000

let cachedToken: { value: string; expiresAt: number } | null = null

export class LinasoftNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LinasoftNotConfiguredError'
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new LinasoftNotConfiguredError(`${name} tanımlı değil`)
  return value
}

function baseUrl(): string {
  return requiredEnv('LINASOFT_BASE_URL').replace(/\/+$/, '')
}

function extractToken(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  for (const key of ['token', 'Token', 'accessToken', 'access_token']) {
    if (typeof obj[key] === 'string') return obj[key] as string
  }
  // Yanıt { data: { token } } gibi sarılmış olabilir.
  for (const key of ['data', 'Data', 'sonuc', 'Sonuc']) {
    const nested = extractToken(obj[key])
    if (nested) return nested
  }
  return null
}

async function login(): Promise<string> {
  const res = await fetch(`${baseUrl()}/LinaDisServisApi/Menu/Giris`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      LisansKodu: requiredEnv('LINASOFT_LISANS_KODU'),
      ApiKullanici: requiredEnv('LINASOFT_API_KULLANICI'),
      ApiSifre: requiredEnv('LINASOFT_API_SIFRE'),
    },
    body: '{}',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Linasoft giriş başarısız (${res.status})`)

  const text = await res.text()
  let payload: unknown = text
  try {
    payload = JSON.parse(text)
  } catch {
    // Düz metin token dönebilir.
  }
  const token = extractToken(payload)
  if (!token) throw new Error('Linasoft giriş yanıtında token bulunamadı')
  return token.replace(/^Bearer\s+/i, '')
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value
  const value = await login()
  cachedToken = { value, expiresAt: Date.now() + TOKEN_TTL_MS }
  return value
}

/** Linasoft'a Bearer token ile POST atar; 401'de bir kez yeniden giriş yapar. */
export async function linasoftPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = `${baseUrl()}/${path.replace(/^\/+/, '')}`

  const call = async (token: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

  let res = await call(await getToken())
  if (res.status === 401) res = await call(await getToken(true))
  if (!res.ok) throw new Error(`Linasoft isteği başarısız (${res.status}) ${path}`)
  return (await res.json()) as T
}
