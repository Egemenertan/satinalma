'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Smartphone, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

export function PushNotificationSetup() {
  const {
    isSupported,
    isSubscribed,
    loading,
    error,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Bildirimler Desteklenmiyor
          </CardTitle>
          <CardDescription>
            Bu cihaz veya tarayıcı push bildirimleri desteklemiyor.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobil Bildirimler
        </CardTitle>
        <CardDescription>
          Yeni talepler ve güncellemeler için push bildirimleri alın
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Durum:</span>
          <Badge variant={isSubscribed ? "default" : "secondary"}>
            {isSubscribed ? "Aktif" : "Pasif"}
          </Badge>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {!isSubscribed ? (
            <Button
              onClick={subscribeToPush}
              disabled={loading}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              {loading ? 'Aktifleştiriliyor...' : 'Bildirimleri Aktifleştir'}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={sendTestNotification}
                variant="outline"
                className="w-full"
              >
                <Bell className="h-4 w-4 mr-2" />
                Test Bildirimi Gönder
              </Button>
              <Button
                onClick={unsubscribeFromPush}
                variant="destructive"
                disabled={loading}
                className="w-full"
              >
                <BellOff className="h-4 w-4 mr-2" />
                {loading ? 'Kapatılıyor...' : 'Bildirimleri Kapat'}
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Ana ekrana ekledikten sonra bildirimler çalışır</p>
          <p>• Yeni talepler için otomatik bildirim alırsınız</p>
          <p>• Bildirimler istediğiniz zaman kapatılabilir</p>
        </div>
      </CardContent>
    </Card>
  );
}
