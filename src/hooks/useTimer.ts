import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerMode } from '@/types/timer';
import type { PomodoroSession } from '@/types/session';
import { analytics } from '@/services/analytics/AnalyticsService';

interface UseTimerOptions {
  workTime: number;
  breakTime: number;
  onSessionComplete: (session: PomodoroSession) => void;
}

export function useTimer({ workTime, breakTime, onSessionComplete }: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(workTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

      if (audioRef.current) {
        audioRef.current.play();
      }

      if (mode === 'work') {
        const session: PomodoroSession = {
          date: new Date().toISOString(),
          duration: workTime * 60,
        };
        onSessionComplete(session);
        analytics.track({ name: 'session_completed', properties: { duration: workTime } });

        if (breakTime > 0) {
          setMode('break');
          setTimeLeft(breakTime * 60);
        } else {
          setTimeLeft(workTime * 60);
        }
      } else {
        setMode('work');
        setTimeLeft(workTime * 60);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, workTime, breakTime, onSessionComplete]);

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
    analytics.track({ name: 'timer_reset' });
  }, [workTime]);

  return { timeLeft, isRunning, mode, toggle, reset, audioRef };
}
