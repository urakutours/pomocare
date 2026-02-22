import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';

/**
 * 最適化版 Firestore ストレージアダプター
 *
 * 全セッションを1ドキュメントに格納する「単一ドキュメント方式」を採用。
 * 旧方式（sessions サブコレクション）と比較して操作数を 99% 削減。
 *
 * データ構造:
 *   users/{uid}/data/sessions → { items: PomodoroSession[] }
 *   users/{uid}/data/settings → PomodoroSettings
 *
 * 操作コスト（旧 → 新）:
 *   アプリ起動:    N reads → 2 reads
 *   セッション追加: N reads + N deletes + (N+1) writes → 1 write
 *   設定変更:      1 write → 1 write（変化なし）
 *
 * Firestore 1ドキュメント上限 = 1MB
 * セッション1件 ≈ 100bytes → 約10,000件（≈7年分）格納可能
 *
 * NOTE: StorageService インターフェースを維持しているため、
 * 将来 Supabase 等へ移行する際はアダプターを差し替えるだけでOK。
 */
export class FirestoreAdapter implements StorageService {
  private uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  // ---- Sessions ----

  async getSessions(): Promise<PomodoroSession[]> {
    const ref = doc(db, 'users', this.uid, 'data', 'sessions');
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data();
    return (data.items as PomodoroSession[]) ?? [];
  }

  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    const ref = doc(db, 'users', this.uid, 'data', 'sessions');
    await setDoc(ref, { items: sessions });
  }

  // ---- Settings ----

  async getSettings(): Promise<PomodoroSettings> {
    const ref = doc(db, 'users', this.uid, 'data', 'settings');
    const snap = await getDoc(ref);
    if (!snap.exists()) return {} as PomodoroSettings;
    return snap.data() as PomodoroSettings;
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    const ref = doc(db, 'users', this.uid, 'data', 'settings');
    await setDoc(ref, settings);
  }

  // ---- Clear ----

  async clearAll(): Promise<void> {
    const sessRef = doc(db, 'users', this.uid, 'data', 'sessions');
    const settRef = doc(db, 'users', this.uid, 'data', 'settings');
    await Promise.all([deleteDoc(sessRef), deleteDoc(settRef)]);
  }
}
