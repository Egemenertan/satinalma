import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import i18n from '../i18n/i18n'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

type NotificationsModule = typeof import('expo-notifications')

/**
 * Expo Go Android, SDK 57'nin `ExpoTopicSubscriptionModule` parçasını içermiyor.
 * Statik import bu yüzden açılışta tüm uygulamayı düşürür. Geliştirme ve mağaza
 * derlemelerinde modül vardır; orada bildirimler normal çalışır.
 */
function loadNotifications(): NotificationsModule | null {
  try {
    return require('expo-notifications') as NotificationsModule
  } catch (error) {
    console.warn('Bildirim modülü yüklenemedi. Yerel bildirimler bu oturumda kapalı.', error)
    return null
  }
}

const notifications = loadNotifications()

if (notifications) {
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

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
      if (notifications && Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Genel',
          importance: notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
          bypassDnd: false,
          lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
          audioAttributes: {
            usage: notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: notifications.AndroidAudioContentType.SONIFICATION,
          },
        })
      }

      if (notifications && Device.isDevice) {
        const { status: existing } = await notifications.getPermissionsAsync()
        let next = existing
        if (existing !== 'granted') {
          const { status } = await notifications.requestPermissionsAsync()
          next = status
        }

        if (next === 'granted' && !cancelled) {
          const projectId =
            (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
              ?.projectId ??
            Constants.easConfig?.projectId

          try {
            const tokenRes = projectId
              ? await notifications.getExpoPushTokenAsync({ projectId })
              : await notifications.getExpoPushTokenAsync()
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
            if (!notifications) return
            const row = payload.new as { title?: string; message?: string }
            void notifications.scheduleNotificationAsync({
              content: {
                title: row.title ?? i18n.t('push.defaultTitle'),
                body: row.message ?? '',
                sound: 'default',
                priority: notifications.AndroidNotificationPriority.HIGH,
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
