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
// Legacy (unscoped) cache keys — used as fallback for backward compatibility
const LEGACY_SETTINGS_CACHE_KEY = 'pomocare-settings-cache';
const LEGACY_SESSIONS_CACHE_KEY = 'pomocare-sessions-cache';

export class SupabaseAdapter implements StorageService {
  private uid: string;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<(table: 'sessions' | 'settings') => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private onlineHandler: (() => void) | null = null;

  /** Tracks the most recently constructed uid so static methods can scope reads. */
  private static lastUid: string | null = null;

  constructor(uid: string) {
    this.uid = uid;
    SupabaseAdapter.lastUid = uid;
    // Migrate legacy unscoped cache to scoped keys (one-time per user)
    this.migrateLegacyCacheKeys();

    // Periodic flush: push pending sessions to server every 60s
    this.flushInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        this.flushPendingSessions().catch(() => {});
      }
    }, 60_000);

    // Reconnect broadcast + flush pending when device comes back online
    this.onlineHandler = () => {
      console.log('[SupabaseAdapter] online — reconnecting channel + flushing pending');
      if (this.listeners.size > 0) this.setupChannel();
      this.flushPendingSessions().catch(() => {});
    };
    window.addEventListener('online', this.onlineHandler);
  }

  /** Clean up timers and event listeners. Call when adapter is no longer needed. */
  destroy(): void {
    if (this.flushInterval) { clearInterval(this.flushInterval); this.flushInterval = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.onlineHandler) { window.removeEventListener('online', this.onlineHandler); this.onlineHandler = null; }
    if (this.channel) { supabase.removeChannel(this.channel); this.channel = null; }
  }

  private get settingsCacheKey() { return `pomocare-settings-cache:${this.uid}`; }
  private get sessionsCacheKey() { return `pomocare-sessions-cache:${this.uid}`; }
  private get pendingSessionsKey() { return `pomocare-pending-sessions:${this.uid}`; }

  /** One-time migration: copy legacy unscoped cache to user-scoped keys, then remove legacy. */
  private migrateLegacyCacheKeys(): void {
    try {
      const legacySettings = localStorage.getItem(LEGACY_SETTINGS_CACHE_KEY);
      if (legacySettings && !localStorage.getItem(this.settingsCacheKey)) {
        localStorage.setItem(this.settingsCacheKey, legacySettings);
      }
      const legacySessions = localStorage.getItem(LEGACY_SESSIONS_CACHE_KEY);
      if (legacySessions && !localStorage.getItem(this.sessionsCacheKey)) {
        localStorage.setItem(this.sessionsCacheKey, legacySessions);
      }
      // Clean up legacy keys
      localStorage.removeItem(LEGACY_SETTINGS_CACHE_KEY);
      localStorage.removeItem(LEGACY_SESSIONS_CACHE_KEY);
    } catch { /* ignore */ }
  }

  // ---- Local cache helpers (write-through for instant startup) ----

  private cacheSettings(settings: PomodoroSettings): void {
    try { localStorage.setItem(this.settingsCacheKey, JSON.stringify(settings)); } catch { /* ignore */ }
  }

  private cacheSessions(sessions: PomodoroSession[]): void {
    try { localStorage.setItem(this.sessionsCacheKey, JSON.stringify(sessions)); } catch { /* ignore */ }
  }

  // ---- Pending session queue (local-first offline resilience) ----

  private getPendingSessions(): PomodoroSession[] {
    try {
      const raw = localStorage.getItem(this.pendingSessionsKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private setPendingSessions(sessions: PomodoroSession[]): void {
    try {
      if (sessions.length === 0) {
        localStorage.removeItem(this.pendingSessionsKey);
      } else {
        localStorage.setItem(this.pendingSessionsKey, JSON.stringify(sessions));
      }
    } catch { /* ignore */ }
  }

  private addToPendingQueue(session: PomodoroSession): void {
    const pending = this.getPendingSessions();
    const filtered = pending.filter(s => s.date !== session.date);
    filtered.push(session);
    this.setPendingSessions(filtered);
  }

  private removeFromPendingQueue(date: string): void {
    const pending = this.getPendingSessions();
    this.setPendingSessions(pending.filter(s => s.date !== date));
  }

  /** Flush locally-queued sessions to Supabase. Called on getSessions and tab focus. */
  async flushPendingSessions(): Promise<void> {
    const pending = this.getPendingSessions();
    if (pending.length === 0) return;

    const rows = pending.map(s => ({
      user_id: this.uid,
      date: s.date,
      duration: s.duration,
      label: s.label ?? null,
      note: s.note ?? null,
      updated_at: new Date().toISOString(),
    }));

    try {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('user_sessions_v2')
          .upsert(chunk, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      // All flushed successfully
      this.setPendingSessions([]);
      this.broadcast('sessions');
    } catch (err) {
      console.warn('[SupabaseAdapter] flushPendingSessions failed, will retry later:', err);
    }
  }

  static getCachedSettings(): PomodoroSettings | null {
    try {
      const uid = SupabaseAdapter.lastUid;
      const key = uid ? `pomocare-settings-cache:${uid}` : LEGACY_SETTINGS_CACHE_KEY;
      const raw = localStorage.getItem(key);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : null;
    } catch { return null; }
  }

  static getCachedSessions(): PomodoroSession[] | null {
    try {
      const uid = SupabaseAdapter.lastUid;
      const key = uid ? `pomocare-sessions-cache:${uid}` : LEGACY_SESSIONS_CACHE_KEY;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /** Clear all caches for a given user. Called on sign-out. */
  static clearCacheForUser(uid: string): void {
    try {
      localStorage.removeItem(`pomocare-settings-cache:${uid}`);
      localStorage.removeItem(`pomocare-sessions-cache:${uid}`);
      localStorage.removeItem(`pomocare-pending-sessions:${uid}`);
      localStorage.removeItem(LEGACY_SETTINGS_CACHE_KEY);
      localStorage.removeItem(LEGACY_SESSIONS_CACHE_KEY);
    } catch { /* ignore */ }
  }

  // ---- Sessions (normalized: user_sessions_v2, one row per session) ----

  /** In-flight migration promise — prevents concurrent duplicate migrations. */
  private migrationPromise: Promise<void> | null = null;

  /** Client-side V1→V2 migration: copy JSONB blob sessions to normalized table. */
  private async migrateFromV1IfNeeded(): Promise<void> {
    const migrationKey = `pomocare-sessions-v2-migrated:${this.uid}`;
    if (localStorage.getItem(migrationKey)) return;

    // Deduplicate concurrent calls — reuse the in-flight promise
    if (this.migrationPromise) return this.migrationPromise;

    this.migrationPromise = (async () => {
      try {
        const { data } = await supabase
          .from('user_sessions')
          .select('items')
          .eq('user_id', this.uid)
          .single();

        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          // Upsert all V1 sessions into V2 table (idempotent via ON CONFLICT)
          const rows = (data.items as PomodoroSession[]).map(s => ({
            user_id: this.uid,
            date: s.date,
            duration: s.duration,
            label: s.label ?? null,
            note: s.note ?? null,
          }));
          // Batch in chunks of 500
          for (let i = 0; i < rows.length; i += 500) {
            const chunk = rows.slice(i, i + 500);
            await supabase
              .from('user_sessions_v2')
              .upsert(chunk, { onConflict: 'user_id,date' });
          }
        }
        localStorage.setItem(migrationKey, '1');
      } catch (err) {
        console.warn('[SupabaseAdapter] V1→V2 migration failed, will retry next load:', err);
        // Don't set flag — retry next time
      } finally {
        this.migrationPromise = null;
      }
    })();

    return this.migrationPromise;
  }

  async getSessions(): Promise<PomodoroSession[]> {
    // Ensure V1→V2 migration has run before reading from V2
    await this.migrateFromV1IfNeeded();

    // Snapshot pending BEFORE flush — covers the read-after-write gap where
    // flushPendingSessions() clears the queue but the server read hasn't indexed yet.
    const pendingSnapshot = this.getPendingSessions();
    console.log('[SupabaseAdapter] getSessions: pending snapshot:', pendingSnapshot.length);

    // Try to flush any pending sessions (background, non-blocking on failure)
    await this.flushPendingSessions();

    // Paginated fetch — PostgREST defaults to max 1000 rows per request.
    // Fetch in pages to ensure ALL sessions are returned.
    const PAGE_SIZE = 1000;
    const allRows: { date: string; duration: number; label: string | null; note: string | null }[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('user_sessions_v2')
        .select('date, duration, label, note')
        .eq('user_id', this.uid)
        .order('date', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...data);
      if (data.length < PAGE_SIZE) break; // Last page
      from += PAGE_SIZE;
    }

    const serverSessions: PomodoroSession[] = allRows.map(row => ({
      date: row.date,
      duration: row.duration,
      ...(row.label ? { label: row.label } : {}),
      ...(row.note ? { note: row.note } : {}),
    }));
    console.log('[SupabaseAdapter] getSessions: server returned', serverSessions.length, 'sessions');

    // Always merge the pre-flush snapshot to ensure no sessions are lost
    if (pendingSnapshot.length === 0) {
      this.cacheSessions(serverSessions);
      return serverSessions;
    }
    const byDate = new Map<string, PomodoroSession>();
    for (const s of serverSessions) byDate.set(s.date, s);
    for (const s of pendingSnapshot) byDate.set(s.date, s); // pending wins (newer local data)
    const merged = Array.from(byDate.values()).sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    console.log('[SupabaseAdapter] getSessions: merged total:', merged.length, '(pending:', pendingSnapshot.length, ')');
    this.cacheSessions(merged);
    return merged;
  }

  /**
   * Lightweight getSessions — skips V1 migration and pending flush.
   * Used by sync triggers (visibility, broadcast, polling) for speed.
   * Still merges pending queue snapshot to avoid missing local data.
   */
  async getSessionsFast(): Promise<PomodoroSession[]> {
    const pendingSnapshot = this.getPendingSessions();

    const PAGE_SIZE = 1000;
    const allRows: { date: string; duration: number; label: string | null; note: string | null }[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('user_sessions_v2')
        .select('date, duration, label, note')
        .eq('user_id', this.uid)
        .order('date', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const serverSessions: PomodoroSession[] = allRows.map(row => ({
      date: row.date,
      duration: row.duration,
      ...(row.label ? { label: row.label } : {}),
      ...(row.note ? { note: row.note } : {}),
    }));

    if (pendingSnapshot.length === 0) {
      this.cacheSessions(serverSessions);
      return serverSessions;
    }
    const byDate = new Map<string, PomodoroSession>();
    for (const s of serverSessions) byDate.set(s.date, s);
    for (const s of pendingSnapshot) byDate.set(s.date, s);
    const merged = Array.from(byDate.values()).sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    this.cacheSessions(merged);
    return merged;
  }

  /** Bulk save — used for migration and import. Upserts all sessions as individual rows. */
  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    this.cacheSessions(sessions);
    const rows = sessions.map(s => ({
      user_id: this.uid,
      date: s.date,
      duration: s.duration,
      label: s.label ?? null,
      note: s.note ?? null,
      updated_at: new Date().toISOString(),
    }));
    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('user_sessions_v2')
        .upsert(chunk, { onConflict: 'user_id,date' });
      if (error) throw error;
    }
    this.broadcast('sessions');
  }

  /** Local-first session add: write to cache + pending queue first, then push to Supabase. */
  async addSession(session: PomodoroSession): Promise<void> {
    console.log('[SupabaseAdapter] addSession:', session.date);

    // 1. Write to local cache FIRST (survives reload even if Supabase fails)
    const cached = SupabaseAdapter.getCachedSessions() ?? [];
    this.cacheSessions([...cached.filter(s => s.date !== session.date), session]);
    console.log('[SupabaseAdapter] addSession: cached to localStorage ✓', cached.length + 1, 'sessions');

    // 2. Add to pending queue (will be flushed on next getSessions or manually)
    this.addToPendingQueue(session);
    console.log('[SupabaseAdapter] addSession: added to pending queue ✓');

    // 3. Try Supabase in background
    try {
      const { error } = await supabase
        .from('user_sessions_v2')
        .upsert({
          user_id: this.uid,
          date: session.date,
          duration: session.duration,
          label: session.label ?? null,
          note: session.note ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' });

      if (error) throw error;

      // 4. Success: remove from pending queue
      this.removeFromPendingQueue(session.date);
      console.log('[SupabaseAdapter] addSession: Supabase upsert ✓');
      this.broadcast('sessions');
    } catch (err) {
      // Session is safe in local cache + pending queue — will retry on next sync
      console.warn('[SupabaseAdapter] addSession: Supabase write failed, queued for retry:', err);
    }
  }

  /** Atomically update a session's label/note. */
  async updateSession(date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>): Promise<void> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('label' in patch) updateData.label = patch.label ?? null;
    if ('note' in patch) updateData.note = patch.note ?? null;

    const { error } = await supabase
      .from('user_sessions_v2')
      .update(updateData)
      .eq('user_id', this.uid)
      .eq('date', date);
    if (error) throw error;
    // Update cache
    const cached = SupabaseAdapter.getCachedSessions() ?? [];
    this.cacheSessions(cached.map(s => s.date === date ? { ...s, ...patch } : s));
    this.broadcast('sessions');
  }

  /** Atomically delete a session by date. */
  async deleteSession(date: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions_v2')
      .delete()
      .eq('user_id', this.uid)
      .eq('date', date);
    if (error) throw error;
    // Update cache
    const cached = SupabaseAdapter.getCachedSessions() ?? [];
    this.cacheSessions(cached.filter(s => s.date !== date));
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
    const settings = { ...DEFAULT_SETTINGS, ...(data?.data as Partial<PomodoroSettings>) };
    this.cacheSettings(settings);
    return settings;
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    this.cacheSettings(settings);
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
      supabase.from('user_sessions_v2').delete().eq('user_id', this.uid),
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

  /** Create (or recreate) the broadcast channel with reconnection logic. */
  private setupChannel(): void {
    // Tear down existing channel first
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SupabaseAdapter] Broadcast channel connected');
          this.reconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[SupabaseAdapter] Broadcast channel error/timeout, scheduling reconnect');
          this.scheduleReconnect();
        } else if (status === 'CLOSED') {
          console.warn('[SupabaseAdapter] Broadcast channel closed, scheduling reconnect');
          this.scheduleReconnect();
        }
      });
  }

  /** Exponential backoff reconnect: 1s → 2s → 4s → ... → 30s max. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return; // Already scheduled
    if (this.listeners.size === 0) return; // No subscribers, don't bother

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    console.log(`[SupabaseAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.size > 0 && navigator.onLine) {
        this.setupChannel();
      }
    }, delay);
  }

  /**
   * リモートデータ変更を購読する。
   * 最初の購読時に Broadcast チャンネルを作成し、最後の購読解除時に破棄する。
   */
  onRemoteChange(callback: (table: 'sessions' | 'settings') => void): () => void {
    this.listeners.add(callback);

    // Lazy channel creation on first subscriber
    if (!this.channel) {
      this.setupChannel();
    }

    return () => {
      this.listeners.delete(callback);
      // Clean up channel when last subscriber leaves
      if (this.listeners.size === 0) {
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        if (this.channel) { supabase.removeChannel(this.channel); this.channel = null; }
      }
    };
  }
}
