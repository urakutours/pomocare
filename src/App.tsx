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
import { BreakMode } from '@/components/timer/BreakMode';
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

// ---- Quick label creator modal (shown from TOP screen) ----
const QUICK_COLORS = [
  '#F4A7A0', '#F28B7D', '#F4A0C0', '#E87DA8',
  '#B8A4D8', '#9B87C4', '#A4BAE8', '#7FA0D8',
  '#7FD4CC', '#4DB8B0', '#0abab5', '#2A9C94',
  '#A0D4A0', '#5AAA5A', '#F4D48A', '#E8BC5A',
  '#F4B07A', '#E8904A', '#C0B8B0', '#808070',
];

function QuickLabelModal({
  onAdd,
  onClose,
  addNewLabel,
}: {
  onAdd: (label: LabelDefinition) => void;
  onClose: () => void;
  addNewLabel: string;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(QUICK_COLORS[10]); // tiffany default
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ id: Date.now().toString(36), name: trimmed, color });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-5 w-72 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{addNewLabel.replace('+ ', '')}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ラベル名"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 mb-3"
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-transform flex-shrink-0 ${color === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          {/* Custom color */}
          <button
            onClick={() => colorInputRef.current?.click()}
            className="w-5 h-5 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center hover:border-tiffany transition-colors flex-shrink-0"
            style={!QUICK_COLORS.includes(color) ? { backgroundColor: color, borderStyle: 'solid' } : {}}
          >
            {QUICK_COLORS.includes(color) && <span className="text-gray-400 text-xs leading-none">+</span>}
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="sr-only"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="mt-4 w-full py-2 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg disabled:opacity-40 transition-colors"
        >
          追加
        </button>
      </div>
    </div>
  );
}

// ---- Custom label selector with color dots ----
function LabelSelect({
  labels,
  value,
  placeholder,
  addNewLabel,
  onChange,
}: {
  labels: LabelDefinition[];
  value: string | null;
  placeholder: string;
  addNewLabel: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = labels.find((l) => l.id === value) ?? null;

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-left focus:outline-none focus:ring-2 focus:ring-tiffany"
      >
        {selected ? (
          <>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-40 w-full mt-1 bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg overflow-hidden">
          {/* No label option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-600 ${!value ? 'bg-tiffany/10' : ''}`}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300 dark:border-neutral-500" />
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          </button>

          {/* Label options */}
          {labels.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => { onChange(l.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-600 ${value === l.id ? 'bg-tiffany/10' : ''}`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: l.color }}
              />
              <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{l.name}</span>
              {value === l.id && (
                <svg className="w-3.5 h-3.5 text-tiffany flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}

          {/* Add new label */}
          <button
            type="button"
            onClick={() => { onChange('__new__'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-tiffany hover:bg-tiffany/5 border-t border-gray-100 dark:border-neutral-600"
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-dashed border-tiffany flex items-center justify-center">
            </span>
            <span>{addNewLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function PomodoroApp({ storage, settings, updateSettings }: PomodoroAppProps) {
  const { t } = useI18n();
  const {
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

  // Persist activeLabel to settings whenever it changes
  const prevActiveLabelRef = useRef(activeLabel);
  useEffect(() => {
    if (prevActiveLabelRef.current !== activeLabel) {
      prevActiveLabelRef.current = activeLabel;
      updateSettings({ ...settings, activeLabel });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLabel]);

  const onSessionComplete = useCallback(
    (session: PomodoroSession) => {
      addSession(session);
      // Clear note after session completes
      setActiveNote('');
    },
    [addSession],
  );

  const { timeLeft, isRunning, mode, toggle, reset, completeEarly } = useTimer({
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

  const handleClearAll = async () => {
    await storage.clearAll();
    window.location.reload();
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

  // Focus mode: running + work mode → minimal UI (no header)
  const isFocusMode = isRunning && mode === 'work';

  // Paused mid-session: timer was started but user pressed stop (not reset)
  const isPaused = !isRunning && mode === 'work' && timeLeft < settings.workTime * 60;

  // Both running and paused mid-session use the same full-screen FocusMode layout
  if (isFocusMode || isPaused) {
    return (
      <FocusMode
        timeLeft={timeLeft}
        isRunning={isRunning}
        onStop={handleFocusStop}
        onResume={toggle}
        onComplete={completeEarly}
        onReset={reset}
      />
    );
  }

  // Break mode: break/longBreak (running or paused) → header + minimal break UI
  const isBreakMode = mode === 'break' || mode === 'longBreak';

  if (isBreakMode) {
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
            onClearAll={handleClearAll}
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
          <BreakMode
            timeLeft={timeLeft}
            mode={mode}
            isRunning={isRunning}
            onToggle={toggle}
            onReset={reset}
            displayMessage={displayMessage}
          />
        )}
      </AppShell>
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
          settings={{ ...settings, activeLabel, labels }}
          onSave={handleSaveSettings}
          onClose={() => setView('timer')}
          onClearAll={handleClearAll}
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
              sessions={sessions}
              labels={labels}
              onUpdateSession={updateSession}
              onDeleteSession={deleteSession}
            />

            {/* Label dropdown + memo */}
            <div className="mt-4 space-y-2 flex flex-col items-center">
              {/* Custom label selector with color dots */}
              <LabelSelect
                labels={labels}
                value={activeLabel}
                placeholder={t.labelSelectPlaceholder}
                addNewLabel={t.addNewLabel}
                onChange={(val) => {
                  if (val === '__new__') {
                    setShowLabelCreator(true);
                  } else {
                    setActiveLabel(val === '' ? null : val);
                  }
                }}
              />

              {/* Task memo input (same width as dropdown) */}
              {activeLabel && (
                <textarea
                  value={activeNote}
                  onChange={(e) => setActiveNote(e.target.value)}
                  placeholder={t.labelNotePlaceholder}
                  rows={2}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 resize-none"
                />
              )}
            </div>

            {/* New label modal */}
            {showLabelCreator && (
              <QuickLabelModal
                onAdd={handleAddLabelInline}
                onClose={() => setShowLabelCreator(false)}
                addNewLabel={t.addNewLabel}
              />
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
