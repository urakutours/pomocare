import type { Language } from '@/i18n';
import type { LabelDefinition } from '@/types/session';

export type ThemeMode = 'light' | 'gray' | 'dark';

export type AlarmSound = 'bell' | 'digital' | 'chime' | 'kitchen' | 'classic' | 'gentle' | 'soft' | 'none';

export type VibrationMode = 'off' | 'silent' | 'always';

export interface AlarmSettings {
  sound: AlarmSound;
  repeat: number; // 1-5
  volume: number; // 0-100
  vibration: VibrationMode;
}

export interface PomodoroSettings {
  workTime: number;
  breakTime: number;
  longBreakTime: number;       // 0 = OFF
  longBreakInterval: number;   // 0 = OFF, otherwise every N sessions
  customMessage: string;
  language: Language;
  activePresets: number[];
  restPresets: number[];
  theme: ThemeMode;
  alarm: AlarmSettings;
  labels: LabelDefinition[];
  activeLabel: string | null;  // id of selected label, null = no label
  customColors?: string[];     // user-registered custom colors (hex strings)
}

export const DEFAULT_ACTIVE_PRESETS = [15, 25, 35, 45];
export const DEFAULT_REST_PRESETS = [0, 3, 5, 10];

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workTime: 25,
  breakTime: 5,
  longBreakTime: 20,
  longBreakInterval: 4,
  customMessage: '',
  language: 'en',
  activePresets: DEFAULT_ACTIVE_PRESETS,
  restPresets: DEFAULT_REST_PRESETS,
  theme: 'light',
  alarm: { sound: 'bell', repeat: 1, volume: 80, vibration: 'silent' },
  labels: [],
  activeLabel: null,
  customColors: [],
};
