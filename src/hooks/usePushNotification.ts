import { useCallback, useEffect, useRef } from 'react';

export function usePushNotification() {
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.ready.then((reg) => {
      regRef.current = reg;
    });
  }, []);

  const notify = useCallback(async (title: string, body: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    const reg = regRef.current ?? (await navigator.serviceWorker.ready);
    const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'pomocare-timer',
      renotify: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: '/' },
    };
    await reg.showNotification(title, options);
  }, []);

  return { notify };
}
