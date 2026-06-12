import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ProfileRow } from '../lib/purchaseRequestsQuery'

type AuthState = {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: (forceUserId?: string) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, site_id, department, full_name, email, construction_site_id, deleted_at, is_active, organization_id, company_name')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as ProfileRow
}

function profileIsDeactivated(p: ProfileRow | null): boolean {
  if (!p) return false
  return Boolean(p.deleted_at) || p.is_active === false
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (forceUserId?: string) => {
    console.log('🔄 refreshProfile çağrıldı')
    // forceUserId verilmişse onu kullan, yoksa session'dan al
    const uid = forceUserId || session?.user?.id
    console.log('👤 User ID:', uid)
    if (!uid) {
      console.log('⚠️ User ID yok, profile set edilemedi')
      setProfile(null)
      return
    }
    console.log('📡 Profile yükleniyor...')
    const p = await loadProfile(uid)
    console.log('📦 Profile yüklendi:', p ? 'Başarılı' : 'Başarısız')
    if (profileIsDeactivated(p)) {
      await supabase.auth.signOut()
      setProfile(null)
      return
    }
    console.log('✅ Profile state güncelleniyor:', p?.full_name || p?.email)
    setProfile(p)
  }, [session?.user?.id])

  useEffect(() => {
    let mounted = true
    
    // Timeout - 10 saniye sonra loading'i kapat (network sorunlarında takılmayı önle)
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⏱️ Auth session timeout - loading kapatılıyor')
        setLoading(false)
      }
    }, 10_000)
    
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return
        console.log('✅ Session alındı:', s?.user?.id ?? 'yok')
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
      })
      .catch((error) => {
        // Network hatası, timeout vs. durumlarında loading'i kapat
        console.error('❌ getSession hatası:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      })
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('🔐 Auth state changed:', event, s?.user?.id)
      setSession(s)
      setUser(s?.user ?? null)
    })
    
    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    console.log('🔁 User değişti:', user?.id)
    if (!user?.id) {
      console.log('⚠️ User yok, profile temizleniyor')
      setProfile(null)
      return
    }
    console.log('📡 Profile yükleniyor (useEffect)...')
    loadProfile(user.id)
      .then((p) => {
        if (profileIsDeactivated(p)) {
          console.log('❌ Profile deactivated')
          void supabase.auth.signOut()
          setProfile(null)
          return
        }
        console.log('✅ Profile set edildi (useEffect):', p?.full_name || p?.email)
        setProfile(p)
      })
      .catch((error) => {
        console.error('❌ Profile yükleme hatası:', error)
        // Hata olsa bile null set et - uygulama takılmasın
        setProfile(null)
      })
  }, [user?.id])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading, signIn, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return ctx
}
