import type { Language } from '@/i18n';

export interface PomodoroSettings {
  workTime: number;
  breakTime: number;
  customMessage: string;
  language: Language;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workTime: 25,
  breakTime: 5,
  customMessage: '',
  language: 'en',
};
