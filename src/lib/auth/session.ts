/**
 * İstemci Tarafı Oturum Kontrolü
 *
 * `getUser()` her çağrıldığında Supabase Auth sunucusuna network isteği yapar
 * ve token süresi dolmaya yakınken bir refresh tetikler. Aynı anda başka bir
 * bileşen (header, sidebar, middleware vb.) de oturumu yeniliyorsa refresh
 * token rotation nedeniyle bu istek geçici olarak başarısız olabilir.
 *
 * `getSession()` önce yereldeki (cookie) oturumu okur ve sadece gerçekten
 * süresi dolmuşsa yeniler — bu yüzden daha az network isteği yapar ve daha
 * az çakışma riski taşır. Buna ek olarak burada bir kerelik yeniden deneme
 * eklenerek geçici hatalarda kullanıcının oturumdan gereksiz yere atılması
 * önlenir.
 */

import type { Session, SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient<any, any, any>

/**
 * Geçerli oturumu döndürür. İlk deneme başarısız olursa (geçici hata,
 * eşzamanlı refresh çakışması vb.) oturumu bir kez daha kontrol eder.
 * Gerçekten oturum yoksa `null` döner.
 */
export async function getSessionUser(supabase: Supabase): Promise<Session['user'] | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user

  // Geçici bir hata olabilir - bir kez daha dene.
  const { data: { session: retrySession } } = await supabase.auth.getSession()
  return retrySession?.user ?? null
}
