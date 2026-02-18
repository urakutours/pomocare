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
import { StatsChart } from '@/components/stats/StatsChart';
import { SessionSummary } from '@/components/stats/SessionSummary';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';

interface PomodoroAppProps {
  storage: StorageService;
  settings: PomodoroSettings;
  updateSettings: (settings: PomodoroSettings) => void;
}

function PomodoroApp({ storage, settings, updateSettings }: PomodoroAppProps) {
  const { t } = useI18n();
  const {
    sessions,
    addSession,
    getTodayCount,
    getTodayTotalSeconds,
    getWeekCount,
    getWeekTotalSeconds,
    getWeekData,
    getMonthData,
    getYearData,
  } = useSessions(storage, t.days);

  // Active label state
  const [activeLabel, setActiveLabel] = useState<string | null>(settings.activeLabel ?? null);

  const onSessionComplete = useCallback(
    (session: PomodoroSession) => {
      addSession(session);
    },
    [addSession],
  );

  const { timeLeft, isRunning, mode, toggle, reset } = useTimer({
    workTime: settings.workTime,
    breakTime: settings.breakTime,
    longBreakTime: settings.longBreakTime ?? 0,
    longBreakInterval: settings.longBreakInterval ?? 0,
    alarm: settings.alarm ?? { sound: 'bell', repeat: 1 },
    activeLabel,
    onSessionComplete,
  });

  const [view, setView] = useState<'timer' | 'settings' | 'stats'>('timer');

  const handleSaveSettings = (newSettings: PomodoroSettings) => {
    updateSettings({ ...newSettings, activeLabel });
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
    return <FocusMode timeLeft={timeLeft} onStop={handleFocusStop} />;
  }

  const labels = settings.labels ?? [];

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
          settings={{ ...settings, activeLabel }}
          onSave={handleSaveSettings}
          onClose={() => setView('timer')}
        />
      )}

      {view === 'stats' && (
        <StatsChart
          sessions={sessions}
          getWeekData={getWeekData}
          getMonthData={getMonthData}
          getYearData={getYearData}
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
            <SessionSummary
              todayCount={getTodayCount()}
              weekCount={getWeekCount()}
              todayTotalSeconds={getTodayTotalSeconds()}
              weekTotalSeconds={getWeekTotalSeconds()}
            />

            {/* Label selector */}
            {labels.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                <button
                  onClick={() => setActiveLabel(null)}
                  className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                    activeLabel === null
                      ? 'border-tiffany bg-tiffany text-white'
                      : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  {t.noLabel}
                </button>
                {labels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLabel(l.id)}
                    className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                      activeLabel === l.id
                        ? 'text-white border-transparent'
                        : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700'
                    }`}
                    style={activeLabel === l.id ? { backgroundColor: l.color } : undefined}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}

            <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
              {displayMessage}
            </div>
          </div>
        </div>
      )}
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
