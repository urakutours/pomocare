import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerMode } from '@/types/timer';
import type { PomodoroSession } from '@/types/session';
import type { AlarmSettings } from '@/types/settings';
import { analytics } from '@/services/analytics/AnalyticsService';
import { playAlarm, unlockAudio, tryResumeAudio, scheduleNativeAlarm, cancelNativeAlarm } from '@/utils/alarm';
import { isNative } from '@/utils/platform';

interface UseTimerOptions {
  workTime: number;
  breakTime: number;
  longBreakTime: number;      // 0 = disabled
  longBreakInterval: number;  // 0 = disabled, else trigger every N completed work sessions
  alarm: AlarmSettings;
  activeLabel: string | null;
  activeNote: string;
  onSessionComplete: (session: PomodoroSession) => void;
  onSchedulePush?: (fireAt: number) => void;
  onCancelPush?: () => void;
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
  onSchedulePush,
  onCancelPush,
}: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(workTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  // Count of completed work sessions (used to trigger long break)
  const completedSessionsRef = useRef(0);

  // Wall-clock tracking: when the timer was started/resumed and how much time was left at that point
  const startTimestampRef = useRef<number | null>(null);
  const startTimeLeftRef = useRef<number>(workTime * 60);

  // Backup setTimeout that fires playAlarm at the exact end time.
  // Unlike setInterval (throttled/killed when screen is off), a single
  // setTimeout is registered as an OS-level alarm on Android Chrome and
  // has a much higher chance of firing even with the screen off.
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmFiredRef = useRef(false);

  // Native (Capacitor) LocalNotification ID — scheduled at timer start,
  // fires even if the app is killed. -1 = no native alarm scheduled.
  const nativeAlarmIdRef = useRef<number>(-1);

  const clearAlarmTimeout = useCallback(() => {
    if (alarmTimeoutRef.current !== null) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    alarmFiredRef.current = false;
    // Cancel any pending native LocalNotification
    if (nativeAlarmIdRef.current >= 0) {
      void cancelNativeAlarm(nativeAlarmIdRef.current);
      nativeAlarmIdRef.current = -1;
    }
  }, []);

  const scheduleAlarmTimeout = useCallback(
    (delayMs: number) => {
      clearAlarmTimeout();
      alarmTimeoutRef.current = setTimeout(() => {
        // Guard: only fire if still running and alarm hasn't been handled by the regular tick
        if (startTimestampRef.current !== null && !alarmFiredRef.current) {
          alarmFiredRef.current = true;
          playAlarm(alarm.sound, alarm.repeat, alarm.volume ?? 80, alarm.vibration ?? 'silent', alarm.channel ?? 'media');
        }
      }, delayMs);
    },
    [alarm, clearAlarmTimeout],
  );

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
      if (document.visibilityState === 'visible') {
        // Try to resume AudioContext on foreground return (helps iOS)
        tryResumeAudio();

        if (startTimestampRef.current !== null) {
          const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000);
          const remaining = Math.max(0, startTimeLeftRef.current - elapsed);
          setTimeLeft(remaining);
        }
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

      // Cancel any pending push (may have already fired, but cancel to be safe)
      onCancelPush?.();
      clearAlarmTimeout();

      // Play alarm (skip if the backup setTimeout already fired it)
      if (!alarmFiredRef.current) {
        playAlarm(alarm.sound, alarm.repeat, alarm.volume ?? 80, alarm.vibration ?? 'silent', alarm.channel ?? 'media');
      }
      alarmFiredRef.current = false;

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
        clearAlarmTimeout();
        onCancelPush?.();
        analytics.track({ name: 'timer_paused' });
      } else {
        // Starting/resuming: record wall-clock anchor
        startTimestampRef.current = Date.now();
        startTimeLeftRef.current = timeLeft;
        scheduleAlarmTimeout(timeLeft * 1000);

        // On native platforms, also register an OS-level LocalNotification
        // that fires even if the app is fully killed.
        if (isNative()) {
          void scheduleNativeAlarm(
            Date.now() + timeLeft * 1000,
            alarm.sound,
          ).then((id) => {
            nativeAlarmIdRef.current = id;
          });
        } else {
          // Web: server-side push notification (for logged-in users)
          onSchedulePush?.(Date.now() + timeLeft * 1000);
        }
        analytics.track({ name: 'timer_started' });
      }
      return !prev;
    });
  }, [timeLeft, alarm, scheduleAlarmTimeout, clearAlarmTimeout, onSchedulePush, onCancelPush]);

  const reset = useCallback(() => {
    setIsRunning(false);
    startTimestampRef.current = null;
    clearAlarmTimeout();
    onCancelPush?.();
    setMode('work');
    setTimeLeft(workTime * 60);
    completedSessionsRef.current = 0;
    analytics.track({ name: 'timer_reset' });
  }, [workTime, clearAlarmTimeout, onCancelPush]);

  // Complete work session early — record actual elapsed time and move to break
  const completeEarly = useCallback(() => {
    if (mode !== 'work') return;
    const elapsed = workTime * 60 - timeLeft;
    if (elapsed <= 0) return;

    setIsRunning(false);
    startTimestampRef.current = null;
    clearAlarmTimeout();
    onCancelPush?.();

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
  }, [mode, workTime, timeLeft, breakTime, longBreakTime, longBreakInterval, activeLabel, activeNote, onSessionComplete, clearAlarmTimeout, onCancelPush]);

  // Cleanup on unmount: clear any pending web timeout and native LocalNotification
  useEffect(() => {
    return () => {
      clearAlarmTimeout();
    };
  }, [clearAlarmTimeout]);

  return { timeLeft, isRunning, mode, toggle, reset, completeEarly };
}
