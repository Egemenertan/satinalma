import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ensureProfile } from '../src/lib/ensureProfile'
import { supabase } from '../src/lib/supabase'
import { useAuth } from '../src/providers/AuthProvider'

WebBrowser.maybeCompleteAuthSession()

const msLogoStyles = StyleSheet.create({
  wrap: { width: 22, height: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tile: { width: 9, height: 9, borderRadius: 1 },
  c1: { backgroundColor: '#F25022' },
  c2: { backgroundColor: '#7FBA00' },
  c3: { backgroundColor: '#00A4EF' },
  c4: { backgroundColor: '#FFB900' },
})

function MicrosoftLogo() {
  return (
    <View style={msLogoStyles.wrap}>
      <View style={[msLogoStyles.tile, msLogoStyles.c1]} />
      <View style={[msLogoStyles.tile, msLogoStyles.c2]} />
      <View style={[msLogoStyles.tile, msLogoStyles.c3]} />
      <View style={[msLogoStyles.tile, msLogoStyles.c4]} />
    </View>
  )
}

function parseOAuthCallbackUrl(url: string): { 
  code: string | null
  error: string | null
  errorDescription: string | null
  accessToken: string | null
  refreshToken: string | null
} {
  try {
    const u = new URL(url)
    
    // Query params'tan al (?code=xxx gibi)
    let code = u.searchParams.get('code')
    let error = u.searchParams.get('error')
    let errorDescription = u.searchParams.get('error_description')
    
    // Fragment'tan da al (#access_token=xxx gibi)
    let accessToken: string | null = null
    let refreshToken: string | null = null
    
    if (u.hash) {
      // Fragment (#) kısmını parse et
      const fragmentParams = new URLSearchParams(u.hash.substring(1))
      accessToken = fragmentParams.get('access_token')
      refreshToken = fragmentParams.get('refresh_token')
      
      // Fragment'ta error varsa onu da al
      if (!error) {
        error = fragmentParams.get('error')
        errorDescription = fragmentParams.get('error_description')
      }
    }
    
    return {
      code,
      error,
      errorDescription,
      accessToken,
      refreshToken,
    }
  } catch {
    return { 
      code: null, 
      error: 'invalid_url', 
      errorDescription: null,
      accessToken: null,
      refreshToken: null,
    }
  }
}

export default function LoginScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { signIn, session, refreshProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)

  useEffect(() => {
    // Session varsa ve login işlemi devam etmiyorsa yönlendir
    // Login işlemi sırasında yönlendirme yapma (race condition'u önle)
    if (session && !submitting && !microsoftLoading) {
      router.replace('/(app)/requests')
    }
  }, [session, submitting, microsoftLoading, router])

  const signInWithMicrosoft = useCallback(async () => {
    setMicrosoftLoading(true)
    try {
      // Production için custom scheme, development build için de aynı
      const redirectTo = 'com.dlx://auth/callback'
      
      console.log('🔐 Microsoft OAuth başlatılıyor...')
      console.log('Redirect URI:', redirectTo)
      console.log('Platform:', Platform.OS)
      console.log('DEV mode:', __DEV__)
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: 'email openid profile',
          queryParams: { 
            prompt: 'select_account',
          },
        },
      })
      
      console.log('OAuth URL:', data?.url)

      if (oauthError) {
        console.error('❌ OAuth URL alma hatası:', oauthError)
        Alert.alert(t('auth.oauthTitle'), oauthError.message)
        return
      }

      if (!data?.url) {
        console.error('❌ OAuth URL boş')
        Alert.alert(t('auth.oauthTitle'), t('auth.oauthConnectFail'))
        return
      }

      console.log('🌐 WebBrowser açılıyor...')
      // WebBrowser ile OAuth sayfasını aç
      // Not: Expo Go'da bu çalışmaz, development build gerekir
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      console.log('📱 WebBrowser sonucu:', JSON.stringify(result, null, 2))

      if (result.type !== 'success' || !result.url) {
        // Kullanıcı iptal etti veya hata oluştu
        console.warn('⚠️ WebBrowser başarısız:', result.type)
        if (result.type === 'cancel') {
          Alert.alert(
            t('auth.oauthTitle'),
            'Giriş iptal edildi. Not: iOS Expo Go\'da OAuth çalışmaz, development build gerekir (npx expo run:ios)'
          )
        }
        return
      }

      console.log('✅ Callback URL alındı:', result.url)
      // Callback URL'den code veya token'ları al
      const { code, error: errCode, errorDescription, accessToken, refreshToken } = parseOAuthCallbackUrl(result.url)
      console.log('📝 Parse sonucu:', { 
        hasCode: !!code,
        hasAccessToken: !!accessToken,
        error: errCode, 
        errorDescription 
      })
      
      if (errCode) {
        Alert.alert(t('auth.oauthTitle'), errorDescription?.replace(/\+/g, ' ') || errCode)
        return
      }

      // İki flow tipi var:
      // 1. PKCE Flow: code ile gelir, exchange gerekir
      // 2. Implicit Flow: accessToken direkt gelir, session set edilir
      
      if (code) {
        // PKCE Flow - code'u session ile değiştir
        console.log('🔄 PKCE flow: Code exchange ediliyor...')
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          Alert.alert(t('auth.oauthTitle'), exchangeError.message)
          return
        }
      } else if (accessToken && refreshToken) {
        // Implicit Flow - token'ları direkt set et
        console.log('🔄 Implicit flow: Session set ediliyor...')
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          Alert.alert(t('auth.oauthTitle'), sessionError.message)
          return
        }
      } else {
        Alert.alert(t('auth.oauthTitle'), t('auth.oauthNoCode'))
        return
      }

      const {
        data: { session: newSession },
      } = await supabase.auth.getSession()
      const user = newSession?.user
      if (!user) {
        Alert.alert(t('auth.oauthTitle'), t('auth.oauthNoSession'))
        return
      }

      console.log('👤 Profile kontrol ediliyor...')
      const ensured = await ensureProfile(
        supabase,
        user.id,
        user.email,
        user.user_metadata?.full_name || user.user_metadata?.name
      )
      if (ensured === 'deactivated') {
        await supabase.auth.signOut()
        Alert.alert(t('auth.accountDisabled'), t('auth.accountDisabledBody'))
        return
      }
      
      console.log('🔄 Profile yükleniyor...')
      console.log('📊 User ID:', user.id)
      
      // refreshProfile'ı doğrudan user.id ile çağır (session?.user?.id henüz güncellenmemiş olabilir)
      await refreshProfile(user.id)
      
      console.log('✅ Login başarılı! Dashboard\'a yönleniyor...')
      router.replace('/(app)/requests')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.unknownError')
      Alert.alert(t('auth.oauthTitle'), message)
    } finally {
      setMicrosoftLoading(false)
    }
  }, [refreshProfile, router, t])

  async function onSubmit() {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.missingFields'), t('auth.missingFieldsBody'))
      return
    }
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      Alert.alert(t('auth.loginFail'), error)
      return
    }
    const {
      data: { session: s },
    } = await supabase.auth.getSession()
    const u = s?.user
    if (u) {
      const ensured = await ensureProfile(supabase, u.id, u.email, u.user_metadata?.full_name || u.user_metadata?.name)
      if (ensured === 'deactivated') {
        await supabase.auth.signOut()
        Alert.alert(t('auth.accountDisabled'), t('auth.accountDisabledBody'))
        return
      }
      await refreshProfile()
    }
    router.replace('/(app)/requests')
  }

  const busy = submitting || microsoftLoading

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <Image
              source={require('../assets/dld.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={t('auth.logoA11y')}
            />
          </View>

          <View style={styles.hero}>
            <Text style={styles.h1}>{t('auth.welcome')}</Text>
            <Text style={styles.lead}>{t('auth.subtitle')}</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPh')}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPh')}
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          <Pressable
            style={[styles.btnPrimary, busy && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>{t('auth.loginEmail')}</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t('auth.or')}</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable
            style={[styles.btnMicrosoft, busy && styles.btnDisabled]}
            onPress={signInWithMicrosoft}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('auth.msA11y')}
          >
            {microsoftLoading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <>
                <MicrosoftLogo />
                <Text style={styles.btnMicrosoftText}>{t('auth.loginMicrosoft')}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#ffffff',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 140,
    height: 48,
    maxWidth: '60%',
  },
  hero: { marginBottom: 28, alignItems: 'center' },
  h1: { fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5, textAlign: 'center' },
  lead: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: '#111827',
  },
  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.65 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: '#e5e7eb' },
  orText: { fontSize: 11, fontWeight: '600', color: '#9ca3af', letterSpacing: 0.8 },
  btnMicrosoft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  btnMicrosoftText: { fontSize: 16, fontWeight: '600', color: '#111827' },
})
