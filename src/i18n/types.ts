export const SUPPORTED_LANGUAGES = ['en', 'ja', 'es', 'pt', 'de', 'fr', 'it'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export interface Translations {
  // Language metadata
  languageName: string;

  // Header
  appTitle: string;

  // Timer
  restMode: string;
  longBreakMode: string;

  // Settings
  settings: string;
  activeTimeLabel: string;
  restTimeLabel: string;
  longBreakTimeLabel: string;
  longBreakIntervalLabel: string;
  customMessageLabel: string;
  languageLabel: string;
  applySettings: string;
  customInput: string;
  presetSettingsLabel: string;
  activePresetsLabel: string;
  restPresetsLabel: string;
  addPreset: string;
  restOffLabel: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;

  // Alarm settings
  alarmLabel: string;
  alarmSoundBell: string;
  alarmSoundDigital: string;
  alarmSoundChime: string;
  alarmSoundNone: string;
  alarmRepeatLabel: string;

  // Labels
  labelsLabel: string;
  addLabel: string;
  activeLabelLabel: string;
  noLabel: string;

  // Stats
  weeklyStats: string;
  weekly: string;
  monthly: string;
  yearly: string;
  today: string;
  thisWeek: string;
  totalTime: string;
  sessions: string;
  previousWeek: string;
  nextWeek: string;
  previousMonth: string;
  nextMonth: string;
  previousYear: string;
  nextYear: string;
  exportCsv: string;

  // Install banner
  installApp: string;

  // Days of week (Mon-Sun)
  days: readonly [string, string, string, string, string, string, string];

  // Months
  months: readonly [string, string, string, string, string, string, string, string, string, string, string, string];

  // Default custom message
  defaultCustomMessage: string;
}
