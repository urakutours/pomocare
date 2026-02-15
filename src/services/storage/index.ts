import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { StorageService } from './types';

export type { StorageService };

export function createStorageService(): StorageService {
  return new LocalStorageAdapter();
}
