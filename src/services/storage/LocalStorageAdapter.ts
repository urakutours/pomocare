import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS, migrateAlarmSound, migrateVibration } from '@/types/settings';
import { STORAGE_KEYS } from '@/config/constants';

export class LocalStorageAdapter implements StorageService {
  private prefix: string;

  /**
   * @param uid ユーザーID（指定するとキーにプレフィックスを付けてユーザーごとにデータを分離）
   */
  constructor(uid?: string) {
    this.prefix = uid ? `${uid}:` : '';
  }

  private key(base: string): string {
    return this.prefix + base;
  }

  async getSessions(): Promise<PomodoroSession[]> {
    try {
      const raw = localStorage.getItem(this.key(STORAGE_KEYS.sessions));
      return raw ? JSON.parse(raw) : [];
    } catch {
      console.error('セッションの読み込みに失敗しました');
      return [];
    }
  }

  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    try {
      localStorage.setItem(this.key(STORAGE_KEYS.sessions), JSON.stringify(sessions));
    } catch {
      console.error('セッションの保存に失敗しました');
    }
  }

  async getSettings(): Promise<PomodoroSettings> {
    try {
      const raw = localStorage.getItem(this.key(STORAGE_KEYS.settings));
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<PomodoroSettings>;
      const merged: PomodoroSettings = { ...DEFAULT_SETTINGS, ...parsed };
      // Backward-compat: migrate removed synth4 IDs (bell/digital/chime/kitchen) to default
      if (merged.alarm?.sound) {
        merged.alarm = { ...merged.alarm, sound: migrateAlarmSound(merged.alarm.sound as string) };
      }
      // Backward-compat: normalize legacy vibration values (e.g. 'silent' removed in T2e) to 'off' | 'always'
      if (merged.alarm?.vibration !== undefined) {
        merged.alarm = { ...merged.alarm, vibration: migrateVibration(merged.alarm.vibration as string) };
      }
      return merged;
    } catch {
      console.error('設定の読み込みに失敗しました');
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    try {
      localStorage.setItem(this.key(STORAGE_KEYS.settings), JSON.stringify(settings));
    } catch {
      console.error('設定の保存に失敗しました');
    }
  }

  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(this.key(STORAGE_KEYS.sessions));
      localStorage.removeItem(this.key(STORAGE_KEYS.settings));
    } catch {
      console.error('データの初期化に失敗しました');
    }
  }
}
