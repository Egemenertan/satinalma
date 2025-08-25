import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxzmxfwpgsqabtamnfql.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4em14ZndwZ3NxYWJ0YW1uZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDcwMTYsImV4cCI6MjA3MTUyMzAxNn0.EJNLyurCnaA5HY8MgyoLs9RiZvzrGk7eclnYLq56rCE'
  )
}



