import { useCallback, useEffect, useRef, useState } from 'react';
import { workerPost } from '@/lib/api';
import { VAPID_PUBLIC_KEY } from '@/config/push';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotification(userId: string | null) {
  const [isSupported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subRef = useRef<PushSubscription | null>(null);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported || !userId) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        subRef.current = sub;
        setIsSubscribed(!!sub);
      });
    });
  }, [isSupported, userId]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      subRef.current = sub;
      const json = sub.toJSON();
      await workerPost('/schedule-notification', {
        action: 'subscribe',
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('[usePushNotification] subscribe failed:', err);
      return false;
    }
  }, [isSupported, userId]);

  const scheduleNotification = useCallback(
    async (fireAt: number, title: string, body: string) => {
      if (!userId) return;
      await workerPost('/schedule-notification', {
        action: 'schedule',
        fire_at: new Date(fireAt).toISOString(),
        title,
        body,
      });
    },
    [userId],
  );

  const cancelNotification = useCallback(async () => {
    if (!userId) return;
    await workerPost('/schedule-notification', { action: 'cancel' });
  }, [userId]);

  return {
    isSupported,
    isSubscribed,
    subscribe,
    scheduleNotification,
    cancelNotification,
  };
}
