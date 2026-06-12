import { useState } from 'react'
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
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'

export default function RegisterScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    if (!fullName.trim()) {
      Alert.alert(t('auth.missingFields'), t('auth.fullNameRequired'))
      return
    }
    if (!email.trim() || !password) {
      Alert.alert(t('auth.missingFields'), t('auth.missingFieldsBody'))
      return
    }
    if (!companyName.trim()) {
      Alert.alert(t('auth.missingFields'), t('auth.companyNameRequired'))
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          company_name: companyName.trim(),
        },
      },
    })

    setSubmitting(false)

    if (error) {
      Alert.alert(t('auth.registerFail'), error.message)
      return
    }

    if (data.user) {
      Alert.alert(t('auth.registerSuccess'), t('auth.registerSuccessBody'), [
        {
          text: t('common.ok'),
          onPress: () => router.replace('/login'),
        },
      ])
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/dld.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={t('auth.logoA11y')}
            />
          </View>

          <View style={styles.hero}>
            <Text style={styles.h1}>{t('auth.registerTitle')}</Text>
            <Text style={styles.lead}>{t('auth.registerSubtitle')}</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('auth.fullName')}
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
            editable={!submitting}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPh')}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPh')}
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.companyName')}
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            value={companyName}
            onChangeText={setCompanyName}
            editable={!submitting}
          />

          <Pressable
            style={[styles.btnPrimary, submitting && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>{t('auth.registerButton')}</Text>
            )}
          </Pressable>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('auth.alreadyHaveAccount')}</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>{t('auth.login')}</Text>
            </Pressable>
          </View>

          {/* Bottom padding for safe area */}
          <View style={{ height: insets.bottom + 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 180,
    height: 62,
  },

  hero: {
    marginBottom: 24,
    alignItems: 'center',
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  lead: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },

  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnDisabled: { opacity: 0.65 },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  loginText: {
    fontSize: 15,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
})
