export const SUPPORTED_LANGUAGES = ['en', 'ja', 'es', 'pt', 'de', 'fr', 'it'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export interface Translations {
  // Language metadata
  languageName: string;

  // Header
  appTitle: string;

  // Timer
  restMode: string;

  // Settings
  settings: string;
  activeTimeLabel: string;
  restTimeLabel: string;
  customMessageLabel: string;
  languageLabel: string;
  applySettings: string;
  customInput: string;
  presetSettingsLabel: string;
  activePresetsLabel: string;
  restPresetsLabel: string;
  addPreset: string;
  restOffLabel: string;

  // Stats
  weeklyStats: string;
  today: string;
  thisWeek: string;
  previousWeek: string;
  nextWeek: string;

  // Install banner
  installApp: string;

  // Days of week (Mon-Sun)
  days: readonly [string, string, string, string, string, string, string];

  // Default custom message
  defaultCustomMessage: string;
}
