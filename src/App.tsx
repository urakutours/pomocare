import { useMemo, useState, useCallback, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeatureProvider } from '@/contexts/FeatureContext';
import { I18nProvider, useI18n } from '@/contexts/I18nContext';
import { createStorageService } from '@/services/storage';
import { useSettings } from '@/hooks/useSettings';
import { useSessions } from '@/hooks/useSessions';
import { useTimer } from '@/hooks/useTimer';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { InstallBanner } from '@/components/layout/InstallBanner';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { TimerControls } from '@/components/timer/TimerControls';
import { FocusMode } from '@/components/timer/FocusMode';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { WeeklyChart } from '@/components/stats/WeeklyChart';
import { SessionSummary } from '@/components/stats/SessionSummary';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';
import notificationSound from '@/assets/notification.wav';

interface PomodoroAppProps {
  storage: StorageService;
  settings: PomodoroSettings;
  updateSettings: (settings: PomodoroSettings) => void;
}

function PomodoroApp({ storage, settings, updateSettings }: PomodoroAppProps) {
  const { t } = useI18n();
  const { addSession, getTodayCount, getWeekCount, getWeekData } = useSessions(storage, t.days);

  const onSessionComplete = useCallback(
    (session: PomodoroSession) => {
      addSession(session);
    },
    [addSession],
  );

  const { timeLeft, isRunning, mode, toggle, reset, audioRef } = useTimer({
    workTime: settings.workTime,
    breakTime: settings.breakTime,
    onSessionComplete,
  });

  const [view, setView] = useState<'timer' | 'settings' | 'stats'>('timer');

  const handleSaveSettings = (newSettings: PomodoroSettings) => {
    updateSettings(newSettings);
    setView('timer');
    reset();
  };

  const handleFocusStop = () => {
    toggle();
  };

  const displayMessage = settings.customMessage || t.defaultCustomMessage;

  // Focus mode: running + work mode → minimal UI
  const isFocusMode = isRunning && mode === 'work';

  if (isFocusMode) {
    return (
      <>
        <FocusMode timeLeft={timeLeft} onStop={handleFocusStop} />
        <audio ref={audioRef} src={notificationSound} />
      </>
    );
  }

  return (
    <AppShell
      header={
        <Header
          onLogoClick={() => setView('timer')}
          onStatsClick={() => setView('stats')}
          onSettingsClick={() => setView('settings')}
        />
      }
    >
      {view === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setView('timer')}
        />
      )}

      {view === 'stats' && (
        <WeeklyChart
          getWeekData={getWeekData}
          onClose={() => setView('timer')}
        />
      )}

      {view === 'timer' && (
        <div className="landscape:flex landscape:items-center landscape:gap-8">
          <div className="landscape:flex-1">
            <TimerDisplay timeLeft={timeLeft} mode={mode} />
            <TimerControls isRunning={isRunning} onToggle={toggle} onReset={reset} />
          </div>
          <div className="landscape:flex-1">
            <SessionSummary todayCount={getTodayCount()} weekCount={getWeekCount()} />
            <div className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
              {displayMessage}
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} src={notificationSound} />
    </AppShell>
  );
}

function AppWithI18n() {
  const storage = useMemo(() => createStorageService(), []);
  const { settings, updateSettings, isLoaded } = useSettings(storage);

  // Apply theme class to document
  useEffect(() => {
    const theme = settings.theme ?? 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Update theme-color meta tag for PWA titlebar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#333333' : '#0abab5');
    }
  }, [settings.theme]);

  if (!isLoaded) return null;

  return (
    <I18nProvider language={settings.language}>
      <InstallBanner />
      <PomodoroApp
        storage={storage}
        settings={settings}
        updateSettings={updateSettings}
      />
    </I18nProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FeatureProvider>
        <AppWithI18n />
      </FeatureProvider>
    </AuthProvider>
  );
}
