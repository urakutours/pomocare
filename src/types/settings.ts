import type { Language } from '@/i18n';

export type ThemeMode = 'light' | 'dark';

export interface PomodoroSettings {
  workTime: number;
  breakTime: number;
  customMessage: string;
  language: Language;
  activePresets: number[];
  restPresets: number[];
  theme: ThemeMode;
}

export const DEFAULT_ACTIVE_PRESETS = [15, 25, 35, 45];
export const DEFAULT_REST_PRESETS = [0, 3, 5, 10];

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workTime: 25,
  breakTime: 5,
  customMessage: '',
  language: 'en',
  activePresets: DEFAULT_ACTIVE_PRESETS,
  restPresets: DEFAULT_REST_PRESETS,
  theme: 'light',
};
