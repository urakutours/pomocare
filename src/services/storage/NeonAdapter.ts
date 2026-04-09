import { neon } from '@/lib/neon';
import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

/**
 * Neon ストレージアダプター
 *
 * Supabase → Neon 移行版。Data API (PostgREST) を使用。
 *
 * テーブル構造（Supabase と同一スキーマ）:
 *   user_sessions_v2(user_id UUID, date TEXT, duration INT, label TEXT, note TEXT, updated_at TIMESTAMPTZ)
 *   user_settings(user_id UUID PK, data JSONB, updated_at TIMESTAMPTZ)
 *
 * クロスデバイス同期:
 *   Supabase Broadcast の代わりにポーリング + visibilitychange で同期。
 *   onRemoteChange コールバックで定期的にサーバーからデータを再取得。
 */
const LEGACY_SETTINGS_CACHE_KEY = 'pomocare-settings-cache';
const LEGACY_SESSIONS_CACHE_KEY = 'pomocare-sessions-cache';

export class NeonAdapter implements StorageService {
  private uid: string;
  private listeners = new Set<(table: 'sessions' | 'settings') => void>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private onlineHandler: (() => void) | null = null;
  private lastSessionsHash = '';
  private lastSettingsHash = '';

  /** Tracks the most recently constructed uid so static methods can scope reads. */
  private static lastUid: string | null = null;

  constructor(uid: string) {
    this.uid = uid;
    NeonAdapter.lastUid = uid;
    this.migrateLegacyCacheKeys();

    // Periodic flush: push pending sessions to server every 60s
    this.flushInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        this.flushPendingSessions().catch(() => {});
      }
    }, 60_000);

    // Reconnect + flush pending when device comes back online
    this.onlineHandler = () => {
      console.log('[NeonAdapter] online — flushing pending');
      this.flushPendingSessions().catch(() => {});
    };
    window.addEventListener('online', this.onlineHandler);
  }

  /** Clean up timers and event listeners. */
  destroy(): void {
    if (this.flushInterval) { clearInterval(this.flushInterval); this.flushInterval = null; }
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.onlineHandler) { window.removeEventListener('online', this.onlineHandler); this.onlineHandler = null; }
  }

  private get settingsCacheKey() { return `pomocare-settings-cache:${this.uid}`; }
  private get sessionsCacheKey() { return `pomocare-sessions-cache:${this.uid}`; }
  private get pendingSessionsKey() { return `pomocare-pending-sessions:${this.uid}`; }

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
      localStorage.removeItem(LEGACY_SETTINGS_CACHE_KEY);
      localStorage.removeItem(LEGACY_SESSIONS_CACHE_KEY);
    } catch { /* ignore */ }
  }

  // ---- Local cache helpers ----

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

  /** Flush locally-queued sessions to Neon. */
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
        const { error } = await neon
          .from('user_sessions_v2')
          .upsert(chunk, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      this.setPendingSessions([]);
    } catch (err) {
      console.warn('[NeonAdapter] flushPendingSessions failed, will retry later:', err);
    }
  }

  static getCachedSettings(): PomodoroSettings | null {
    try {
      const uid = NeonAdapter.lastUid;
      const key = uid ? `pomocare-settings-cache:${uid}` : LEGACY_SETTINGS_CACHE_KEY;
      const raw = localStorage.getItem(key);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : null;
    } catch { return null; }
  }

  static getCachedSessions(): PomodoroSession[] | null {
    try {
      const uid = NeonAdapter.lastUid;
      const key = uid ? `pomocare-sessions-cache:${uid}` : LEGACY_SESSIONS_CACHE_KEY;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  static clearCacheForUser(uid: string): void {
    try {
      localStorage.removeItem(`pomocare-settings-cache:${uid}`);
      localStorage.removeItem(`pomocare-sessions-cache:${uid}`);
      localStorage.removeItem(`pomocare-pending-sessions:${uid}`);
      localStorage.removeItem(LEGACY_SETTINGS_CACHE_KEY);
      localStorage.removeItem(LEGACY_SESSIONS_CACHE_KEY);
    } catch { /* ignore */ }
  }

  // ---- Sessions ----

  async getSessions(): Promise<PomodoroSession[]> {
    const pendingSnapshot = this.getPendingSessions();
    console.log('[NeonAdapter] getSessions: pending snapshot:', pendingSnapshot.length);

    await this.flushPendingSessions();

    // Paginated fetch
    const PAGE_SIZE = 1000;
    const allRows: { date: string; duration: number; label: string | null; note: string | null }[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await neon
        .from('user_sessions_v2')
        .select('date, duration, label, note')
        .eq('user_id', this.uid)
        .order('date', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as typeof allRows));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const serverSessions: PomodoroSession[] = allRows.map(row => ({
      date: row.date,
      duration: row.duration,
      ...(row.label ? { label: row.label } : {}),
      ...(row.note ? { note: row.note } : {}),
    }));
    console.log('[NeonAdapter] getSessions: server returned', serverSessions.length, 'sessions');

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
    console.log('[NeonAdapter] getSessions: merged total:', merged.length, '(pending:', pendingSnapshot.length, ')');
    this.cacheSessions(merged);
    return merged;
  }

  /**
   * Lightweight getSessions — skips pending flush.
   * Used by sync triggers (visibility, polling) for speed.
   */
  async getSessionsFast(): Promise<PomodoroSession[]> {
    const pendingSnapshot = this.getPendingSessions();

    const PAGE_SIZE = 1000;
    const allRows: { date: string; duration: number; label: string | null; note: string | null }[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await neon
        .from('user_sessions_v2')
        .select('date, duration, label, note')
        .eq('user_id', this.uid)
        .order('date', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as typeof allRows));
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
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await neon
        .from('user_sessions_v2')
        .upsert(chunk, { onConflict: 'user_id,date' });
      if (error) throw error;
    }
  }

  async addSession(session: PomodoroSession): Promise<void> {
    console.log('[NeonAdapter] addSession:', session.date);

    // 1. Write to local cache FIRST
    const cached = NeonAdapter.getCachedSessions() ?? [];
    this.cacheSessions([...cached.filter(s => s.date !== session.date), session]);

    // 2. Add to pending queue
    this.addToPendingQueue(session);

    // 3. Try Neon in background
    try {
      const { error } = await neon
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

      this.removeFromPendingQueue(session.date);
      console.log('[NeonAdapter] addSession: Neon upsert ✓');
    } catch (err) {
      console.warn('[NeonAdapter] addSession: Neon write failed, queued for retry:', err);
    }
  }

  async updateSession(date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>): Promise<void> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('label' in patch) updateData.label = patch.label ?? null;
    if ('note' in patch) updateData.note = patch.note ?? null;

    const { error } = await neon
      .from('user_sessions_v2')
      .update(updateData)
      .eq('user_id', this.uid)
      .eq('date', date);
    if (error) throw error;
    const cached = NeonAdapter.getCachedSessions() ?? [];
    this.cacheSessions(cached.map(s => s.date === date ? { ...s, ...patch } : s));
  }

  async deleteSession(date: string): Promise<void> {
    const { error } = await neon
      .from('user_sessions_v2')
      .delete()
      .eq('user_id', this.uid)
      .eq('date', date);
    if (error) throw error;
    const cached = NeonAdapter.getCachedSessions() ?? [];
    this.cacheSessions(cached.filter(s => s.date !== date));
  }

  // ---- Settings ----

  async getSettings(): Promise<PomodoroSettings> {
    const { data, error } = await neon
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
    const { error } = await neon
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
      neon.from('user_sessions_v2').delete().eq('user_id', this.uid),
      neon.from('user_settings').delete().eq('user_id', this.uid),
    ]);
  }

  // ---- Cross-device sync via polling ----

  /**
   * リモートデータ変更を購読する。
   * Supabase Broadcast の代わりにポーリングで変更を検出。
   */
  onRemoteChange(callback: (table: 'sessions' | 'settings') => void): () => void {
    this.listeners.add(callback);

    // Start polling when first subscriber arrives
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        if (navigator.onLine && document.visibilityState === 'visible') {
          this.checkForRemoteChanges();
        }
      }, 30_000); // 30秒間隔
    }

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  private async checkForRemoteChanges(): Promise<void> {
    try {
      // Check sessions
      const { data: sessionsData } = await neon
        .from('user_sessions_v2')
        .select('date')
        .eq('user_id', this.uid)
        .order('date', { ascending: false })
        .limit(1);

      const hash = (sessionsData?.length ?? 0) + ':' + (sessionsData?.[0]?.date ?? '');
      if (hash !== this.lastSessionsHash && this.lastSessionsHash !== '') {
        for (const listener of this.listeners) listener('sessions');
      }
      this.lastSessionsHash = hash;

      // Check settings
      const { data: settingsData } = await neon
        .from('user_settings')
        .select('updated_at')
        .eq('user_id', this.uid)
        .single();

      const settingsHash = settingsData?.updated_at ?? '';
      if (settingsHash !== this.lastSettingsHash && this.lastSettingsHash !== '') {
        for (const listener of this.listeners) listener('settings');
      }
      this.lastSettingsHash = settingsHash as string;
    } catch {
      // ignore polling errors
    }
  }
}
