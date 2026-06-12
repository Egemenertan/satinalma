import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { ComponentProps } from 'react'
import { useRouter } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { useAppLocale } from '../../../src/i18n/useAppLocale'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats, statsFont } from '../../../src/theme/statsDesignTokens'

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
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(label, localeTag)}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.name} numberOfLines={1}>{label}</Text>
            <Text style={styles.email} numberOfLines={1}>{email}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
        
        <ActionRow
          icon="language"
          label={t('profile.language')}
          onPress={pickLanguage}
        />
        
        <ActionRow
          icon="settings"
          label={t('nav.settings')}
          onPress={() => router.push('/(app)/settings')}
          chevron
        />
      </View>

      <View style={styles.logoutSection}>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={() => {
            Alert.alert(t('profile.logoutTitle'), t('profile.logoutBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut() },
            ])
          }}
          accessibilityRole="button"
          accessibilityLabel={t('profile.logout')}
        >
          <MaterialIcons name="logout" size={20} color={stats.error} />
          <Text style={styles.logoutBtnText}>{t('profile.logout')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function ActionRow({
  icon,
  label,
  onPress,
  chevron,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name']
  label: string
  onPress: () => void
  chevron?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIconWrap}>
        <MaterialIcons name={icon} size={20} color="#01E884" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      {chevron && (
        <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: stats.background },
  content: { paddingHorizontal: stats.gutter, paddingTop: 16 },

  heroCard: {
    backgroundColor: '#000000',
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#01E884',
  },
  avatarText: { 
    fontSize: 24, 
    fontFamily: statsFont.bold, 
    color: '#000000', 
    letterSpacing: -0.5 
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontFamily: statsFont.bold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: statsFont.medium,
    color: '#9ca3af',
  },

  actionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: statsFont.bold,
    color: '#6b7280',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionRowPressed: {
    backgroundColor: '#f9fafb',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(1, 232, 132, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: statsFont.semibold,
    color: stats.onSurface,
  },

  logoutSection: {
    marginTop: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.15)',
  },
  logoutBtnPressed: {
    backgroundColor: 'rgba(186, 26, 26, 0.12)',
  },
  logoutBtnText: { 
    color: stats.error, 
    fontSize: 15, 
    fontFamily: statsFont.semibold,
  },
})
