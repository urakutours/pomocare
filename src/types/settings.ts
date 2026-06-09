import type { Language } from '@/i18n';
import type { LabelDefinition } from '@/types/session';

export type ThemeMode = 'light' | 'gray' | 'dark';

export type AlarmSound = 'windchime' | 'canon' | 'boxing' | 'cuckoo' | 'classic' | 'gentle' | 'soft' | 'none';

/** Backward-compat: map legacy synth4 IDs to the new default. Used at read-time to avoid crash on old stored values. */
export function migrateAlarmSound(raw: string): AlarmSound {
  const LEGACY_MAP: Record<string, AlarmSound> = {
    bell: 'classic',
    digital: 'classic',
    chime: 'classic',
    kitchen: 'classic',
  };
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw as keyof typeof LEGACY_MAP];
  const valid: AlarmSound[] = ['windchime', 'canon', 'boxing', 'cuckoo', 'classic', 'gentle', 'soft', 'none'];
  if ((valid as string[]).includes(raw)) return raw as AlarmSound;
  return 'classic'; // unknown → default
}

/** off = no vibration / always = vibrate on every alarm */
export type VibrationMode = 'off' | 'always';

/** Backward-compat: map legacy vibration values (e.g. 'silent' removed in T2e) to valid VibrationMode. */
export function migrateVibration(raw: string): VibrationMode {
  if (raw === 'always') return 'always';
  return 'off'; // 'silent' or any unknown value → off
}

export interface AlarmSettings {
  sound: AlarmSound;
  /** @deprecated AlarmScheduler uses long-form single playback; repeat value is ignored. Kept for backward-compat read of stored JSONB. */
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
  alarm: { sound: 'classic', repeat: 1, volume: 80, vibration: 'off' },
  labels: [],
  activeLabel: null,
  customColors: [],
};
