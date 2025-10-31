import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  // Server-side authentication kontrolü
  const supabase = createClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (user && !error) {
      // Kullanıcının rolünü al
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      // Rol bazlı yönlendirme
      if (profile?.role === 'site_manager' || profile?.role === 'site_personnel' || profile?.role === 'santiye_depo') {
        redirect('/dashboard/requests')
      } else {
        redirect('/dashboard')
      }
    } else {
      // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
      redirect('/auth/login')
    }
  } catch (error) {
    console.error('Error checking auth:', error)
    redirect('/auth/login')
  }

  // Bu sayfa hiçbir zaman görünmeyecek çünkü server-side redirect yapılıyor
  // Ama TypeScript için null döndürüyoruz
  return null
}
