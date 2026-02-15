import { useState, useEffect, useCallback } from 'react';
import type { PomodoroSession } from '@/types/session';
import type { StorageService } from '@/services/storage/types';
import type { Translations } from '@/i18n';
import { getWeekStartDate } from '@/utils/date';

export interface DayData {
  day: string;
  date: Date;
  count: number;
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

  const getTodayCount = useCallback(() => {
    const today = new Date().toDateString();
    return sessions.filter((s) => new Date(s.date).toDateString() === today).length;
  }, [sessions]);

  const getWeekCount = useCallback(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions.filter((s) => new Date(s.date) >= weekAgo).length;
  }, [sessions]);

  const getWeekData = useCallback(
    (weekOffset: number): DayData[] => {
      const startOfWeek = getWeekStartDate(weekOffset);

      return days.map((day, i) => {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dayString = currentDay.toDateString();
        const count = sessions.filter(
          (s) => new Date(s.date).toDateString() === dayString,
        ).length;

        return { day, date: currentDay, count };
      });
    },
    [sessions, days],
  );

  return { sessions, addSession, getTodayCount, getWeekCount, getWeekData };
}
