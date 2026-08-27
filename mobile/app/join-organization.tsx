import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useAuth } from '../src/providers/AuthProvider'

export default function JoinOrganizationScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { refreshProfile, user } = useAuth()

  async function onLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function onRefresh() {
    if (user?.id) {
      await refreshProfile(user.id)
      router.replace('/(app)/requests')
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
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

        {/* İkon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={48} color="#f59e0b" />
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.h1}>{t('organization.pendingTitle')}</Text>
          <Text style={styles.lead}>{t('organization.pendingSubtitleSimple')}</Text>
        </View>

        {/* Bilgi kartı */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <Text style={styles.infoText}>{t('organization.pendingInfoSimple')}</Text>
        </View>

        {/* Yenile butonu */}
        <Pressable style={styles.btnPrimary} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.btnPrimaryText}>{t('organization.checkStatus')}</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>{t('organization.differentAccount')}</Text>
        </Pressable>

        {/* Bottom padding for safe area */}
        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
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
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 48,
  },

  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
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

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },

  btnPrimary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
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

  logoutBtn: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  logoutBtnText: {
    fontSize: 15,
    color: '#ef4444',
  },
})
