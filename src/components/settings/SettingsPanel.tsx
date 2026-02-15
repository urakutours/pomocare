import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_ACTIVE_PRESETS, DEFAULT_REST_PRESETS } from '@/types/settings';
import { useI18n } from '@/contexts/I18nContext';
import { SUPPORTED_LANGUAGES, getTranslations } from '@/i18n';
import type { Language } from '@/i18n';

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onClose: () => void;
}

type SettingsView = 'main' | 'presets';

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
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          value={isCustom ? '__custom__' : String(value)}
          onChange={handleSelect}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white"
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
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany"
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
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-sm text-gray-700"
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
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tiffany"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const { t } = useI18n();
  const [workTime, setWorkTime] = useState(settings.workTime);
  const [breakTime, setBreakTime] = useState(settings.breakTime);
  const [customMessage, setCustomMessage] = useState(settings.customMessage);
  const [language, setLanguage] = useState<Language>(settings.language);
  const [activePresets, setActivePresets] = useState(
    settings.activePresets ?? DEFAULT_ACTIVE_PRESETS,
  );
  const [restPresets, setRestPresets] = useState(
    settings.restPresets ?? DEFAULT_REST_PRESETS,
  );
  const [view, setView] = useState<SettingsView>('main');

  const handleApply = () => {
    onSave({ workTime, breakTime, customMessage, language, activePresets, restPresets });
  };

  if (view === 'presets') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h3 className="font-semibold text-gray-700">{t.presetSettingsLabel}</h3>
          <button onClick={() => setView('main')}>
            <X size={18} className="text-gray-500" />
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-700">{t.settings}</h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-1">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t.languageLabel}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {getTranslations(lang).languageName}
              </option>
            ))}
          </select>
        </div>

        <TimeSelector
          label={t.activeTimeLabel}
          value={workTime}
          presets={activePresets}
          onChange={setWorkTime}
          restOffLabel={t.restOffLabel}
          customLabel={t.customInput}
        />

        <TimeSelector
          label={t.restTimeLabel}
          value={breakTime}
          presets={restPresets}
          onChange={setBreakTime}
          isRest
          restOffLabel={t.restOffLabel}
          customLabel={t.customInput}
        />

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t.customMessageLabel}
          </label>
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder={t.defaultCustomMessage}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany"
          />
        </div>

        <button
          onClick={() => setView('presets')}
          className="w-full text-left text-sm text-tiffany hover:underline"
        >
          {t.presetSettingsLabel} &rarr;
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
