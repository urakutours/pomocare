import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StorageService } from './types';
import type { PomodoroSession } from '@/types/session';
import type { PomodoroSettings } from '@/types/settings';

/**
 * Firestore ストレージアダプター
 * ログイン済みユーザーのデータを Firestore に保存する
 *
 * データ構造:
 *   users/{uid}/settings  — PomodoroSettings (単一ドキュメント)
 *   users/{uid}/sessions/{date} — PomodoroSession (date をIDに使用)
 */
export class FirestoreAdapter implements StorageService {
  private uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  // ---- Sessions ----

  async getSessions(): Promise<PomodoroSession[]> {
    const ref = collection(db, 'users', this.uid, 'sessions');
    const snap = await getDocs(ref);
    return snap.docs.map((d) => d.data() as PomodoroSession);
  }

  async saveSessions(sessions: PomodoroSession[]): Promise<void> {
    // バッチ書き込みで全セッションを上書き保存
    // Firestore の1バッチ上限は500件。超える場合は分割する。
    const BATCH_SIZE = 400;
    const ref = collection(db, 'users', this.uid, 'sessions');

    // 既存ドキュメントをすべて削除してから書き直す（差分管理より確実）
    const existingSnap = await getDocs(ref);
    for (let i = 0; i < existingSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      existingSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 新しいセッションを保存
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      sessions.slice(i, i + BATCH_SIZE).forEach((s) => {
        // date (ISO文字列) をドキュメントIDとして使用（特殊文字をエスケープ）
        const docId = encodeURIComponent(s.date);
        const docRef = doc(db, 'users', this.uid, 'sessions', docId);
        batch.set(docRef, s);
      });
      await batch.commit();
    }
  }

  // ---- Settings ----

  async getSettings(): Promise<PomodoroSettings> {
    const ref = doc(db, 'users', this.uid, 'data', 'settings');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // まだ保存されていない場合は空オブジェクトを返す（useSettings のデフォルト値が使われる）
      return {} as PomodoroSettings;
    }
    return snap.data() as PomodoroSettings;
  }

  async saveSettings(settings: PomodoroSettings): Promise<void> {
    const ref = doc(db, 'users', this.uid, 'data', 'settings');
    await setDoc(ref, settings);
  }

  async clearAll(): Promise<void> {
    // セッションを全削除
    const sessRef = collection(db, 'users', this.uid, 'sessions');
    const snap = await getDocs(sessRef);
    const BATCH_SIZE = 400;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    // 設定も削除
    const settRef = doc(db, 'users', this.uid, 'data', 'settings');
    await deleteDoc(settRef);
  }
}
