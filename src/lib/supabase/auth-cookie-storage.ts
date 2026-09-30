import {
  createChunks,
  DEFAULT_COOKIE_OPTIONS,
  parse,
  serialize,
  type CookieOptions,
} from '@supabase/ssr'

/**
 * Supabase oturum çerezi, 3180 karakteri aşınca `key.0`, `key.1` diye bölünür.
 * @supabase/ssr 0.1 yenilemede yeni parçaları yazar ama eskisini silmez.
 * Okuyucu önce bölünmemiş `key` çerezini aldığı için, token yenilendikten
 * sonra tarayıcı eski (iptal edilmiş) refresh token'ı kullanır ve kullanıcı
 * yaklaşık bir saat sonra yeniden girişe düşer.
 *
 * Parça biçimi kütüphane ile aynı kalır; middleware hâlâ aynı isimleri okur.
 */

const MAX_CHUNKS = 8

export type AuthCookieStore = {
  get(name: string): string | null | undefined | Promise<string | null | undefined>
  set(name: string, value: string, options: CookieOptions): void | Promise<void>
  remove(name: string, options: CookieOptions): void | Promise<void>
}

function present(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return value
}

function writeOptions(cookieOptions?: CookieOptions): CookieOptions {
  return {
    ...DEFAULT_COOKIE_OPTIONS,
    ...cookieOptions,
    maxAge: DEFAULT_COOKIE_OPTIONS.maxAge,
  }
}

export function staleAuthCookieNames(storageKey: string, nextChunkNames: ReadonlySet<string>): string[] {
  const stale: string[] = []
  if (!nextChunkNames.has(storageKey)) stale.push(storageKey)
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const name = `${storageKey}.${index}`
    if (!nextChunkNames.has(name)) stale.push(name)
  }
  return stale
}

export function createAuthCookieStorage(
  store: AuthCookieStore,
  cookieOptions: CookieOptions | undefined,
  isServer: boolean
) {
  const options = writeOptions(cookieOptions)
  const clearOptions: CookieOptions = { ...options, maxAge: 0 }

  async function read(name: string): Promise<string | null> {
    return present(await store.get(name))
  }

  return {
    isServer,
    getItem: async (key: string) => {
      const direct = await read(key)
      if (direct) return direct

      const parts: string[] = []
      for (let index = 0; index < MAX_CHUNKS; index += 1) {
        const chunk = await read(`${key}.${index}`)
        if (!chunk) break
        parts.push(chunk)
      }
      return parts.length > 0 ? parts.join('') : null
    },
    setItem: async (key: string, value: string) => {
      const chunks = createChunks(key, value)
      const nextNames = new Set(chunks.map((chunk) => chunk.name))

      for (const name of staleAuthCookieNames(key, nextNames)) {
        if (await read(name)) {
          await store.remove(name, clearOptions)
        }
      }

      for (const chunk of chunks) {
        await store.set(chunk.name, chunk.value, options)
      }
    },
    removeItem: async (key: string) => {
      if (await read(key)) {
        await store.remove(key, clearOptions)
      }
      for (let index = 0; index < MAX_CHUNKS; index += 1) {
        const name = `${key}.${index}`
        if (!(await read(name))) continue
        await store.remove(name, clearOptions)
      }
    },
  }
}

export function createBrowserCookieStore(): AuthCookieStore {
  return {
    get(name) {
      if (typeof document === 'undefined') return null
      return parse(document.cookie)[name] ?? null
    },
    set(name, value, options) {
      if (typeof document === 'undefined') return
      document.cookie = serialize(name, value, options)
    },
    remove(name, options) {
      if (typeof document === 'undefined') return
      document.cookie = serialize(name, '', { ...options, maxAge: 0 })
    },
  }
}
