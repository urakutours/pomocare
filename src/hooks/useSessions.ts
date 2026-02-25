import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroSession } from '@/types/session';
import type { StorageService } from '@/services/storage/types';
import type { Translations } from '@/i18n';
import { getWeekStartDate } from '@/utils/date';

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
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  // Ref to avoid stale closures in callbacks — always holds the latest sessions
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    setSessions([]); // ストレージ切替時に旧データを即クリア
    storage.getSessions().then(setSessions);
  }, [storage]);

  // ── Refetch on tab focus (cross-device sync) ──
  useEffect(() => {
    let lastFetch = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch > 5_000) {
        lastFetch = Date.now();
        storage.getSessions().then(setSessions);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [storage]);

  // ── Fetch-Merge-Save helpers (cross-device safe) ──
  // Each write operation fetches the latest server data first so that
  // changes made on other devices are never silently overwritten.

  const addSession = useCallback(
    async (session: PomodoroSession) => {
      // Optimistic UI update
      setSessions((prev) => [...prev, session]);
      // Merge with server: keep all server sessions + add new one (dedup by date)
      const server = await storage.getSessions();
      const merged = [...server.filter((s) => s.date !== session.date), session];
      setSessions(merged);
      await storage.saveSessions(merged);
    },
    [storage],
  );

  const updateSession = useCallback(
    async (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => {
      // Optimistic UI update
      setSessions((prev) => prev.map((s) => s.date === date ? { ...s, ...patch } : s));
      // Apply patch to latest server data
      const server = await storage.getSessions();
      const merged = server.map((s) => s.date === date ? { ...s, ...patch } : s);
      setSessions(merged);
      await storage.saveSessions(merged);
    },
    [storage],
  );

  const deleteSession = useCallback(
    async (date: string) => {
      // Optimistic UI update
      setSessions((prev) => prev.filter((s) => s.date !== date));
      // Apply delete to latest server data
      const server = await storage.getSessions();
      const merged = server.filter((s) => s.date !== date);
      setSessions(merged);
      await storage.saveSessions(merged);
    },
    [storage],
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

  // Import sessions from CSV (merges with server + imported, deduplicates by date)
  const importSessions = useCallback(
    async (imported: PomodoroSession[]) => {
      const server = await storage.getSessions();
      const existingDates = new Set(server.map((s) => s.date));
      const newSessions = imported.filter((s) => !existingDates.has(s.date));
      const merged = [...server, ...newSessions];
      setSessions(merged);
      await storage.saveSessions(merged);
    },
    [storage],
  );

  return {
    sessions,
    addSession,
    updateSession,
    deleteSession,
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
