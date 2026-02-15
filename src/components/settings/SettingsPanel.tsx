import { useState } from 'react';
import { X } from 'lucide-react';
import type { PomodoroSettings } from '@/types/settings';
import { useI18n } from '@/contexts/I18nContext';
import { SUPPORTED_LANGUAGES, getTranslations } from '@/i18n';
import type { Language } from '@/i18n';

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const { t } = useI18n();
  const [workTime, setWorkTime] = useState(settings.workTime);
  const [breakTime, setBreakTime] = useState(settings.breakTime);
  const [customMessage, setCustomMessage] = useState(settings.customMessage);
  const [language, setLanguage] = useState<Language>(settings.language);

  const handleApply = () => {
    onSave({ workTime, breakTime, customMessage, language });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-700">{t.settings}</h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
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

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t.workTimeLabel}
          </label>
          <input
            type="number"
            value={workTime}
            onChange={(e) => setWorkTime(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t.breakTimeLabel}
          </label>
          <input
            type="number"
            value={breakTime}
            onChange={(e) => setBreakTime(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany"
          />
        </div>

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
