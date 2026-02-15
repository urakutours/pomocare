import type { UserTier } from '@/services/auth/AuthService';

export interface FeatureFlags {
  customSounds: boolean;
  exportData: boolean;
  cloudSync: boolean;
  advancedStats: boolean;
  themes: boolean;
}

export const FEATURE_FLAGS: Record<UserTier, FeatureFlags> = {
  free: {
    customSounds: false,
    exportData: false,
    cloudSync: false,
    advancedStats: false,
    themes: false,
  },
  pro: {
    customSounds: true,
    exportData: true,
    cloudSync: true,
    advancedStats: true,
    themes: true,
  },
};
