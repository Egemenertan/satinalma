'use client';

import { useEffect, useRef, useState } from 'react';

function syncAppIconBadge(count: number) {
  if (typeof navigator === 'undefined') return;
  try {
    if (count > 0 && 'setAppBadge' in navigator) {
      const n = count > 99 ? 99 : count;
      void (navigator as Navigator & { setAppBadge(n?: number): Promise<void> }).setAppBadge(n);
    } else if ('clearAppBadge' in navigator) {
      void (navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge();
    }
  } catch {
    /* Bazı tarayıcılarda Rozet API yok veya PWA değil */
  }
}

export function NotificationManager() {
  const originalTitleRef = useRef<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title.replace(/^\(\d+\)\s+/, '');
    }

    const onTabBadge = (event: Event) => {
      const delta = (event as CustomEvent<{ delta?: number }>).detail?.delta ?? 0;
      if (!delta) return;
      setNotificationCount((prev) => {
        const next = Math.max(0, prev + delta);
        const base = originalTitleRef.current ?? document.title.replace(/^\(\d+\)\s+/, '');
        if (next > 0) {
          document.title = `(${next}) ${base}`;
        } else {
          document.title = base;
        }
        syncAppIconBadge(next);
        return next;
      });
    };

    window.addEventListener('satinalma:tab-badge', onTabBadge as EventListener);

    // Register service worker message listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('satinalma:tab-badge', onTabBadge as EventListener);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    const { type, count, soundType } = event.data;

    switch (type) {
      case 'UPDATE_BADGE':
        updateDocumentTitle(count);
        setNotificationCount(count);
        syncAppIconBadge(typeof count === 'number' ? count : 0);
        break;
      
      case 'PLAY_NOTIFICATION_SOUND':
        playNotificationSound(soundType);
        break;
    }
  };

  const updateDocumentTitle = (count: number) => {
    const raw = originalTitleRef.current ?? document.title;
    const base = raw.replace(/^\(\d+\)\s+/, '');
    if (originalTitleRef.current === null) {
      originalTitleRef.current = base;
    }
    if (count > 0) {
      document.title = `(${count}) ${base}`;
    } else {
      document.title = base;
    }
  };

  const playNotificationSound = (soundType: string = 'default') => {
    try {
      // Create audio for notification sound
      // Using Web Audio API for better browser compatibility
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generate notification beep sound programmatically since we don't have audio files
      const generateBeep = (frequency: number = 800, duration: number = 200) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      };

      // Play different sounds based on type
      switch (soundType) {
        case 'urgent':
          // Triple beep for urgent notifications
          generateBeep(1000, 150);
          setTimeout(() => generateBeep(1200, 150), 200);
          setTimeout(() => generateBeep(1000, 150), 400);
          break;
        case 'success':
          // Pleasant ascending beep for success
          generateBeep(800, 100);
          setTimeout(() => generateBeep(1000, 100), 100);
          break;
        default:
          // Single beep for normal notifications
          generateBeep(800, 200);
      }

      console.log(`Played ${soundType} notification sound`);

    } catch (error) {
      console.error('Error playing notification sound:', error);
      // Fallback: try to use a simple beep
      try {
        // Create a simple beep with data URL
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLYiTcIGGi78eefTQgMUKfj8LZjHAY4k9nq54gyCBx+ye7blksIE1+468WRSA0BVaLl5adVBgc+m9wAAAFW");
        audio.play().catch(() => {
          console.log('Fallback beep also failed');
        });
      } catch (fallbackError) {
        console.log('All audio attempts failed');
      }
    }
  };

  // Function to clear all notifications (can be called from other components)
  const clearAllNotifications = () => {
    setNotificationCount(0);
    updateDocumentTitle(0);
    syncAppIconBadge(0);
  };

  // Expose clear function globally for other components to use
  useEffect(() => {
    (window as any).clearNotifications = clearAllNotifications;
    return () => {
      delete (window as any).clearNotifications;
    };
  }, []);

  // Listen for page visibility changes to clear notifications when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && notificationCount > 0) {
        // User returned to the tab, clear notifications after a delay
        setTimeout(() => {
          clearAllNotifications();
        }, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [notificationCount]);

  // This component doesn't render anything visible
  return null;
}
