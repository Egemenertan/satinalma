import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  // Server-side authentication kontrolü
  const supabase = createClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (user && !error) {
      // Dashboard'a yönlendir - Layout role kontrolü yapıp gerekirse yönlendirir
      redirect('/dashboard')
    } else {
      // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
      redirect('/auth/login')
    }
  } catch (error) {
    const digest =
      typeof error === 'object' && error !== null && 'digest' in error
        ? String((error as { digest?: unknown }).digest ?? '')
        : ''
    if (digest.startsWith('NEXT_REDIRECT')) throw error

    console.error('Error checking auth:', error)
    redirect('/auth/login')
  }

  // Bu sayfa hiçbir zaman görünmeyecek çünkü server-side redirect yapılıyor
  // Ama TypeScript için null döndürüyoruz
  return null
}
