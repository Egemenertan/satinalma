import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string }

function resolveSupabaseConfig(): { url: string; anonKey: string } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra
  const url =
    (typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : '') ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  const anonKey =
    (typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : '') ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  return { url: url.trim(), anonKey: anonKey.trim() }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase yapılandırılmadı. mobile/.env içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY (veya EXPO_PUBLIC_* ile aynı değerler) olmalı. Kaydettikten sonra: npx expo start -c'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
