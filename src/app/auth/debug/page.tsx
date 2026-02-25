'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthDebugPage() {
  const [info, setInfo] = useState<any>({})
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Session kontrol et
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // User kontrol et
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        // Profile kontrol et
        let profile = null
        let profileError = null
        
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          profile = data
          profileError = error
        }

        setInfo({
          url: window.location.href,
          hash: window.location.hash,
          session: session ? {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            expiresAt: session.expires_at
          } : null,
          sessionError,
          user: user ? {
            id: user.id,
            email: user.email,
            provider: user.app_metadata?.provider,
            metadata: user.user_metadata
          } : null,
          userError,
          profile,
          profileError
        })
      } catch (error) {
        console.error('Debug error:', error)
        setInfo({ error: String(error) })
      }
    }

    checkAuth()
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 Auth Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(info, null, 2)}
          </pre>
        </div>

        <div className="mt-4 space-x-4">
          <button
            onClick={() => window.location.href = '/auth/login'}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Login'e Git
          </button>
          
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.reload()
            }}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
