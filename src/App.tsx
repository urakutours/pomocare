import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeatureProvider, useFeatures } from '@/contexts/FeatureContext';
import { I18nProvider, useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { createStorageService, createSupabaseStorageService, LocalStorageAdapter } from '@/services/storage';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { PaymentSuccessToast } from '@/components/shared/PaymentSuccessToast';
import { AdBanner } from '@/components/ads/AdBanner';
import type { CheckoutPlan } from '@/services/stripe/StripeService';
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
import { SettingsPanel, ColorPicker } from '@/components/settings/SettingsPanel';
import { StatsChart } from '@/components/stats/StatsChart';
import { SessionSummary } from '@/components/stats/SessionSummary';
import { EmailActionHandler } from '@/components/auth/EmailActionHandler';
import type { PomodoroSession, LabelDefinition } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';
import { LABEL_COLORS } from '@/config/colors';

interface PomodoroAppProps {
  storage: StorageService;
  settings: PomodoroSettings;
  updateSettings: (settings: PomodoroSettings) => void;
}

// ---- Quick label creator modal (shown from TOP screen) ----

export function QuickLabelModal({
  onAdd,
  onClose,
  addNewLabel,
  labelNamePlaceholder,
  addButtonText,
  initialName,
  initialColor,
  initialDuration,
  editId,
  title,
  buttonText,
  customColors,
  onRegisterColor,
  onChangeCustomColor,
  onDeleteCustomColor,
}: {
  onAdd: (label: LabelDefinition) => void;
  onClose: () => void;
  addNewLabel: string;
  labelNamePlaceholder: string;
  addButtonText: string;
  /** 編集モード用: 初期ラベル名 */
  initialName?: string;
  /** 編集モード用: 初期カラー */
  initialColor?: string;
  /** 編集モード用: 初期タイマー時間 */
  initialDuration?: number;
  /** 編集モード用: 既存ラベルID（指定時は新規IDを生成しない） */
  editId?: string;
  /** モーダルタイトル上書き */
  title?: string;
  /** ボタンテキスト上書き */
  buttonText?: string;
  customColors?: string[];
  onRegisterColor?: (color: string) => void;
  onChangeCustomColor?: (oldColor: string, newColor: string) => void;
  onDeleteCustomColor?: (color: string) => void;
}) {
  const { t } = useI18n();
  const DURATION_PRESETS = [5, 10, 15, 20, 30];
  const [name, setName] = useState(initialName ?? '');
  const [color, setColor] = useState(initialColor ?? LABEL_COLORS[10]);
  const [duration, setDuration] = useState<number | undefined>(initialDuration);
  const [isCustomDuration, setIsCustomDuration] = useState(
    initialDuration !== undefined && !DURATION_PRESETS.includes(initialDuration),
  );
  const [customDurationStr, setCustomDurationStr] = useState(
    initialDuration !== undefined ? String(initialDuration) : '',
  );
  const unit = t.activeTimeLabel.includes('分') ? '分' : 'min';

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ id: editId ?? Date.now().toString(36), name: trimmed, color, duration });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') onClose();
  };

  const handleDurationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setIsCustomDuration(false);
      setDuration(undefined);
    } else if (val === '__custom__') {
      setIsCustomDuration(true);
      setCustomDurationStr(duration !== undefined ? String(duration) : '');
    } else {
      setIsCustomDuration(false);
      setDuration(Number(val));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-5 w-72 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{title ?? addNewLabel.replace('+ ', '')}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={labelNamePlaceholder}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 mb-3"
        />
        <ColorPicker
          value={color}
          onChange={setColor}
          customColors={customColors}
          onRegisterColor={onRegisterColor}
          onChangeCustomColor={onChangeCustomColor}
          onDeleteCustomColor={onDeleteCustomColor}
        />
        {/* Duration selector with custom input */}
        <div className="mt-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.labelDuration}</label>
          <div className="flex gap-2">
            <select
              value={isCustomDuration ? '__custom__' : (duration ?? '')}
              onChange={handleDurationSelect}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 bg-white"
            >
              <option value="">{t.labelDurationNone}</option>
              {DURATION_PRESETS.map((m) => (
                <option key={m} value={m}>{m}{unit}</option>
              ))}
              <option value="__custom__">{t.customInput}</option>
            </select>
            {isCustomDuration && (
              <input
                autoFocus
                type="number"
                value={customDurationStr}
                onChange={(e) => {
                  setCustomDurationStr(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed > 0) setDuration(parsed);
                }}
                onBlur={() => {
                  const parsed = parseInt(customDurationStr, 10);
                  if (isNaN(parsed) || parsed <= 0) {
                    setIsCustomDuration(false);
                    setDuration(undefined);
                  }
                }}
                min={1}
                placeholder={unit}
                className="w-20 px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200"
              />
            )}
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="mt-4 w-full py-2 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg disabled:opacity-40 transition-colors"
        >
          {buttonText ?? addButtonText}
        </button>
      </div>
    </div>
  );
}

// ---- Custom label selector with color dots (portal-based modal) ----
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(() => labels.find((l) => l.id === value) ?? null, [labels, value]);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const maxH = Math.min(window.innerHeight * 0.7, Math.max(spaceBelow, spaceAbove));
      const openBelow = spaceBelow >= spaceAbove;
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: `${maxH}px`,
        ...(openBelow
          ? { top: rect.bottom + 4 }
          : { bottom: window.innerHeight - rect.top + 4 }),
      });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-left focus:outline-none focus:ring-2 focus:ring-tiffany"
      >
        {selected ? (
          <>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <span className="flex-1 truncate text-gray-700 dark:text-gray-200">
              {selected.name}
              {selected.duration != null && (
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{selected.duration}min</span>
              )}
            </span>
          </>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Portal-based dropdown: stays on screen, scrollable, max 70vh */}
      {open && createPortal(
        <>
          {/* Transparent backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onMouseDown={() => setOpen(false)}
          />
          {/* Dropdown panel */}
          <div
            style={dropdownStyle}
            className="bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* No label option */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-neutral-600 ${!value ? 'bg-tiffany/10' : ''}`}
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
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-neutral-600 ${value === l.id ? 'bg-tiffany/10' : ''}`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: l.color }}
                />
                <span className="flex-1 truncate text-gray-700 dark:text-gray-200">
                  {l.name}
                  {l.duration != null && (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{l.duration}min</span>
                  )}
                </span>
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
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-tiffany hover:bg-tiffany/5 border-t border-gray-100 dark:border-neutral-600"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-dashed border-tiffany flex items-center justify-center" />
              <span>{addNewLabel}</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function PomodoroApp({ storage, settings, updateSettings }: PomodoroAppProps) {
  const { t } = useI18n();
  const features = useFeatures();
  const [showUpgrade, setShowUpgrade] = useState(false);
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
    importSessions,
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

  // Effective work time: label's duration overrides global setting temporarily
  const effectiveWorkTime = useMemo(() => {
    if (activeLabel) {
      const lbl = labels.find((l) => l.id === activeLabel);
      if (lbl?.duration) return lbl.duration;
    }
    return settings.workTime;
  }, [activeLabel, labels, settings.workTime]);

  const onSessionComplete = useCallback(
    (session: PomodoroSession) => {
      addSession(session);
      // Clear note after session completes
      setActiveNote('');
    },
    [addSession],
  );

  const { timeLeft, isRunning, mode, toggle, reset, completeEarly } = useTimer({
    workTime: effectiveWorkTime,
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

  // Immediately persist labels without closing settings
  const handleSaveLabels = useCallback((newLabels: LabelDefinition[]) => {
    setLabels(newLabels);
    updateSettings({ ...settings, labels: newLabels, activeLabel });
  }, [settings, activeLabel, updateSettings]);

  const handleClearAll = async () => {
    await storage.clearAll();
    // 匿名 localStorage もクリア
    await new LocalStorageAdapter().clearAll();
    window.location.reload();
  };

  const handleFocusStop = () => {
    toggle();
  };

  // Add a new label inline from the TOP screen
  const handleAddLabelInline = (label: LabelDefinition) => {
    if (labels.length >= features.maxLabels) {
      setShowUpgrade(true);
      setShowLabelCreator(false);
      return;
    }
    const updatedLabels = [...labels, label];
    setLabels(updatedLabels);
    // Persist to settings
    updateSettings({ ...settings, labels: updatedLabels, activeLabel });
    setActiveLabel(label.id);
    setShowLabelCreator(false);
  };

  // Custom color handlers for inline label creator
  const customColors = settings.customColors ?? [];

  const handleRegisterCustomColor = useCallback((color: string) => {
    const updated = [...(settings.customColors ?? []), color];
    updateSettings({ ...settings, customColors: updated });
  }, [settings, updateSettings]);

  const handleChangeCustomColor = useCallback((oldColor: string, newColor: string) => {
    const updatedColors = (settings.customColors ?? []).map((c) => c === oldColor ? newColor : c);
    const updatedLabels = labels.map((l) => l.color === oldColor ? { ...l, color: newColor } : l);
    setLabels(updatedLabels);
    updateSettings({ ...settings, customColors: updatedColors, labels: updatedLabels });
  }, [settings, labels, updateSettings]);

  const handleDeleteCustomColor = useCallback((color: string) => {
    const updated = (settings.customColors ?? []).filter((c) => c !== color);
    updateSettings({ ...settings, customColors: updated });
  }, [settings, updateSettings]);

  // Persist custom colors from SettingsPanel without closing
  const handleSaveCustomColors = useCallback((newCustomColors: string[], updatedLabels?: LabelDefinition[]) => {
    const newLabels = updatedLabels ?? labels;
    if (updatedLabels) setLabels(newLabels);
    updateSettings({ ...settings, customColors: newCustomColors, labels: newLabels, activeLabel });
  }, [settings, labels, activeLabel, updateSettings]);

  const displayMessage = settings.customMessage || t.defaultCustomMessage;

  // Focus mode: running + work mode → minimal UI (no header)
  const isFocusMode = isRunning && mode === 'work';

  // Paused mid-session: timer was started but user pressed stop (not reset)
  const isPaused = !isRunning && mode === 'work' && timeLeft < effectiveWorkTime * 60;

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
      <div className="fixed inset-0 flex flex-col">
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
            onImportCsv={importSessions}
            sessions={sessions}
            labels={labels}
            onSaveLabels={handleSaveLabels}
            onSaveCustomColors={handleSaveCustomColors}
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
            onUpdateSession={updateSession}
            onDeleteSession={deleteSession}
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
      <AdBanner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col">
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
          onImportCsv={importSessions}
          sessions={sessions}
          labels={labels}
          onSaveLabels={handleSaveLabels}
          onSaveCustomColors={handleSaveCustomColors}
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
          onUpdateSession={updateSession}
          onDeleteSession={deleteSession}
        />
      )}

      {view === 'timer' && (
        <div className="landscape:flex landscape:items-center landscape:gap-8">
          <div className="landscape:flex-1">
            <TimerDisplay
              timeLeft={timeLeft}
              mode={mode}
              activePresets={settings.activePresets}
              currentWorkTime={effectiveWorkTime}
              onChangeWorkTime={(min) => updateSettings({ ...settings, workTime: min, activeLabel })}
              isEditable={!isRunning && mode === 'work'}
            />
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
            <div className="mt-4 space-y-2 flex flex-col items-start w-full max-w-xs mx-auto">
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
              {activeLabel && features.sessionNotes && (
                <textarea
                  value={activeNote}
                  onChange={(e) => setActiveNote(e.target.value)}
                  placeholder={t.labelNotePlaceholder}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 resize-none"
                />
              )}
              {activeLabel && !features.sessionNotes && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-700/50"
                >
                  <Lock size={14} />
                  {t.labelNotePlaceholder}
                </button>
              )}
            </div>

            {/* New label modal */}
            {showLabelCreator && (
              <QuickLabelModal
                onAdd={handleAddLabelInline}
                onClose={() => setShowLabelCreator(false)}
                addNewLabel={t.addNewLabel}
                labelNamePlaceholder={t.labelNamePlaceholder}
                addButtonText={t.addLabel}
                customColors={customColors}
                onRegisterColor={handleRegisterCustomColor}
                onChangeCustomColor={handleChangeCustomColor}
                onDeleteCustomColor={handleDeleteCustomColor}
              />
            )}

            <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
              {displayMessage}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade prompt modal */}
      {showUpgrade && <UpgradePrompt onClose={() => setShowUpgrade(false)} />}
    </AppShell>
    <AdBanner />
    </div>
  );
}

// ---- Storage switcher based on auth state + tier ----
// 未ログイン          → localStorage
// ログイン + cloudSync → Supabase (クラウド保存)
//   free tier: 1デバイス制限あり / standard・pro: 複数デバイスOK
function AppWithStorage() {
  const { user, isLoading: authLoading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const features = useFeatures();
  const [storage, setStorage] = useState<StorageService | null>(null);
  const prevStorageKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;

    const currentUid = user?.id ?? null;
    const useCloud = currentUid && features.cloudSync;
    const storageKey = useCloud ? `supabase:${currentUid}` : `local:${currentUid ?? 'anon'}`;

    // 同じキーなら再初期化不要
    if (prevStorageKeyRef.current === storageKey) return;
    prevStorageKeyRef.current = storageKey;

    setStorage(null);

    if (useCloud) {
      const cloud = createSupabaseStorageService(currentUid!);

      // localStorage → Supabase 自動マイグレーション
      // 既存無料ユーザーが初めてクラウド保存に切り替わった際、
      // localStorage にあるデータを Supabase へ移行する
      const local = new LocalStorageAdapter();
      let settled = false;

      // タイムアウト: マイグレーションが 8 秒以内に完了しない場合、
      // クラウドアダプターをそのまま使用して先に進む
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          setStorage(cloud);
        }
      }, 8_000);

      (async () => {
        try {
          const [cloudSessions, localSessions] = await Promise.all([
            cloud.getSessions(),
            local.getSessions(),
          ]);
          // Supabase が空 & localStorage にデータがある → 移行
          if (cloudSessions.length === 0 && localSessions.length > 0) {
            const localSettings = await local.getSettings();
            await Promise.all([
              cloud.saveSessions(localSessions),
              cloud.saveSettings(localSettings),
            ]);
            // 移行完了後に localStorage のデータを削除
            await local.clearAll();
          }
        } catch {
          // マイグレーション失敗時はスキップ（データは localStorage に残る）
        }
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          setStorage(cloud);
        }
      })();
    } else {
      setStorage(createStorageService());
    }
  }, [user, authLoading, features.cloudSync]);

  // Supabase password recovery (user clicked reset link in email)
  if (isPasswordRecovery) {
    const handleActionDone = () => {
      clearPasswordRecovery();
      // Remove hash fragment left by Supabase
      window.history.replaceState({}, '', window.location.pathname);
    };
    return (
      <I18nProvider language="en">
        <EmailActionHandler onDone={handleActionDone} />
      </I18nProvider>
    );
  }

  // Loading state
  if (authLoading || storage === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-4 border-tiffany border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // key にユーザーIDを使い、アカウント切替時にツリー全体をリマウント
  return <AppWithI18n key={user?.id ?? 'anonymous'} storage={storage} />;
}

function AppWithI18n({ storage }: { storage: StorageService }) {
  const { settings, updateSettings, isLoaded } = useSettings(storage);
  const { refreshTier } = useAuth();
  const [paymentSuccessPlan, setPaymentSuccessPlan] = useState<CheckoutPlan | null>(null);


  // Apply theme class to document
  useEffect(() => {
    const theme = settings.theme ?? 'light';
    const isDark = theme === 'gray' || theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', theme);
    // Update theme-color meta tag for PWA titlebar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors: Record<string, string> = { light: '#0abab5', gray: '#333333', dark: '#13171b' };
      meta.setAttribute('content', colors[theme] || '#0abab5');
    }
  }, [settings.theme]);

  // 決済完了後の URL パラメータ処理
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get('payment');
    const plan = params.get('plan') as CheckoutPlan | null;

    if (paymentResult === 'success' && plan) {
      // URL をクリア（ブラウザ履歴に残さない）
      window.history.replaceState({}, '', window.location.pathname);

      // Webhookの到達を待ちながらtierを再取得（1.5秒・3.5秒・5.5秒 の3回リトライ）
      const delays = [1500, 2000, 2000];
      let cumulative = 0;
      delays.forEach((delay) => {
        cumulative += delay;
        setTimeout(() => void refreshTier(), cumulative);
      });

      setPaymentSuccessPlan(plan);
    } else if (paymentResult === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // マウント時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-4 border-tiffany border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nProvider language={settings.language}>
      <InstallBanner />
      <PomodoroApp
        storage={storage}
        settings={settings}
        updateSettings={updateSettings}
      />
      {paymentSuccessPlan && (
        <PaymentSuccessToast
          plan={paymentSuccessPlan}
          onClose={() => setPaymentSuccessPlan(null)}
        />
      )}
    </I18nProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FeatureProvider>
        <AppWithStorage />
      </FeatureProvider>
    </AuthProvider>
  );
}
