import { LocalStorageAdapter } from './LocalStorageAdapter';
import { NeonAdapter } from './NeonAdapter';
import type { StorageService } from './types';

export type { StorageService };
export { LocalStorageAdapter, NeonAdapter };

/** 匿名（未ログイン）用 — localStorage */
export function createStorageService(): StorageService {
  return new LocalStorageAdapter();
}

/** ログイン済みユーザー用 — Neon (PostgreSQL + Data API) */
export function createNeonStorageService(uid: string): StorageService {
  return new NeonAdapter(uid);
}
