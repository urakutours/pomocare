import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY } from '@/config/push';

const SUPABASE_FUNCTIONS_URL =
  'https://cjylcizaikyirdxkwpao.supabase.co/functions/v1';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

export function usePushNotification(userId: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('PushManager' in window && 'serviceWorker' in navigator);
  }, []);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported || !userId) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [isSupported, userId]);

  /** Request permission and subscribe to Web Push. Call from a user gesture. */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const p256dhKey = sub.getKey('p256dh');
      const authKey = sub.getKey('auth');
      if (!p256dhKey || !authKey) return false;

      const headers = await getAuthHeaders();
      await fetch(`${SUPABASE_FUNCTIONS_URL}/schedule-notification`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'subscribe',
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('[usePushNotification] subscribe failed:', err);
      return false;
    }
  }, [userId]);

  /** Schedule a push notification at the given timestamp (ms). */
  const scheduleNotification = useCallback(
    async (fireAt: number, title: string, body: string) => {
      if (!userId || !isSubscribed) return;
      try {
        const headers = await getAuthHeaders();
        await fetch(`${SUPABASE_FUNCTIONS_URL}/schedule-notification`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'schedule',
            fire_at: new Date(fireAt).toISOString(),
            title,
            body,
          }),
        });
      } catch (err) {
        console.error('[usePushNotification] schedule failed:', err);
      }
    },
    [userId, isSubscribed],
  );

  /** Cancel any pending scheduled notifications for this user. */
  const cancelNotification = useCallback(async () => {
    if (!userId) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${SUPABASE_FUNCTIONS_URL}/schedule-notification`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'cancel' }),
      });
    } catch (err) {
      console.error('[usePushNotification] cancel failed:', err);
    }
  }, [userId]);

  return {
    isSupported,
    isSubscribed,
    subscribe,
    scheduleNotification,
    cancelNotification,
  };
}
