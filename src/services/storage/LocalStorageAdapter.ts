import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { STORAGE_KEYS } from '@/config/constants';

export class LocalStorageAdapter implements StorageService {
  async getSessions(): Promise<PomodoroSession[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.sessions);
      return raw ? JSON.parse(raw) : [];
    } catch {
      console.error('セッションの読み込みに失敗しました');
      return [];
    }
  }

  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
    } catch {
      console.error('セッションの保存に失敗しました');
    }
  }

  async getSettings(): Promise<PomodoroSettings> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      console.error('設定の読み込みに失敗しました');
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      console.error('設定の保存に失敗しました');
    }
  }

  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.sessions);
      localStorage.removeItem(STORAGE_KEYS.settings);
    } catch {
      console.error('データの初期化に失敗しました');
    }
  }
}
