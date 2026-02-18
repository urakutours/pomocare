import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerMode } from '@/types/timer';
import type { PomodoroSession } from '@/types/session';
import type { AlarmSettings } from '@/types/settings';
import { analytics } from '@/services/analytics/AnalyticsService';
import { playAlarm } from '@/utils/alarm';

interface UseTimerOptions {
  workTime: number;
  breakTime: number;
  longBreakTime: number;      // 0 = disabled
  longBreakInterval: number;  // 0 = disabled, else trigger every N completed work sessions
  alarm: AlarmSettings;
  activeLabel: string | null;
  activeNote: string;
  onSessionComplete: (session: PomodoroSession) => void;
}

export function useTimer({
  workTime,
  breakTime,
  longBreakTime,
  longBreakInterval,
  alarm,
  activeLabel,
  activeNote,
  onSessionComplete,
}: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(workTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  // Count of completed work sessions (used to trigger long break)
  const completedSessionsRef = useRef(0);

  // Sync timeLeft only when workTime setting changes while not running
  const prevWorkTimeRef = useRef(workTime);
  useEffect(() => {
    if (prevWorkTimeRef.current !== workTime && !isRunning && mode === 'work') {
      setTimeLeft(workTime * 60);
    }
    prevWorkTimeRef.current = workTime;
  }, [workTime, isRunning, mode]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);

      // Play alarm
      playAlarm(alarm.sound, alarm.repeat);

      if (mode === 'work') {
        const session: PomodoroSession = {
          date: new Date().toISOString(),
          duration: workTime * 60,
          label: activeLabel ?? undefined,
          note: activeNote || undefined,
        };
        onSessionComplete(session);
        analytics.track({ name: 'session_completed', properties: { duration: workTime } });

        completedSessionsRef.current += 1;

        // Determine next break type
        const shouldLongBreak =
          longBreakTime > 0 &&
          longBreakInterval > 0 &&
          completedSessionsRef.current % longBreakInterval === 0;

        if (shouldLongBreak) {
          setMode('longBreak' as TimerMode);
          setTimeLeft(longBreakTime * 60);
        } else if (breakTime > 0) {
          setMode('break');
          setTimeLeft(breakTime * 60);
        } else {
          setMode('work');
          setTimeLeft(workTime * 60);
        }
      } else {
        // break or longBreak finished
        setMode('work');
        setTimeLeft(workTime * 60);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, workTime, breakTime, longBreakTime, longBreakInterval, alarm, activeLabel, activeNote, onSessionComplete]);

  const toggle = useCallback(() => {
    setIsRunning((prev) => {
      analytics.track({ name: prev ? 'timer_paused' : 'timer_started' });
      return !prev;
    });
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setMode('work');
    setTimeLeft(workTime * 60);
    completedSessionsRef.current = 0;
    analytics.track({ name: 'timer_reset' });
  }, [workTime]);

  return { timeLeft, isRunning, mode, toggle, reset };
}
