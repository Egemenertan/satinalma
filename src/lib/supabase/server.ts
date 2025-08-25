import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '../supabase'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxzmxfwpgsqabtamnfql.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4em14ZndwZ3NxYWJ0YW1uZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDcwMTYsImV4cCI6MjA3MTUyMzAxNn0.EJNLyurCnaA5HY8MgyoLs9RiZvzrGk7eclnYLq56rCE',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

