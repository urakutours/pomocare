import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerMode } from '@/types/timer';
import type { PomodoroSession } from '@/types/session';
import type { AlarmSettings } from '@/types/settings';
import { analytics } from '@/services/analytics/AnalyticsService';
import { unlockAudio, tryResumeAudio, stopAlarm, deactivateTouchStopListener, notifyAlarmRinging } from '@/utils/alarm';
import { isNative } from '@/utils/platform';
import { alarmScheduler, WebAlarmScheduler } from '@/utils/alarmScheduler';
// fix5(i): Capacitor App state — document.visibilityState は WebView で前面でも 'hidden' を返す場合がある
import { App } from '@capacitor/app';
// fix9 (B-3 / C): delivered 通知クリア用
import { LocalNotifications } from '@capacitor/local-notifications';

interface UseTimerOptions {
  workTime: number;
  breakTime: number;
  longBreakTime: number;      // 0 = disabled
  longBreakInterval: number;  // 0 = disabled, else trigger every N completed work sessions
  alarm: AlarmSettings;
  activeLabel: string | null;
  activeNote: string;
  onSessionComplete: (session: PomodoroSession) => void;
  onNotify?: (title: string, body: string) => void;
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
  onNotify,
}: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(workTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  // Count of completed work sessions (used to trigger long break)
  const completedSessionsRef = useRef(0);

  // Wall-clock tracking: when the timer was started/resumed and how much time was left at that point
  const startTimestampRef = useRef<number | null>(null);
  const startTimeLeftRef = useRef<number>(workTime * 60);

  // alarmFiredRef: Web timeout 経由でアラームが発火した場合のダブル発火防止フラグ
  const alarmFiredRef = useRef(false);

  // fix5(i): Capacitor App の isActive 状態を Ref で保持する。
  // document.visibilityState は Capacitor WebView で前面でも 'hidden' を返す場合があり信頼できない。
  // App.addListener('appStateChange') で最新の isActive を常に追跡する。
  // 初期値: true（アプリ起動直後は前面前提）。Web では使わないが Ref は必ず初期化する。
  const appIsActiveRef = useRef<boolean>(true);

  const clearAlarmTimeout = useCallback(() => {
    alarmFiredRef.current = false;
    void alarmScheduler.cancel();
  }, []);

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

  // fix5(i): Capacitor App.getState() で初期値を取得し、
  // appStateChange リスナーで isActive を常に最新に保つ。
  // Web では isNative() === false のため早期リターン。
  useEffect(() => {
    if (!isNative()) return;

    // 初期状態を取得（アプリ起動直後は true が期待値だが念のため同期）
    void App.getState().then((state) => {
      appIsActiveRef.current = state.isActive;
    });

    // アプリの前面/背景遷移を追跡
    const listenerPromise = App.addListener('appStateChange', (state) => {
      appIsActiveRef.current = state.isActive;
      // 前面復帰時は AudioContext も resume する
      if (state.isActive) {
        tryResumeAudio();

        // fix9 (B-3): 前面復帰時に delivered 通知をトレイからクリアする
        void LocalNotifications.removeAllDeliveredNotifications().catch(() => { /* ignore */ });

        // fix9 (C): 画面オフ中にアラームが発火していた場合、overlay を mount して dismiss surface を提供する。
        // wall-clock で「残り時間を使い果たした」かを判定する。
        // startTimestampRef.current !== null かつ経過 >= startTimeLeftRef.current ならアラーム発火済み。
        if (startTimestampRef.current !== null) {
          const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000);
          if (elapsed >= startTimeLeftRef.current) {
            // アラームが発火済み → overlay mount
            notifyAlarmRinging(true);
            // auto-unmount: OS 通知音が止まっても画面を恒久ブロックしないようにする (~31s + 余裕)
            setTimeout(() => {
              notifyAlarmRinging(false);
            }, 35000);
          }
        }
      }
    });

    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
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

      // P0 fix: 完了分岐では alarmScheduler.cancel() を呼ばない。
      // clearAlarmTimeout() は cancel() を内包するため、ここで呼ぶと
      // OS が発火した直後（~1.3s 後）の通知（長尺音 30.8s）を kill してしまう。
      // alarmFiredRef は false に戻すだけにとどめる。
      // cancel が必要な経路（pause / reset / completeEarly / unmount）は別途 clearAlarmTimeout() を呼ぶ。
      alarmFiredRef.current = false;

      // T2d: fix2 — 背景時は alarmScheduler.cancel() を呼ばない。
      // 終了時刻に cancel() を呼ぶと OS が通知を配信する直前に cancel が届き、
      // 発火前に通知がキャンセルされる race condition が発生する。
      //
      // fix3 Issue-A: アプリが前面/可視 (document.visibilityState === 'visible') なら
      // native でも in-app 音を即時再生し（遅延ゼロ）、pending OS 通知を cancel する。
      // 背景（不可視）なら従来どおり OS 通知に委ねる。

      // fix5(i): 前面判定を document.visibilityState から Capacitor App.isActive に切替え。
      // fix6 変更B: native 前面でも予約済み OS 通知がそのまま発火する（in-app 音は呼ばない）。
      // Web は alarmScheduler(WebAlarmScheduler) の setTimeout が発火して in-app 音を再生する。
      if (isNative() && appIsActiveRef.current) {
        // Android 前面: OS 通知がそのまま発火。AlarmOverlay を mount して dismiss surface を提供する。
        notifyAlarmRinging(true);
        // auto-unmount: OS 通知音が止まっても画面を恒久ブロックしないように (~31s + 余裕)
        setTimeout(() => {
          notifyAlarmRinging(false);
        }, 35000);
      }
      // Web: alarmScheduler(WebAlarmScheduler) の setTimeout が発火済み or まもなく発火する
      // 背景 native: OS 通知に委ねる（fix2 挙動を維持）

      // Fire OS notification via Service Worker (web only — native uses LocalNotifications).
      // Background tabs with permission can still raise OS notifications via reg.showNotification.
      if (!isNative()) {
        onNotify?.('Timer Complete', 'PomoCare');
      }

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
  }, [isRunning, timeLeft, mode, workTime, breakTime, longBreakTime, longBreakInterval, alarm, activeLabel, activeNote, onSessionComplete, onNotify, clearAlarmTimeout]);

  const toggle = useCallback(() => {
    // Unlock audio on every user tap so mobile browsers allow later playback
    unlockAudio();

    setIsRunning((prev) => {
      if (prev) {
        // Pausing: clear wall-clock tracking and cancel scheduler
        startTimestampRef.current = null;
        clearAlarmTimeout();
        // fix3 Issue-C: 再生中の前面アラームがあれば停止
        stopAlarm();
        deactivateTouchStopListener();
        analytics.track({ name: 'timer_paused' });
      } else {
        // Starting/resuming: record wall-clock anchor, schedule alarm
        startTimestampRef.current = Date.now();
        startTimeLeftRef.current = timeLeft;

        // Web: params を先にバインドしてから schedule
        if (!isNative() && alarmScheduler instanceof WebAlarmScheduler) {
          alarmScheduler.setParams({
            volume: alarm.volume ?? 80,
            repeat: alarm.repeat ?? 1,
            vibration: alarm.vibration ?? 'off',
          });
        }
        void alarmScheduler.schedule(Date.now() + timeLeft * 1000, alarm.sound);
        analytics.track({ name: 'timer_started' });
      }
      return !prev;
    });
  }, [timeLeft, alarm, clearAlarmTimeout]);

  const reset = useCallback(() => {
    setIsRunning(false);
    startTimestampRef.current = null;
    clearAlarmTimeout();
    stopAlarm();
    deactivateTouchStopListener();
    setMode('work');
    setTimeLeft(workTime * 60);
    completedSessionsRef.current = 0;
    analytics.track({ name: 'timer_reset' });
  }, [workTime, clearAlarmTimeout]);

  // Complete work session early — record actual elapsed time and move to break
  const completeEarly = useCallback(() => {
    if (mode !== 'work') return;
    const elapsed = workTime * 60 - timeLeft;
    if (elapsed <= 0) return;

    setIsRunning(false);
    startTimestampRef.current = null;
    clearAlarmTimeout();
    stopAlarm();
    deactivateTouchStopListener();

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
  }, [mode, workTime, timeLeft, breakTime, longBreakTime, longBreakInterval, activeLabel, activeNote, onSessionComplete, clearAlarmTimeout]);

  // Cleanup on unmount: clear any pending web timeout and native LocalNotification
  useEffect(() => {
    return () => {
      clearAlarmTimeout();
      // fix3 Issue-C: アンマウント時も再生中音を停止
      stopAlarm();
      deactivateTouchStopListener();
    };
  }, [clearAlarmTimeout]);

  return { timeLeft, isRunning, mode, toggle, reset, completeEarly };
}
