'use client';

import { useEffect, useState } from 'react';

export function NotificationManager() {
  const [originalTitle, setOriginalTitle] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Store original title
    setOriginalTitle(document.title);

    // Register service worker message listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Cleanup on unmount
    return () => {
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
        break;
      
      case 'PLAY_NOTIFICATION_SOUND':
        playNotificationSound(soundType);
        break;
    }
  };

  const updateDocumentTitle = (count: number) => {
    if (count > 0) {
      document.title = `(${count}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
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
    
    // Clear browser badge
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(0);
    } else if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
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
