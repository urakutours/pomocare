import { LocalStorageAdapter } from './LocalStorageAdapter';
import { FirestoreAdapter } from './FirestoreAdapter';
import type { StorageService } from './types';

export type { StorageService };
export { LocalStorageAdapter, FirestoreAdapter };

/** 匿名（未ログイン）用 — localStorage */
export function createStorageService(): StorageService {
  return new LocalStorageAdapter();
}

/** ログイン済みユーザー用 — Firestore（単一ドキュメント方式） */
export function createFirestoreStorageService(uid: string): StorageService {
  return new FirestoreAdapter(uid);
}
