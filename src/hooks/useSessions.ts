import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroSession } from '@/types/session';
import type { StorageService } from '@/services/storage/types';
import type { Translations } from '@/i18n';
import { getWeekStartDate } from '@/utils/date';
import { NeonAdapter } from '@/services/storage/NeonAdapter';

export interface DayData {
  day: string;
  date: Date;
  count: number;
  totalSeconds: number;
}

export interface MonthDayData {
  date: Date;
  count: number;
  totalSeconds: number;
}

export function useSessions(storage: StorageService, days: Translations['days']) {
  const [sessions, setSessions] = useState<PomodoroSession[]>(() => {
    const cached = NeonAdapter.getCachedSessions() ?? [];
    console.log('[Sessions] init from cache:', cached.length, 'sessions');
    return cached;
  });
  // Ref to avoid stale closures in callbacks — always holds the latest sessions
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  // Guard: true only after sessions have been successfully loaded from the server.
  // Prevents accidental write-back of empty [] when the load fails/times out,
  // mirroring the same protection that useSettings has via its serverLoadedRef.
  const serverLoadedRef = useRef(false);

  // ── Helpers: timeout-wrapped fetchers ──
  const fetchSessions = useCallback(
    (timeoutMs: number = 15_000) => Promise.race([
      storage.getSessions(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getSessions timeout')), timeoutMs),
      ),
    ]),
    [storage],
  );

  /** Lightweight fetch for sync triggers — skips migration/flush when available. */
  const fetchSessionsForSync = useCallback(
    (timeoutMs: number = 8_000) => {
      const getter = storage.getSessionsFast
        ? () => storage.getSessionsFast!()
        : () => storage.getSessions();
      return Promise.race([
        getter(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('sync fetch timeout')), timeoutMs),
        ),
      ]);
    },
    [storage],
  );

  useEffect(() => {
    let cancelled = false;
    serverLoadedRef.current = false; // Reset on storage change

    // Fetch sessions from server with retry (3 attempts, exponential backoff).
    const loadWithRetry = async () => {
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        try {
          const loaded = await fetchSessions(15_000);
          if (cancelled) return;
          serverLoadedRef.current = true;
          setSessions(loaded);
          return; // success
        } catch {
          if (i < 2 && !cancelled) {
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); // 2s, 4s
          }
        }
      }
      console.warn('[useSessions] Initial load failed after 3 attempts');
    };

    loadWithRetry();
    return () => { cancelled = true; };
  }, [fetchSessions]);

  // ── Refetch on tab focus (cross-device sync) ──
  useEffect(() => {
    let lastFetch = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastFetch > 5_000) {
        lastFetch = Date.now();
        fetchSessionsForSync(8_000).then((s) => {
          serverLoadedRef.current = true;
          setSessions(s);
        }).catch(() => { /* keep current sessions on error */ });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchSessionsForSync]);

  // ── Remote change subscription (polling) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return;

    const unsubscribe = storage.onRemoteChange((table) => {
      if (table === 'sessions') {
        fetchSessionsForSync(8_000).then((s) => {
          serverLoadedRef.current = true;
          setSessions(s);
        }).catch(() => { /* keep current sessions on error */ });
      }
    });

    return unsubscribe;
  }, [storage, fetchSessionsForSync]);

  // ── Interval polling (fallback sync every 15s, only for cloud storage) ──
  useEffect(() => {
    if (!storage.onRemoteChange) return; // skip for localStorage

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchSessionsForSync(10_000).then((s) => {
          serverLoadedRef.current = true;
          setSessions(s);
        }).catch(() => { /* keep current sessions on error */ });
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [storage, fetchSessionsForSync]);

  // ── Flush pending + refetch when device comes back online ──
  useEffect(() => {
    if (!storage.flushPendingSessions) return; // skip for localStorage

    const handleOnline = () => {
      console.log('[Sessions] online event — flushing pending + refetching');
      storage.flushPendingSessions!()
        .then(() => fetchSessionsForSync(10_000))
        .then((s) => {
          serverLoadedRef.current = true;
          setSessions(s);
        })
        .catch(() => { /* keep current sessions on error */ });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [storage, fetchSessionsForSync]);

  // ── Guard helper: try to load from server if not yet loaded ──
  const ensureServerLoaded = useCallback(async () => {
    if (serverLoadedRef.current) return;
    try {
      const loaded = await fetchSessions(10_000);
      serverLoadedRef.current = true;
      setSessions(loaded);
    } catch {
      console.warn('[useSessions] ensureServerLoaded failed, proceeding anyway');
    }
  }, [fetchSessions]);

  // ── Fetch-Merge-Save helpers (cross-device safe) ──
  // Each write operation fetches the latest server data first so that
  // changes made on other devices are never silently overwritten.

  const addSession = useCallback(
    async (session: PomodoroSession) => {
      // No serverLoadedRef guard — addSession writes to local cache + pending queue first,
      // then pushes to Neon in the background. Session data is never lost.

      // Optimistic UI update
      setSessions((prev) => [...prev, session]);
      try {
        if (storage.addSession) {
          // Atomic insert — no race condition, no data loss possible
          await storage.addSession(session);
        } else {
          // Fallback (localStorage): three-way union merge
          const server = await storage.getSessions();
          const allByDate = new Map<string, PomodoroSession>();
          for (const s of sessionsRef.current) allByDate.set(s.date, s);
          for (const s of server) allByDate.set(s.date, s);
          allByDate.set(session.date, session);
          const merged = Array.from(allByDate.values());
          setSessions(merged);
          await storage.saveSessions(merged);
        }
      } catch (err) {
        console.error('[Sessions] addSession failed:', err);
      }
    },
    [storage],
  );

  const updateSession = useCallback(
    async (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => {
      await ensureServerLoaded();
      // Optimistic UI update
      setSessions((prev) => prev.map((s) => s.date === date ? { ...s, ...patch } : s));
      try {
        if (storage.updateSession) {
          // Atomic update — only affects the target row
          await storage.updateSession(date, patch);
        } else {
          // Fallback (localStorage): three-way union merge + apply patch
          const server = await storage.getSessions();
          const allByDate = new Map<string, PomodoroSession>();
          for (const s of sessionsRef.current) allByDate.set(s.date, s);
          for (const s of server) allByDate.set(s.date, s);
          const target = allByDate.get(date);
          if (target) allByDate.set(date, { ...target, ...patch });
          const merged = Array.from(allByDate.values());
          setSessions(merged);
          await storage.saveSessions(merged);
        }
      } catch (err) {
        console.error('[Sessions] updateSession failed:', err);
      }
    },
    [storage, ensureServerLoaded],
  );

  const deleteSession = useCallback(
    async (date: string) => {
      await ensureServerLoaded();
      // Optimistic UI update
      setSessions((prev) => prev.filter((s) => s.date !== date));
      try {
        if (storage.deleteSession) {
          // Atomic delete — only removes the target row
          await storage.deleteSession(date);
        } else {
          // Fallback (localStorage): three-way union merge then delete target
          const server = await storage.getSessions();
          const allByDate = new Map<string, PomodoroSession>();
          for (const s of sessionsRef.current) allByDate.set(s.date, s);
          for (const s of server) allByDate.set(s.date, s);
          allByDate.delete(date);
          const merged = Array.from(allByDate.values());
          setSessions(merged);
          await storage.saveSessions(merged);
        }
      } catch (err) {
        console.error('[Sessions] deleteSession failed:', err);
      }
    },
    [storage, ensureServerLoaded],
  );

  const getTodayCount = useCallback(() => {
    const today = new Date().toDateString();
    return sessions.filter((s) => new Date(s.date).toDateString() === today).length;
  }, [sessions]);

  const getTodayTotalSeconds = useCallback(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((s) => new Date(s.date).toDateString() === today)
      .reduce((sum, s) => sum + s.duration, 0);
  }, [sessions]);

  const getWeekCount = useCallback(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions.filter((s) => new Date(s.date) >= weekAgo).length;
  }, [sessions]);

  const getWeekTotalSeconds = useCallback(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions
      .filter((s) => new Date(s.date) >= weekAgo)
      .reduce((sum, s) => sum + s.duration, 0);
  }, [sessions]);

  const getWeekData = useCallback(
    (weekOffset: number): DayData[] => {
      const startOfWeek = getWeekStartDate(weekOffset);

      return days.map((day, i) => {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dayString = currentDay.toDateString();
        const daySessions = sessions.filter(
          (s) => new Date(s.date).toDateString() === dayString,
        );
        const count = daySessions.length;
        const totalSeconds = daySessions.reduce((sum, s) => sum + s.duration, 0);

        return { day, date: currentDay, count, totalSeconds };
      });
    },
    [sessions, days],
  );

  // Returns data for each day of a given month
  const getMonthData = useCallback(
    (monthOffset: number): MonthDayData[] => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() - monthOffset;
      const target = new Date(year, month, 1);
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

      const result: MonthDayData[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(targetYear, targetMonth, d);
        const dayString = date.toDateString();
        const daySessions = sessions.filter(
          (s) => new Date(s.date).toDateString() === dayString,
        );
        result.push({
          date,
          count: daySessions.length,
          totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0),
        });
      }
      return result;
    },
    [sessions],
  );

  // Returns an array of 12 months' aggregated data for a given year
  const getYearData = useCallback(
    (yearOffset: number): { month: string; count: number; totalSeconds: number }[] => {
      const targetYear = new Date().getFullYear() - yearOffset;
      return Array.from({ length: 12 }, (_, m) => {
        const monthSessions = sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === targetYear && d.getMonth() === m;
        });
        return {
          month: String(m),
          count: monthSessions.length,
          totalSeconds: monthSessions.reduce((sum, s) => sum + s.duration, 0),
        };
      });
    },
    [sessions],
  );

  // Returns all sessions for label-based filtering
  const getLabelTotalSeconds = useCallback(
    (label: string | null): number => {
      if (!label) {
        return sessions.reduce((sum, s) => sum + s.duration, 0);
      }
      return sessions
        .filter((s) => s.label === label)
        .reduce((sum, s) => sum + s.duration, 0);
    },
    [sessions],
  );

  // Import sessions from CSV (three-way union merge: in-memory + server + imported)
  const importSessions = useCallback(
    async (imported: PomodoroSession[]) => {
      await ensureServerLoaded();
      try {
        const server = await storage.getSessions();
        const allByDate = new Map<string, PomodoroSession>();
        for (const s of sessionsRef.current) allByDate.set(s.date, s);
        for (const s of server) allByDate.set(s.date, s);
        for (const s of imported) allByDate.set(s.date, s); // imported wins ties
        const merged = Array.from(allByDate.values());
        setSessions(merged);
        await storage.saveSessions(merged);
      } catch (err) {
        console.error('[Sessions] importSessions failed:', err);
      }
    },
    [storage, ensureServerLoaded],
  );

  const refreshSessions = useCallback(async (): Promise<boolean> => {
    try {
      const loaded = await Promise.race([
        storage.getSessions(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15_000)
        ),
      ]);
      serverLoadedRef.current = true;
      setSessions(loaded);
      return true;
    } catch (err) {
      console.warn('[useSessions] refreshSessions failed:', err);
      return false;
    }
  }, [storage]);

  return {
    sessions,
    addSession,
    updateSession,
    deleteSession,
    refreshSessions,
    getTodayCount,
    getTodayTotalSeconds,
    getWeekCount,
    getWeekTotalSeconds,
    getWeekData,
    getMonthData,
    getYearData,
    getLabelTotalSeconds,
    importSessions,
  };
}
