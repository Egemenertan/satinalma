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
import { useAuth } from '../src/providers/AuthProvider'

export default function SetupOrganizationScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { user, profile, refreshProfile } = useAuth()

  const [orgName, setOrgName] = useState(profile?.company_name ?? '')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    if (!orgName.trim()) {
      Alert.alert(t('common.error'), t('organization.nameRequired'))
      return
    }

    if (!user?.id) {
      Alert.alert(t('common.error'), t('common.unknownError'))
      return
    }

    setSubmitting(true)

    try {
      // 1. Organizasyon oluştur
      const slug = orgName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          slug: `${slug}-${Date.now()}`,
          address: address.trim() || null,
          phone: phone.trim() || null,
          tax_number: taxNumber.trim() || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (orgError) {
        throw orgError
      }

      // 2. Kullanıcının profilini güncelle (sadece organization_id)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organization_id: org.id,
        })
        .eq('id', user.id)

      if (profileError) {
        console.warn('Profile update error:', profileError.message)
      }

      // 3. Profile'ı yenile ve state güncellemesini bekle
      try {
        await refreshProfile(user.id)
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (e) {
        console.warn('Profile refresh error:', e)
      }

      // 4. Ana sayfaya yönlendir (her durumda)
      router.replace('/(app)/requests')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('common.unknownError')
      Alert.alert(t('organization.createFailed'), message, [
        { text: t('common.ok'), onPress: () => router.replace('/(app)/requests') }
      ])
    } finally {
      setSubmitting(false)
    }
  }

  async function onLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
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
            <Text style={styles.h1}>{t('organization.setupTitle')}</Text>
            <Text style={styles.lead}>{t('organization.setupSubtitle')}</Text>
          </View>

          <Text style={styles.label}>{t('organization.name')} *</Text>
          <TextInput
            style={styles.input}
            placeholder={t('organization.namePlaceholder')}
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            value={orgName}
            onChangeText={setOrgName}
            editable={!submitting}
          />

          <Text style={styles.label}>{t('organization.address')}</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder={t('organization.addressPlaceholder')}
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            value={address}
            onChangeText={setAddress}
            editable={!submitting}
          />

          <Text style={styles.label}>{t('organization.phone')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('organization.phonePlaceholder')}
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!submitting}
          />

          <Text style={styles.label}>{t('organization.taxNumber')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('organization.taxNumberPlaceholder')}
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={taxNumber}
            onChangeText={setTaxNumber}
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
              <Text style={styles.btnPrimaryText}>{t('organization.createButton')}</Text>
            )}
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={onLogout} disabled={submitting}>
            <Text style={styles.logoutBtnText}>{t('organization.differentAccount')}</Text>
          </Pressable>

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
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 48,
  },

  hero: {
    marginBottom: 24,
    alignItems: 'center',
  },
  h1: {
    fontSize: 24,
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

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginLeft: 4,
  },

  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },

  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
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

  logoutBtn: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  logoutBtnText: {
    fontSize: 15,
    color: '#6b7280',
  },
})
