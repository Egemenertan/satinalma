import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { IslandBottomBar, IslandStackHeader } from '../../src/components/island'
import { stats } from '../../src/theme/statsDesignTokens'
import { useAuth } from '../../src/providers/AuthProvider'

export default function AppGroupLayout() {
  const { session, loading, profile } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: stats.background }}>
        <ActivityIndicator size="large" color={stats.primary} />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/login" />
  }

  return (
    <View style={{ flex: 1, backgroundColor: stats.background }}>
      <Stack
        screenOptions={{
          header: (props) => <IslandStackHeader {...props} />,
          headerShown: true,
          headerShadowVisible: false,
          /** Şeffaf: alt bölgede ekstra boyalı katman olmasın; inset scroll içinde */
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen
          name="requests/index"
          options={{
            title: t('nav.requests'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="requests/create"
          options={{
            title: t('nav.newRequest'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="notifications/index"
          options={{
            title: t('nav.notifications'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="requests/[id]"
          options={{
            title: t('nav.requestDetail'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="inventory/index"
          options={{
            title: t('nav.inventory'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="profile/index"
          options={{
            title: t('nav.profile'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="settings/index"
          options={{
            title: t('nav.settings'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="settings/privacy"
          options={{
            title: t('nav.privacyPolicy'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="settings/terms"
          options={{
            title: t('nav.termsOfService'),
            headerStyle: { backgroundColor: '#ffffff' },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
      <IslandBottomBar />
    </View>
  )
}
