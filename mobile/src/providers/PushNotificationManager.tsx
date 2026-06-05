import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import i18n from '../i18n/i18n'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Oturum açıkken: bildirim izni, Expo push token kaydı (expo_push_tokens),
 * Supabase Realtime ile public.notifications INSERT → yerel bildirim.
 * Android kanal id sabit — kanal bir kez oluşunca sistem ayarlarını değiştirmez; ses için revizyon = id değişimi.
 */
const ANDROID_CHANNEL_ID = 'satinalma_alerts_v1'

export function PushNotificationManager() {
  const { user } = useAuth()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!user?.id) {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    let cancelled = false
    const uid = user.id

    const run = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Genel',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
          bypassDnd: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        })
      }

      if (Device.isDevice) {
        const { status: existing } = await Notifications.getPermissionsAsync()
        let next = existing
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          next = status
        }

        if (next === 'granted' && !cancelled) {
          const projectId =
            (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
              ?.projectId ??
            Constants.easConfig?.projectId

          try {
            const tokenRes = projectId
              ? await Notifications.getExpoPushTokenAsync({ projectId })
              : await Notifications.getExpoPushTokenAsync()
            const expoPushToken = tokenRes.data
            await supabase.from('expo_push_tokens').upsert({
              user_id: uid,
              expo_push_token: expoPushToken,
              platform: Platform.OS,
              updated_at: new Date().toISOString(),
            })
          } catch {
            // Expo Go / eksik projectId — sadece Realtime ile devam
          }
        }
      }

      if (cancelled) return

      const ch = supabase
        .channel(`inbox_notifications:${uid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as { title?: string; message?: string }
            void Notifications.scheduleNotificationAsync({
              content: {
                title: row.title ?? i18n.t('push.defaultTitle'),
                body: row.message ?? '',
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.HIGH,
                vibrate: [0, 250, 250, 250],
                ...(Platform.OS === 'android'
                  ? { android: { channelId: ANDROID_CHANNEL_ID } }
                  : { ios: { sound: 'default' } }),
              },
              trigger: null,
            })
          }
        )
        .subscribe()

      channelRef.current = ch
    }

    void run()

    return () => {
      cancelled = true
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id])

  return null
}
