import { supabase } from '@/lib/supabase';
import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

/**
 * Supabase ストレージアダプター
 *
 * Firestore 単一ドキュメント方式と同等のデータ構造を PostgreSQL + JSONB で実現。
 *
 * テーブル構造:
 *   user_sessions(user_id UUID PK, items JSONB, updated_at TIMESTAMPTZ)
 *   user_settings(user_id UUID PK, data JSONB, updated_at TIMESTAMPTZ)
 *
 * RLS で各ユーザーは自分のデータのみ読み書き可能。
 */
export class SupabaseAdapter implements StorageService {
  private uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  // ---- Sessions ----

  async getSessions(): Promise<PomodoroSession[]> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('items')
      .eq('user_id', this.uid)
      .single();

    if (error) {
      // PGRST116 = no rows found
      if (error.code === 'PGRST116') return [];
      throw error;
    }
    return (data?.items as PomodoroSession[]) ?? [];
  }

  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .upsert(
        { user_id: this.uid, items: sessions, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
  }

  // ---- Settings ----

  async getSettings(): Promise<PomodoroSettings> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('data')
      .eq('user_id', this.uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return DEFAULT_SETTINGS;
      throw error;
    }
    return { ...DEFAULT_SETTINGS, ...(data?.data as Partial<PomodoroSettings>) };
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: this.uid, data: settings, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
  }

  // ---- Clear ----

  async clearAll(): Promise<void> {
    await Promise.all([
      supabase.from('user_sessions').delete().eq('user_id', this.uid),
      supabase.from('user_settings').delete().eq('user_id', this.uid),
    ]);
  }
}
