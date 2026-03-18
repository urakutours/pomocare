import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';
import { SupabaseAdapter } from '@/services/storage/SupabaseAdapter';
import { mergeLabels } from '@/utils/mergeLabels';

/** Read cached settings for instant startup (avoids flash of defaults). */
function getInitialSettings(): { settings: PomodoroSettings; fromCache: boolean } {
  const cached = SupabaseAdapter.getCachedSettings();
  return cached ? { settings: cached, fromCache: true } : { settings: DEFAULT_SETTINGS, fromCache: false };
}

export function useSettings(storage: StorageService) {
  const { settings: initialSettings, fromCache } = getInitialSettings();
  const [settings, setSettings] = useState<PomodoroSettings>(initialSettings);
  // If we have cached settings, consider "loaded" immediately (Supabase will update in background)
  const [isLoaded, setIsLoaded] = useState(fromCache);
  // Track the last-saved settings to detect local vs remote changes
  const lastSavedRef = useRef<string>('');
  // Guard: true only after settings have been successfully loaded from the server.
  // Prevents accidental write-back of DEFAULT_SETTINGS when the load fails/times out.
  const serverLoadedRef = useRef(false);

  // ── Helper: timeout-wrapped settings fetch ──
  const fetchSettings = useCallback(
    (timeoutMs: number = 10_000) => Promise.race([
      storage.getSettings(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getSettings timeout')), timeoutMs),
      ),
    ]),
    [storage],
  );

  useEffect(() => {
    let cancelled = false;
    serverLoadedRef.current = false; // Reset on storage change

    // Fetch settings from server with retry (3 attempts, exponential backoff).
    const loadWithRetry = async () => {
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        try {
          const s = await fetchSettings(15_000);
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
          serverLoadedRef.current = true;
          setSettings(migrated);
          setIsLoaded(true);
          return; // success
        } catch {
          if (i < 2 && !cancelled) {
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); // 2s, 4s
          }
        }
      }
      // All attempts failed
      if (!cancelled) {
        console.warn('[useSettings] Initial load failed after 3 attempts');
        setIsLoaded(true);
      }
    };

    loadWithRetry();

    // Fallback: if fetch is very slow and no cache exists, show UI with defaults
    // after 10s rather than keeping the spinner indefinitely.
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setIsLoaded(true);
    }, 10_000);

    return () => { cancelled = true; clearTimeout(fallbackTimer); };
  }, [storage, fetchSettings]);

  // ── Refetch on tab focus (cross-device sync) ──
  useEffect(() => {
    let lastFetch = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastFetch > 5_000) {
        lastFetch = Date.now();
        fetchSettings(8_000).then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          serverLoadedRef.current = true;
          setSettings(s);
        }).catch(() => { /* keep current settings on error */ });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchSettings]);

  // ── Remote change subscription (Supabase Broadcast) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return;

    const unsubscribe = storage.onRemoteChange((table) => {
      if (table === 'settings') {
        fetchSettings(8_000).then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          serverLoadedRef.current = true;
          setSettings(s);
        }).catch(() => { /* keep current settings on error */ });
      }
    });

    return unsubscribe;
  }, [storage, fetchSettings]);

  // ── Interval polling (fallback sync every 15s, only for cloud storage) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return; // skip for localStorage

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchSettings(10_000).then((s) => {
          lastSavedRef.current = JSON.stringify(s);
          serverLoadedRef.current = true;
          setSettings(s);
        }).catch(() => { /* keep current settings on error */ });
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [fetchSettings]);

  // ── Guard helper: try to load from server if not yet loaded ──
  const ensureServerLoaded = useCallback(async () => {
    if (serverLoadedRef.current) return;
    try {
      const loaded = await fetchSettings(10_000);
      lastSavedRef.current = JSON.stringify(loaded);
      serverLoadedRef.current = true;
      setSettings(loaded);
    } catch {
      console.warn('[useSettings] ensureServerLoaded failed, proceeding anyway');
    }
  }, [fetchSettings]);

  // ── Fetch-merge-save: fetch latest from server before saving ──
  const updateSettings = useCallback(
    async (newSettings: PomodoroSettings) => {
      // Try to load from server if not yet loaded (don't silently drop writes)
      await ensureServerLoaded();

      // Optimistic UI update
      setSettings(newSettings);

      try {
        // Fetch latest server state to avoid overwriting remote changes
        const server = await storage.getSettings();
        // Merge: start from server, then apply local changes
        // Special handling: union-merge labels and customColors by ID instead of replacing
        const merged = {
          ...server,
          ...newSettings,
          labels: mergeLabels(server.labels ?? [], newSettings.labels ?? []),
          customColors: [...new Set([
            ...(server.customColors ?? []),
            ...(newSettings.customColors ?? []),
          ])],
        };
        lastSavedRef.current = JSON.stringify(merged);
        setSettings(merged);
        await storage.saveSettings(merged);
      } catch {
        // Network error — save locally changed version as-is
        lastSavedRef.current = JSON.stringify(newSettings);
        await storage.saveSettings(newSettings);
      }
    },
    [storage, ensureServerLoaded],
  );

  // ── Partial update: only merge specified fields (avoids stale-closure bugs) ──
  const patchSettings = useCallback(
    async (patch: Partial<PomodoroSettings>) => {
      await ensureServerLoaded();

      setSettings((prev) => ({ ...prev, ...patch }));

      try {
        const server = await storage.getSettings();
        const merged = {
          ...server,
          ...patch,
          // If patch includes labels, union-merge them instead of replacing
          ...(patch.labels ? {
            labels: mergeLabels(server.labels ?? [], patch.labels),
          } : {}),
          // If patch includes customColors, union-merge them
          ...(patch.customColors ? {
            customColors: [...new Set([
              ...(server.customColors ?? []),
              ...patch.customColors,
            ])],
          } : {}),
        };
        lastSavedRef.current = JSON.stringify(merged);
        setSettings(merged);
        await storage.saveSettings(merged);
      } catch {
        // Silently ignore — next sync will reconcile
      }
    },
    [storage, ensureServerLoaded],
  );

  const refreshSettings = useCallback(async (): Promise<boolean> => {
    try {
      const loaded = await Promise.race([
        storage.getSettings(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15_000)
        ),
      ]);
      lastSavedRef.current = JSON.stringify(loaded);
      serverLoadedRef.current = true;
      setSettings(loaded);
      return true;
    } catch (err) {
      console.warn('[useSettings] refreshSettings failed:', err);
      return false;
    }
  }, [storage]);

  return { settings, updateSettings, patchSettings, refreshSettings, isLoaded };
}
