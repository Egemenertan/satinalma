import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '../supabase'
import { createAuthCookieStorage } from './auth-cookie-storage'

export function createClient() {
  const cookieStore = cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
    ...(isProd ? { secure: true as const } : {}),
  }
  const authCookies = {
    get(name: string) {
      return cookieStore.get(name)?.value
    },
    set(name: string, value: string, options: CookieOptions) {
      try {
        cookieStore.set(name, value, options)
      } catch {
        // The `set` method was called from a Server Component.
        // This can be ignored if you have middleware refreshing
        // user sessions.
      }
    },
    remove(name: string, options: CookieOptions) {
      try {
        cookieStore.set(name, '', { ...options, maxAge: 0 })
      } catch {
        // The `remove` method was called from a Server Component.
        // This can be ignored if you have middleware refreshing
        // user sessions.
      }
    },
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions,
      cookies: authCookies,
      auth: {
        flowType: 'pkce',
        storage: createAuthCookieStorage(authCookies, cookieOptions, true),
      },
    }
  )
}

// Service role client for bypassing RLS in server actions
export function createServiceRoleClient() {
  const client = tryCreateServiceRoleClient()
  if (!client) {
    throw new Error('Missing Supabase service role credentials')
  }
  return client
}

/** Service role yoksa null — çağıran oturum client'ına düşebilir */
export function tryCreateServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

