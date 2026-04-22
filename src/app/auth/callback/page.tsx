'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getRedirectPath } from '@/lib/auth'

export default function AuthCallback() {
  const supabase = createClient()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        if (error) {
          window.location.href = `/auth/login?error=${error}`
          return
        }

        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
          await new Promise(r => setTimeout(r, 500))
        }

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          window.location.href = '/auth/login?error=no_session'
          return
        }

        const role = await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name || session.user.user_metadata?.name
        )

        window.location.href = getRedirectPath(role)
      } catch (err) {
        console.error('Callback error:', err)
        window.location.href = '/auth/login?error=callback_failed'
      }
    }

    process()
  }, [supabase])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loading size="lg" text="Giriş yapılıyor..." />
    </div>
  )
}
