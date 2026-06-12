import 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SystemUI from 'expo-system-ui'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider } from '../src/providers/AuthProvider'
import { LocaleProvider } from '../src/providers/LocaleProvider'
import { PushNotificationManager } from '../src/providers/PushNotificationManager'
import { QueryProvider } from '../src/providers/QueryProvider'
import { stats } from '../src/theme/statsDesignTokens'
import { statsFontLoadMap } from '../src/theme/statsFonts'

export default function RootLayout() {
  const [loaded, error] = useFonts(statsFontLoadMap)
  const [fontTimeout, setFontTimeout] = useState(false)

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(stats.background)
  }, [])

  // Font yükleme timeout - 5 saniye sonra fontlar yüklenmese de devam et
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded && !error) {
        console.warn('⏱️ Font yükleme timeout - sistem fontlarıyla devam ediliyor')
        setFontTimeout(true)
      }
    }, 5_000)
    return () => clearTimeout(timer)
  }, [loaded, error])

  // Font hatasını logla
  useEffect(() => {
    if (error) {
      console.error('❌ Font yükleme hatası:', error)
    }
  }, [error])

  // Font yüklendi, hata oluştu veya timeout olduysa devam et
  const canProceed = loaded || error || fontTimeout

  if (!canProceed) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: stats.background,
        }}
      >
        <ActivityIndicator color={stats.primary} size="large" />
      </View>
    )
  }

  return (
    <QueryProvider>
      <LocaleProvider>
        <AuthProvider>
          <PushNotificationManager />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#111',
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        </AuthProvider>
      </LocaleProvider>
    </QueryProvider>
  )
}
