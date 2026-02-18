import { useState } from 'react';
import { X, Plus, Trash2, Sun, Moon, Play } from 'lucide-react';
import type { PomodoroSettings, ThemeMode, AlarmSound } from '@/types/settings';
import { DEFAULT_ACTIVE_PRESETS, DEFAULT_REST_PRESETS } from '@/types/settings';
import type { LabelDefinition } from '@/types/session';
import { useI18n } from '@/contexts/I18nContext';
import { SUPPORTED_LANGUAGES, getTranslations } from '@/i18n';
import type { Language } from '@/i18n';
import { previewAlarm } from '@/utils/alarm';

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onClose: () => void;
}

type SettingsView = 'main' | 'presets' | 'labels';

const selectClass =
  'flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200';
const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400';
const inputSmClass =
  'w-20 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200';
const labelClass = 'block text-sm text-gray-600 dark:text-gray-400 mb-1';

// Long break options (0 = OFF)
const LONG_BREAK_OPTIONS = [0, 15, 20];
const LONG_BREAK_INTERVAL_OPTIONS = [0, 3, 4];

function TimeSelector({
  label,
  value,
  presets,
  onChange,
  isRest,
  restOffLabel,
  customLabel,
}: {
  label: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
  isRest?: boolean;
  restOffLabel: string;
  customLabel: string;
}) {
  const [isCustom, setIsCustom] = useState(!presets.includes(value));
  const [customValue, setCustomValue] = useState(String(value));

  const formatOption = (v: number) => {
    if (isRest && v === 0) return restOffLabel;
    return `${v}`;
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setIsCustom(true);
      setCustomValue(String(value));
    } else {
      setIsCustom(false);
      onChange(Number(selected));
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const min = isRest ? 0 : 1;
      onChange(Math.max(min, parsed));
    }
  };

  const handleCustomBlur = () => {
    const parsed = parseInt(customValue, 10);
    if (isNaN(parsed) || customValue === '') {
      const fallback = isRest ? 0 : 1;
      setCustomValue(String(fallback));
      onChange(fallback);
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <select
          value={isCustom ? '__custom__' : String(value)}
          onChange={handleSelect}
          className={selectClass}
        >
          {presets.map((p) => (
            <option key={p} value={String(p)}>
              {formatOption(p)}
            </option>
          ))}
          <option value="__custom__">{customLabel}</option>
        </select>
        {isCustom && (
          <input
            type="number"
            value={customValue}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            min={isRest ? 0 : 1}
            className={inputSmClass}
          />
        )}
      </div>
    </div>
  );
}

function PresetEditor({
  label,
  presets,
  onChange,
  isRest,
  restOffLabel,
  addLabel,
}: {
  label: string;
  presets: number[];
  onChange: (presets: number[]) => void;
  isRest?: boolean;
  restOffLabel: string;
  addLabel: string;
}) {
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    const parsed = parseInt(newValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    if (presets.includes(parsed)) return;
    const updated = [...presets, parsed].sort((a, b) => a - b);
    onChange(updated);
    setNewValue('');
  };

  const handleRemove = (val: number) => {
    onChange(presets.filter((p) => p !== val));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-neutral-700 rounded text-sm text-gray-700 dark:text-gray-300"
          >
            {isRest && p === 0 ? restOffLabel : `${p}`}
            <button
              onClick={() => handleRemove(p)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          min={isRest ? 0 : 1}
          placeholder="min"
          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 flex items-center gap-1"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function ThemeToggle({
  label,
  value,
  onChange,
  lightLabel,
  darkLabel,
}: {
  label: string;
  value: ThemeMode;
  onChange: (v: ThemeMode) => void;
  lightLabel: string;
  darkLabel: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('light')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors ${
            value === 'light'
              ? 'border-tiffany bg-white text-tiffany font-medium ring-2 ring-tiffany'
              : 'border-gray-300 dark:border-neutral-500 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Sun size={16} />
          {lightLabel}
        </button>
        <button
          onClick={() => onChange('dark')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors ${
            value === 'dark'
              ? 'border-tiffany bg-neutral-700 text-tiffany font-medium ring-2 ring-tiffany'
              : 'border-gray-300 dark:border-neutral-600 bg-neutral-700 text-gray-300 hover:bg-neutral-600'
          }`}
        >
          <Moon size={16} />
          {darkLabel}
        </button>
      </div>
    </div>
  );
}

// ---- Label Manager ----
const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#0abab5', '#3b82f6', '#8b5cf6', '#ec4899',
];

function LabelManager({
  labels,
  onChange,
  addLabel,
}: {
  labels: LabelDefinition[];
  onChange: (labels: LabelDefinition[]) => void;
  addLabel: string;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = Date.now().toString(36);
    onChange([...labels, { id, name, color: newColor }]);
    setNewName('');
  };

  const handleRemove = (id: string) => {
    onChange(labels.filter((l) => l.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {labels.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sm text-white"
            style={{ backgroundColor: l.color }}
          >
            {l.name}
            <button onClick={() => handleRemove(l.id)} className="opacity-70 hover:opacity-100">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Label name"
          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 flex items-center gap-1 whitespace-nowrap"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setNewColor(c)}
            className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Alarm Settings ----
function AlarmSettingsPanel({
  sound,
  repeat,
  onSoundChange,
  onRepeatChange,
  alarmLabel,
  repeatLabel,
  bellLabel,
  digitalLabel,
  chimeLabel,
  noneLabel,
}: {
  sound: AlarmSound;
  repeat: number;
  onSoundChange: (s: AlarmSound) => void;
  onRepeatChange: (n: number) => void;
  alarmLabel: string;
  repeatLabel: string;
  bellLabel: string;
  digitalLabel: string;
  chimeLabel: string;
  noneLabel: string;
}) {
  const sounds: { value: AlarmSound; label: string }[] = [
    { value: 'bell', label: bellLabel },
    { value: 'digital', label: digitalLabel },
    { value: 'chime', label: chimeLabel },
    { value: 'none', label: noneLabel },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>{alarmLabel}</label>
        <div className="flex gap-2 items-center">
          <select
            value={sound}
            onChange={(e) => onSoundChange(e.target.value as AlarmSound)}
            className={selectClass}
          >
            {sounds.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {sound !== 'none' && (
            <button
              onClick={() => previewAlarm(sound, repeat)}
              className="p-2 rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 text-gray-600 dark:text-gray-400"
              title="Preview"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>

      {sound !== 'none' && (
        <div>
          <label className={labelClass}>{repeatLabel}</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => onRepeatChange(n)}
                className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                  repeat === n
                    ? 'border-tiffany bg-tiffany text-white'
                    : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const { t } = useI18n();
  const [workTime, setWorkTime] = useState(settings.workTime);
  const [breakTime, setBreakTime] = useState(settings.breakTime);
  const [longBreakTime, setLongBreakTime] = useState(settings.longBreakTime ?? 0);
  const [longBreakInterval, setLongBreakInterval] = useState(settings.longBreakInterval ?? 0);
  const [customMessage, setCustomMessage] = useState(settings.customMessage);
  const [language, setLanguage] = useState<Language>(settings.language);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme ?? 'light');
  const [activePresets, setActivePresets] = useState(
    settings.activePresets ?? DEFAULT_ACTIVE_PRESETS,
  );
  const [restPresets, setRestPresets] = useState(
    settings.restPresets ?? DEFAULT_REST_PRESETS,
  );
  const [alarmSound, setAlarmSound] = useState<AlarmSound>(settings.alarm?.sound ?? 'bell');
  const [alarmRepeat, setAlarmRepeat] = useState(settings.alarm?.repeat ?? 1);
  const [labels, setLabels] = useState<LabelDefinition[]>(settings.labels ?? []);
  const [view, setView] = useState<SettingsView>('main');

  const handleApply = () => {
    onSave({
      workTime,
      breakTime,
      longBreakTime,
      longBreakInterval,
      customMessage,
      language,
      activePresets,
      restPresets,
      theme,
      alarm: { sound: alarmSound, repeat: alarmRepeat },
      labels,
      activeLabel: settings.activeLabel,
    });
  };

  // Presets view
  if (view === 'presets') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">{t.presetSettingsLabel}</h3>
          <button onClick={() => setView('main')}>
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-5 p-1">
            <PresetEditor
              label={t.activePresetsLabel}
              presets={activePresets}
              onChange={setActivePresets}
              restOffLabel={t.restOffLabel}
              addLabel={t.addPreset}
            />
            <PresetEditor
              label={t.restPresetsLabel}
              presets={restPresets}
              onChange={setRestPresets}
              isRest
              restOffLabel={t.restOffLabel}
              addLabel={t.addPreset}
            />
          </div>
        </div>

        <div className="flex-shrink-0 pt-4">
          <button
            onClick={() => setView('main')}
            className="w-full py-2 rounded-lg text-white font-medium bg-tiffany hover:bg-tiffany-hover transition-colors"
          >
            {t.applySettings}
          </button>
        </div>
      </div>
    );
  }

  // Labels view
  if (view === 'labels') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">{t.labelsLabel}</h3>
          <button onClick={() => setView('main')}>
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-1">
            <LabelManager
              labels={labels}
              onChange={setLabels}
              addLabel={t.addLabel}
            />
          </div>
        </div>

        <div className="flex-shrink-0 pt-4">
          <button
            onClick={() => setView('main')}
            className="w-full py-2 rounded-lg text-white font-medium bg-tiffany hover:bg-tiffany-hover transition-colors"
          >
            {t.applySettings}
          </button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">{t.settings}</h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-1">
          {/* 1. Active time */}
          <TimeSelector
            label={t.activeTimeLabel}
            value={workTime}
            presets={activePresets}
            onChange={setWorkTime}
            restOffLabel={t.restOffLabel}
            customLabel={t.customInput}
          />

          {/* 2. Rest time */}
          <TimeSelector
            label={t.restTimeLabel}
            value={breakTime}
            presets={restPresets}
            onChange={setBreakTime}
            isRest
            restOffLabel={t.restOffLabel}
            customLabel={t.customInput}
          />

          {/* 3. Long break time */}
          <TimeSelector
            label={t.longBreakTimeLabel}
            value={longBreakTime}
            presets={LONG_BREAK_OPTIONS}
            onChange={setLongBreakTime}
            isRest
            restOffLabel={t.restOffLabel}
            customLabel={t.customInput}
          />

          {/* 4. Long break interval (only shown when long break is enabled) */}
          {longBreakTime > 0 && (
            <TimeSelector
              label={t.longBreakIntervalLabel}
              value={longBreakInterval}
              presets={LONG_BREAK_INTERVAL_OPTIONS}
              onChange={setLongBreakInterval}
              isRest
              restOffLabel={t.restOffLabel}
              customLabel={t.customInput}
            />
          )}

          {/* 5. Alarm */}
          <AlarmSettingsPanel
            sound={alarmSound}
            repeat={alarmRepeat}
            onSoundChange={setAlarmSound}
            onRepeatChange={setAlarmRepeat}
            alarmLabel={t.alarmLabel}
            repeatLabel={t.alarmRepeatLabel}
            bellLabel={t.alarmSoundBell}
            digitalLabel={t.alarmSoundDigital}
            chimeLabel={t.alarmSoundChime}
            noneLabel={t.alarmSoundNone}
          />

          {/* 6. Theme */}
          <ThemeToggle
            label={t.themeLabel}
            value={theme}
            onChange={setTheme}
            lightLabel={t.themeLight}
            darkLabel={t.themeDark}
          />

          {/* 7. Custom message */}
          <div>
            <label className={labelClass}>{t.customMessageLabel}</label>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={t.defaultCustomMessage}
              className={inputClass}
            />
          </div>

          {/* 8. Language */}
          <div>
            <label className={labelClass}>{t.languageLabel}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={selectClass + ' w-full'}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {getTranslations(lang).languageName}
                </option>
              ))}
            </select>
          </div>

          {/* Preset settings link */}
          <button
            onClick={() => setView('presets')}
            className="w-full text-left text-sm text-tiffany hover:underline"
          >
            {t.presetSettingsLabel} &rarr;
          </button>

          {/* Labels link */}
          <button
            onClick={() => setView('labels')}
            className="w-full text-left text-sm text-tiffany hover:underline"
          >
            {t.labelsLabel} &rarr;
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 pt-4">
        <button
          onClick={handleApply}
          className="w-full py-2 rounded-lg text-white font-medium bg-tiffany hover:bg-tiffany-hover transition-colors"
        >
          {t.applySettings}
        </button>
      </div>
    </div>
  );
}
