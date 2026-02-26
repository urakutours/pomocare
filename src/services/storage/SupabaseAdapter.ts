import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
 *
 * クロスデバイス同期:
 *   Supabase Broadcast を使い、保存時に他デバイスへ即時通知。
 *   受信側は onRemoteChange コールバックで最新データを再取得する。
 */
export class SupabaseAdapter implements StorageService {
  private uid: string;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<(table: 'sessions' | 'settings') => void>();

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
    this.broadcast('sessions');
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
    this.broadcast('settings');
  }

  // ---- Clear ----

  async clearAll(): Promise<void> {
    await Promise.all([
      supabase.from('user_sessions').delete().eq('user_id', this.uid),
      supabase.from('user_settings').delete().eq('user_id', this.uid),
    ]);
  }

  // ---- Real-time sync via Supabase Broadcast ----

  /**
   * 保存後に他デバイスへ変更を通知する。
   * Broadcast の self オプションはデフォルト false なので、送信者自身にはコールバックが発火しない。
   */
  private broadcast(table: 'sessions' | 'settings') {
    this.channel?.send({
      type: 'broadcast',
      event: 'data_changed',
      payload: { table },
    });
  }

  /**
   * リモートデータ変更を購読する。
   * 最初の購読時に Broadcast チャンネルを作成し、最後の購読解除時に破棄する。
   */
  onRemoteChange(callback: (table: 'sessions' | 'settings') => void): () => void {
    this.listeners.add(callback);

    // Lazy channel creation on first subscriber
    if (!this.channel) {
      this.channel = supabase.channel(`sync:${this.uid}`);
      this.channel
        .on('broadcast', { event: 'data_changed' }, (msg) => {
          const table = msg.payload?.table;
          if (table === 'sessions' || table === 'settings') {
            for (const listener of this.listeners) {
              listener(table);
            }
          }
        })
        .subscribe();
    }

    return () => {
      this.listeners.delete(callback);
      // Clean up channel when last subscriber leaves
      if (this.listeners.size === 0 && this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }
}
