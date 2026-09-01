'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Volume2, Monitor, Smartphone, Bell } from 'lucide-react';

export function DesktopNotificationTest() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const runDesktopNotificationTest = async () => {
    setTesting(true);
    setTestResults([]);
    
    const results = [];

    try {
      // Test 1: Browser support
      const browserSupport = {
        name: 'Tarayıcı Desteği',
        status: 'serviceWorker' in navigator && 'PushManager' in window ? 'Destekleniyor' : 'Desteklenmiyor',
        details: navigator.userAgent
      };
      results.push(browserSupport);

      // Test 2: Notification permission
      const permission = await Notification.requestPermission();
      const permissionTest = {
        name: 'Bildirim İzni',
        status: permission === 'granted' ? 'Verildi' : permission === 'denied' ? 'Reddedildi' : 'Bekliyor',
        details: `Permission: ${permission}`
      };
      results.push(permissionTest);

      // Test 3: Service Worker registration
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const swTest = {
          name: 'Service Worker',
          status: 'Kayıtlı',
          details: `State: ${registration.active?.state || 'pending'}`
        };
        results.push(swTest);
      } catch (error) {
        const swTest = {
          name: 'Service Worker',
          status: 'Hata',
          details: `Error: ${error}`
        };
        results.push(swTest);
      }

      // Test 4: Platform detection
      const platform = {
        name: 'Platform',
        status: window.innerWidth > 768 ? 'Masaüstü' : 'Mobil',
        details: `Screen: ${window.innerWidth}x${window.innerHeight}, Touch: ${'ontouchstart' in window ? 'Yes' : 'No'}`
      };
      results.push(platform);

      // Test 5: Audio context support
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioTest = {
          name: 'Ses Desteği',
          status: 'Destekleniyor',
          details: `Audio Context State: ${audioContext.state}`
        };
        results.push(audioTest);
        audioContext.close();
      } catch (error) {
        const audioTest = {
          name: 'Ses Desteği',
          status: 'Desteklenmiyor',
          details: `Error: ${error}`
        };
        results.push(audioTest);
      }

      // Test 6: Badge API support
      const badgeSupport = {
        name: 'Badge API',
        status: 'setAppBadge' in navigator ? 'Destekleniyor' : 'Desteklenmiyor',
        details: `Navigator badge methods: ${Object.getOwnPropertyNames(navigator).filter(prop => prop.includes('badge') || prop.includes('Badge')).join(', ') || 'None'}`
      };
      results.push(badgeSupport);

      // Test 7: Test desktop notification
      if (permission === 'granted') {
        try {
          const notification = new Notification('Masaüstü Test Bildirimi 🖥️', {
            body: 'Bu bildirim masaüstünde görünüyor ve ses çıkarıyor!',
            icon: '/android-chrome-192x192.png',
            badge: '/favicon-32x32.png',
            tag: 'desktop-test',
            requireInteraction: false,
            silent: false
          });

          // Auto close after 3 seconds
          setTimeout(() => {
            notification.close();
          }, 3000);

          const notificationTest = {
            name: 'Test Bildirimi',
            status: 'Gönderildi',
            details: 'Masaüstü bildirimi başarıyla gösterildi'
          };
          results.push(notificationTest);

          // Test custom sound
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLYiTcIGGi78eefTQgMUKfj8LZjHAY4k9nq54gyCBx+ye7blksIE1+268WRSA0BVaLl5adVBgc+m9w=");
            await audio.play();
            
            const soundTest = {
              name: 'Özel Ses',
              status: 'Çalıştırıldı',
              details: 'Özel bildirim sesi başarıyla çalındı'
            };
            results.push(soundTest);
          } catch (soundError) {
            const soundTest = {
              name: 'Özel Ses',
              status: 'Hata',
              details: `Ses çalarken hata: ${soundError}`
            };
            results.push(soundTest);
          }

        } catch (notificationError) {
          const notificationTest = {
            name: 'Test Bildirimi',
            status: 'Hata',
            details: `Bildirim gösterilirken hata: ${notificationError}`
          };
          results.push(notificationTest);
        }
      }

    } catch (error) {
      results.push({
        name: 'Genel Test',
        status: 'Hata',
        details: `Test sırasında hata: ${error}`
      });
    }

    setTestResults(results);
    setTesting(false);
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Destekleniyor') || status.includes('Verildi') || status.includes('Kayıtlı') || status.includes('Gönderildi') || status.includes('Çalıştırıldı')) {
      return 'default';
    } else if (status.includes('Hata') || status.includes('Desteklenmiyor') || status.includes('Reddedildi')) {
      return 'destructive';
    } else {
      return 'secondary';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Masaüstü Bildirim Testi
        </CardTitle>
        <CardDescription>
          Masaüstü tarayıcınızda bildirim ve ses desteğini test edin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDesktopNotificationTest} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            'Test Ediliyor...'
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Masaüstü Bildirim Testini Başlat
            </>
          )}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-700">Test Sonuçları:</h3>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.name}</div>
                  <div className="text-xs text-gray-600 mt-1">{result.details}</div>
                </div>
                <Badge variant={getStatusColor(result.status)} className="ml-2">
                  {result.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1 mt-4">
          <p className="flex items-center gap-1">
            <Monitor className="h-3 w-3" />
            Masaüstü: Chrome, Firefox, Edge, Safari destekler
          </p>
          <p className="flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            Ses: Tarayıcı ayarlarında bildirim sesi açık olmalı
          </p>
          <p className="flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            Badge: Chrome ve Edge'de tab'da sayı gösterir
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
