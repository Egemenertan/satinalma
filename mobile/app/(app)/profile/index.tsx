import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { ComponentProps } from 'react'
import { useRouter } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET, islandTokens } from '../../../src/components/island/islandTokens'
import { useAppLocale } from '../../../src/i18n/useAppLocale'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats } from '../../../src/theme/statsDesignTokens'

function getInitials(name: string, localeTag: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0] ?? ''
    const b = parts[1][0] ?? ''
    return (a + b).toLocaleUpperCase(localeTag)
  }
  if (parts.length === 1) {
    const w = parts[0]
    if (w.length >= 2) return w.slice(0, 2).toLocaleUpperCase(localeTag)
    return w.slice(0, 1).toLocaleUpperCase(localeTag)
  }
  return '?'
}

export default function ProfileScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { setLocale } = useAppLocale()
  const localeTag = i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'
  const { profile, user, signOut } = useAuth()

  const label =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0]?.replace(/[._-]/g, ' ') ||
    t('common.user')
  const email = user?.email ?? profile?.email ?? t('common.dash')
  const roleLabel = profile?.role ? String(profile.role).replace(/_/g, ' ') : t('common.dash')
  const dept = profile?.department?.trim() || t('common.dash')

  const pickLanguage = () => {
    Alert.alert(t('profile.languageTitle'), '', [
      { text: t('languages.turkish'), onPress: () => void setLocale('tr') },
      { text: t('languages.english'), onPress: () => void setLocale('en') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: ISLAND_BOTTOM_BAR_CONTENT_INSET + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(label, localeTag)}</Text>
        </View>
        <Text style={styles.name}>{label}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={styles.card}>
        <Row icon="work" label={t('profile.role')} value={roleLabel} />
        <View style={styles.divider} />
        <Row icon="business" label={t('profile.department')} value={dept} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.78 }]}
        onPress={pickLanguage}
        accessibilityRole="button"
        accessibilityLabel={t('profile.language')}
      >
        <MaterialIcons name="language" size={22} color={islandTokens.text} />
        <Text style={styles.secondaryBtnText}>{t('profile.language')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
        onPress={() => router.push('/(app)/settings')}
        accessibilityRole="button"
        accessibilityLabel={t('nav.settings')}
      >
        <MaterialIcons name="settings" size={22} color={stats.onPrimary} />
        <Text style={styles.primaryBtnText}>{t('profile.settings')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.78 }]}
        onPress={() => {
          Alert.alert(t('profile.logoutTitle'), t('profile.logoutBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut() },
          ])
        }}
        accessibilityRole="button"
        accessibilityLabel={t('profile.logout')}
      >
        <MaterialIcons name="logout" size={22} color={islandTokens.text} />
        <Text style={styles.secondaryBtnText}>{t('profile.logout')}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name']
  label: string
  value: string
}) {
  return (
    <View style={styles.row}>
      <MaterialIcons name={icon} size={22} color={islandTokens.muted} style={styles.rowIcon} />
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: stats.background },
  content: { paddingHorizontal: stats.gutter, paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: islandTokens.fillActive,
    marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: islandTokens.text, letterSpacing: -1 },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: stats.onSurface,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  email: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
    color: stats.onSurfaceVariant,
    textAlign: 'center',
  },
  card: {
    borderRadius: stats.radiusXl,
    backgroundColor: stats.surfaceContainerLow,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: stats.outlineVariant,
    paddingVertical: 6,
    marginBottom: 16,
  },
  divider: {
    marginLeft: 52,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: stats.outlineVariant,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  rowIcon: { marginRight: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 12, fontWeight: '700', color: stats.onSurfaceVariant, letterSpacing: 0.2 },
  rowValue: { marginTop: 4, fontSize: 15, fontWeight: '600', color: stats.onSurface },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: stats.primary,
    borderRadius: stats.radiusXl,
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryBtnText: { color: stats.onPrimary, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: stats.surfaceBright,
    borderRadius: stats.radiusXl,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: stats.outlineVariant,
  },
  secondaryBtnText: { color: stats.onSurface, fontSize: 16, fontWeight: '700' },
})
