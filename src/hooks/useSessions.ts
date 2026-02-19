import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    storage.getSessions().then(setSessions);
  }, [storage]);

  const addSession = useCallback(
    async (session: PomodoroSession) => {
      setSessions((prev) => {
        const updated = [...prev, session];
        storage.saveSessions(updated);
        return updated;
      });
    },
    [storage],
  );

  const updateSession = useCallback(
    async (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => {
      setSessions((prev) => {
        const updated = prev.map((s) => s.date === date ? { ...s, ...patch } : s);
        storage.saveSessions(updated);
        return updated;
      });
    },
    [storage],
  );

  const deleteSession = useCallback(
    async (date: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.date !== date);
        storage.saveSessions(updated);
        return updated;
      });
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
  // monthOffset: 0 = current month, 1 = last month, etc.
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
  // yearOffset: 0 = current year, 1 = last year, etc.
  const getYearData = useCallback(
    (yearOffset: number): { month: string; count: number; totalSeconds: number }[] => {
      const targetYear = new Date().getFullYear() - yearOffset;
      return Array.from({ length: 12 }, (_, m) => {
        const monthSessions = sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === targetYear && d.getMonth() === m;
        });
        return {
          month: String(m), // month index as string; display name handled in component
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
  };
}
