import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET, islandTokens } from '../../../src/components/island/islandTokens'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats } from '../../../src/theme/statsDesignTokens'

type DeactivateRpcResult = { ok?: boolean; error?: string }

export default function SettingsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const runDeactivate = useCallback(async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('mobile_deactivate_own_account')
      if (error) {
        Alert.alert(t('settings.failed'), error.message)
        return
      }
      const payload = data as DeactivateRpcResult | null
      if (!payload?.ok) {
        Alert.alert(
          t('settings.failed'),
          payload?.error === 'profile_not_found' ? t('settings.profileNotFound') : t('settings.removeFailed')
        )
        return
      }
      await signOut()
      router.replace('/login')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.unknownError')
      Alert.alert(t('settings.failed'), message)
    } finally {
      setBusy(false)
    }
  }, [router, signOut, t])

  const confirmDeactivate = useCallback(() => {
    Alert.alert(t('settings.removeProfile'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.continue'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('settings.confirmTitle'), '', [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.confirmRemove'), style: 'destructive', onPress: () => void runDeactivate() },
          ])
        },
      },
    ])
  }, [runDeactivate, t])

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: ISLAND_BOTTOM_BAR_CONTENT_INSET + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>{t('settings.legalSection')}</Text>

      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(app)/settings/privacy')}
          accessibilityRole="button"
        >
          <MaterialIcons name="privacy-tip" size={22} color={islandTokens.muted} style={styles.linkIcon} />
          <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
          <MaterialIcons name="chevron-right" size={22} color={islandTokens.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(app)/settings/terms')}
          accessibilityRole="button"
        >
          <MaterialIcons name="description" size={22} color={islandTokens.muted} style={styles.linkIcon} />
          <Text style={styles.linkText}>{t('settings.termsOfService')}</Text>
          <MaterialIcons name="chevron-right" size={22} color={islandTokens.muted} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.accountSection')}</Text>

      <Pressable
        style={({ pressed }) => [styles.dangerBtn, (pressed || busy) && { opacity: 0.82 }]}
        onPress={confirmDeactivate}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('settings.removeProfile')}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.dangerBtnText}>{t('settings.removeProfile')}</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: stats.background },
  content: { paddingHorizontal: stats.gutter, paddingTop: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: stats.onSurfaceVariant,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: stats.radiusXl,
    backgroundColor: stats.surfaceContainerLow,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: stats.outlineVariant,
    marginBottom: 24,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkIcon: {
    marginRight: 14,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: stats.onSurface,
  },
  divider: {
    marginLeft: 52,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: stats.outlineVariant,
  },
  dangerBtn: {
    backgroundColor: stats.error,
    borderRadius: stats.radiusXl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  dangerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
