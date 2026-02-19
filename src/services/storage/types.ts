import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';

export interface StorageService {
  getSessions(): Promise<PomodoroSession[]>;
  saveSessions(sessions: PomodoroSession[]): Promise<void>;
  getSettings(): Promise<PomodoroSettings>;
  saveSettings(settings: PomodoroSettings): Promise<void>;
  clearAll(): Promise<void>;
}
