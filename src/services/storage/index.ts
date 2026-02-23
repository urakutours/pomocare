import { LocalStorageAdapter } from './LocalStorageAdapter';
import { SupabaseAdapter } from './SupabaseAdapter';
import type { StorageService } from './types';

export type { StorageService };
export { LocalStorageAdapter, SupabaseAdapter };

/** 匿名（未ログイン）用 — localStorage */
export function createStorageService(): StorageService {
  return new LocalStorageAdapter();
}

/** ログイン済みユーザー用 — Supabase (PostgreSQL + JSONB) */
export function createSupabaseStorageService(uid: string): StorageService {
  return new SupabaseAdapter(uid);
}
