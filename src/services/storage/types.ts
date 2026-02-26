import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';

export interface StorageService {
  getSessions(): Promise<PomodoroSession[]>;
  saveSessions(sessions: PomodoroSession[]): Promise<void>;
  getSettings(): Promise<PomodoroSettings>;
  saveSettings(settings: PomodoroSettings): Promise<void>;
  clearAll(): Promise<void>;
  /** Subscribe to remote data changes (cross-device sync). Returns cleanup function. */
  onRemoteChange?(callback: (table: 'sessions' | 'settings') => void): () => void;
}
