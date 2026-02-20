import { LocalStorageAdapter } from './LocalStorageAdapter';
import { FirestoreAdapter } from './FirestoreAdapter';
import type { StorageService } from './types';

export type { StorageService };
export { LocalStorageAdapter, FirestoreAdapter };

export function createStorageService(): StorageService {
  return new LocalStorageAdapter();
}

export function createFirestoreStorageService(uid: string): StorageService {
  return new FirestoreAdapter(uid);
}
