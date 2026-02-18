import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import type { PomodoroSession, LabelDefinition } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';

interface PomodoroAppProps {
  storage: StorageService;
  settings: PomodoroSettings;
  updateSettings: (settings: PomodoroSettings) => void;
}

// ---- Inline label creator (shown from TOP screen) ----
const QUICK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#0abab5', '#3b82f6',
  '#8b5cf6', '#ec4899', '#d946ef', '#64748b',
];

function InlineLabelCreator({
  onAdd,
  onClose,
  addNewLabel,
}: {
  onAdd: (label: LabelDefinition) => void;
  onClose: () => void;
  addNewLabel: string;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(QUICK_COLORS[6]); // tiffany default
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ id: Date.now().toString(36), name: trimmed, color });
    setName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
      <div className="flex gap-2 mb-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={addNewLabel.replace('+ ', '')}
          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-3 py-1.5 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg disabled:opacity-40 transition-colors"
        >
          ＋
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 scale-110' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
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

  // Active label & note state
  const [activeLabel, setActiveLabel] = useState<string | null>(settings.activeLabel ?? null);
  const [activeNote, setActiveNote] = useState('');
  const [showLabelCreator, setShowLabelCreator] = useState(false);

  // Local labels (keep in sync with settings when settings change)
  const [labels, setLabels] = useState<LabelDefinition[]>(settings.labels ?? []);
  useEffect(() => {
    setLabels(settings.labels ?? []);
  }, [settings.labels]);

  const onSessionComplete = useCallback(
    (session: PomodoroSession) => {
      addSession(session);
      // Clear note after session completes
      setActiveNote('');
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
    activeNote,
    onSessionComplete,
  });

  const [view, setView] = useState<'timer' | 'settings' | 'stats'>('timer');

  const handleSaveSettings = (newSettings: PomodoroSettings) => {
    updateSettings({ ...newSettings, activeLabel });
    setLabels(newSettings.labels ?? []);
    setView('timer');
    reset();
  };

  const handleFocusStop = () => {
    toggle();
  };

  // Add a new label inline from the TOP screen
  const handleAddLabelInline = (label: LabelDefinition) => {
    const updatedLabels = [...labels, label];
    setLabels(updatedLabels);
    // Persist to settings
    updateSettings({ ...settings, labels: updatedLabels, activeLabel });
    setActiveLabel(label.id);
    setShowLabelCreator(false);
  };

  const displayMessage = settings.customMessage || t.defaultCustomMessage;

  // Focus mode: running + work mode → minimal UI
  const isFocusMode = isRunning && mode === 'work';

  if (isFocusMode) {
    return <FocusMode timeLeft={timeLeft} onStop={handleFocusStop} />;
  }

  // Active label definition
  const activeLabelDef = labels.find((l) => l.id === activeLabel) ?? null;

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
          settings={{ ...settings, activeLabel, labels }}
          onSave={handleSaveSettings}
          onClose={() => setView('timer')}
        />
      )}

      {view === 'stats' && (
        <StatsChart
          sessions={sessions}
          labels={labels}
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

            {/* Label dropdown + memo */}
            <div className="mt-4 space-y-2">
              {/* Dropdown row */}
              <div className="flex gap-2 items-center justify-center">
                <div className="relative flex-1 max-w-xs">
                  {/* Color dot indicator */}
                  {activeLabelDef && (
                    <span
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                      style={{ backgroundColor: activeLabelDef.color }}
                    />
                  )}
                  <select
                    value={activeLabel ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__new__') {
                        setShowLabelCreator(true);
                      } else {
                        setActiveLabel(val === '' ? null : val);
                        setShowLabelCreator(false);
                      }
                    }}
                    className={`w-full py-1.5 pr-3 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 appearance-none ${activeLabelDef ? 'pl-7' : 'pl-3'}`}
                  >
                    <option value="">{t.labelSelectPlaceholder}</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                    <option value="__new__">{t.addNewLabel}</option>
                  </select>
                  {/* Custom chevron */}
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </div>
              </div>

              {/* Inline label creator */}
              {showLabelCreator && (
                <InlineLabelCreator
                  onAdd={handleAddLabelInline}
                  onClose={() => setShowLabelCreator(false)}
                  addNewLabel={t.addNewLabel}
                />
              )}

              {/* Task memo input (shown when a label is selected) */}
              {activeLabel && !showLabelCreator && (
                <textarea
                  value={activeNote}
                  onChange={(e) => setActiveNote(e.target.value)}
                  placeholder={t.labelNotePlaceholder}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 resize-none"
                />
              )}
            </div>

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
