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
  /** Atomically add a single session (normalized table). Falls back to saveSessions if not implemented. */
  addSession?(session: PomodoroSession): Promise<void>;
  /** Atomically update a session by date key. */
  updateSession?(date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>): Promise<void>;
  /** Atomically delete a session by date key. */
  deleteSession?(date: string): Promise<void>;
  /** Flush any locally-queued sessions to the remote server. */
  flushPendingSessions?(): Promise<void>;
  /** Lightweight getSessions that skips migration/flush — for sync triggers only. */
  getSessionsFast?(): Promise<PomodoroSession[]>;
}
