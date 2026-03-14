import { apiRequest } from './api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class NotificationManager {
  static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration.scope);
        return registration;
      } catch (err) {
        console.error('SW registration failed:', err);
        return null;
      }
    }
    return null;
  }

  static async requestPermission() {
    if (!('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  static async subscribeUser() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const existingSubscription = await registration.pushManager.getSubscription();
      let subscription = existingSubscription;

      if (!subscription) {
        // Fetch VAPID public key from backend
        const keyRes = await apiRequest('/api/push/key');
        const { publicKey } = await keyRes.json();

        if (!publicKey) {
          console.error('Failed to fetch VAPID public key from server');
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      // Always send to backend to ensure mapping is fresh
      await apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription)
      });

      return subscription;
    } catch (err) {
      console.error('Failed to subscribe user:', err);
      return null;
    }
  }

  static async unsubscribeUser() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        await apiRequest('/api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }
}
