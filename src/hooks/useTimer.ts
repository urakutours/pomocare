import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerMode } from '@/types/timer';
import type { PomodoroSession } from '@/types/session';
import type { AlarmSettings } from '@/types/settings';
import { analytics } from '@/services/analytics/AnalyticsService';
import { playAlarm, unlockAudio } from '@/utils/alarm';

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

  // Wall-clock tracking: when the timer was started/resumed and how much time was left at that point
  const startTimestampRef = useRef<number | null>(null);
  const startTimeLeftRef = useRef<number>(workTime * 60);

  // Sync timeLeft only when workTime setting changes while not running
  const prevWorkTimeRef = useRef(workTime);
  useEffect(() => {
    if (prevWorkTimeRef.current !== workTime && !isRunning && mode === 'work') {
      setTimeLeft(workTime * 60);
    }
    prevWorkTimeRef.current = workTime;
  }, [workTime, isRunning, mode]);

  // Recalculate timeLeft from wall-clock when the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        startTimestampRef.current !== null
      ) {
        const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000);
        const remaining = Math.max(0, startTimeLeftRef.current - elapsed);
        setTimeLeft(remaining);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        // Use wall-clock elapsed time instead of decrementing by 1
        if (startTimestampRef.current !== null) {
          const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000);
          const remaining = Math.max(0, startTimeLeftRef.current - elapsed);
          setTimeLeft(remaining);
        }
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      startTimestampRef.current = null;

      // Play alarm
      playAlarm(alarm.sound, alarm.repeat, alarm.volume ?? 80, alarm.vibration ?? 'silent');

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
    // Unlock audio on every user tap so mobile browsers allow later playback
    unlockAudio();

    setIsRunning((prev) => {
      if (prev) {
        // Pausing: clear wall-clock tracking
        startTimestampRef.current = null;
        analytics.track({ name: 'timer_paused' });
      } else {
        // Starting/resuming: record wall-clock anchor
        startTimestampRef.current = Date.now();
        startTimeLeftRef.current = timeLeft;
        analytics.track({ name: 'timer_started' });
      }
      return !prev;
    });
  }, [timeLeft]);

  const reset = useCallback(() => {
    setIsRunning(false);
    startTimestampRef.current = null;
    setMode('work');
    setTimeLeft(workTime * 60);
    completedSessionsRef.current = 0;
    analytics.track({ name: 'timer_reset' });
  }, [workTime]);

  // Complete work session early — record actual elapsed time and move to break
  const completeEarly = useCallback(() => {
    if (mode !== 'work') return;
    const elapsed = workTime * 60 - timeLeft;
    if (elapsed <= 0) return;

    setIsRunning(false);
    startTimestampRef.current = null;

    const session: PomodoroSession = {
      date: new Date().toISOString(),
      duration: elapsed,
      label: activeLabel ?? undefined,
      note: activeNote || undefined,
    };
    onSessionComplete(session);
    analytics.track({ name: 'session_completed_early', properties: { duration: Math.round(elapsed / 60) } });

    completedSessionsRef.current += 1;

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
  }, [mode, workTime, timeLeft, breakTime, longBreakTime, longBreakInterval, activeLabel, activeNote, onSessionComplete]);

  return { timeLeft, isRunning, mode, toggle, reset, completeEarly };
}
