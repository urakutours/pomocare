import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';

export function useSettings(storage: StorageService) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  // Track the last-saved settings to detect local vs remote changes
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Timeout: fall back to defaults if Supabase hangs
        const s = await Promise.race([
          storage.getSettings(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('settings_load_timeout')), 8_000),
          ),
        ]);

        if (cancelled) return;

        // Migrate old 'dark' theme to 'gray' (one-time, v2 theme system)
        const migrationKey = 'pomocare-theme-v2-migrated';
        let migrated = s;
        if (!localStorage.getItem(migrationKey) && s.theme === 'dark') {
          migrated = { ...s, theme: 'gray' };
          storage.saveSettings(migrated);
        }
        localStorage.setItem(migrationKey, '1');

        lastSavedRef.current = JSON.stringify(migrated);
        setSettings(migrated);
      } catch {
        // Network error or timeout — use defaults so the app is usable
        if (cancelled) return;
        setSettings(DEFAULT_SETTINGS);
      }
      if (!cancelled) setIsLoaded(true);
    };

    load();
    return () => { cancelled = true; };
  }, [storage]);

  // ── Refetch on tab focus (cross-device sync) ──
  useEffect(() => {
    let lastFetch = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch > 5_000) {
        lastFetch = Date.now();
        storage.getSettings().then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          setSettings(s);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [storage]);

  // ── Remote change subscription (Supabase Broadcast) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return;

    const unsubscribe = storage.onRemoteChange((table) => {
      if (table === 'settings') {
        storage.getSettings().then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          setSettings(s);
        });
      }
    });

    return unsubscribe;
  }, [storage]);

  // ── Interval polling (fallback sync every 60s, only for cloud storage) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return; // skip for localStorage

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        storage.getSettings().then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          setSettings(s);
        });
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [storage]);

  // ── Fetch-merge-save: fetch latest from server before saving ──
  const updateSettings = useCallback(
    async (newSettings: PomodoroSettings) => {
      // Optimistic UI update
      setSettings(newSettings);

      try {
        // Fetch latest server state to avoid overwriting remote changes
        const server = await storage.getSettings();
        // Merge: start from server, then apply local changes
        const merged = { ...server, ...newSettings };
        lastSavedRef.current = JSON.stringify(merged);
        setSettings(merged);
        await storage.saveSettings(merged);
      } catch {
        // Network error — save locally changed version as-is
        lastSavedRef.current = JSON.stringify(newSettings);
        await storage.saveSettings(newSettings);
      }
    },
    [storage],
  );

  return { settings, updateSettings, isLoaded };
}
