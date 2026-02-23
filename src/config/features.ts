import type { UserTier } from '@/services/auth/AuthService';

export interface FeatureFlags {
  cloudSync: boolean;
  exportData: boolean;
  advancedStats: boolean;
  sessionNotes: boolean;
  unlimitedLabels: boolean;
  adFree: boolean;
  maxLabels: number;
}

const PAID_FLAGS: FeatureFlags = {
  cloudSync: true,
  exportData: true,
  advancedStats: true,
  sessionNotes: true,
  unlimitedLabels: true,
  adFree: true,
  maxLabels: Infinity,
};

export const FEATURE_FLAGS: Record<UserTier, FeatureFlags> = {
  free: {
    cloudSync: false,
    exportData: false,
    advancedStats: false,
    sessionNotes: false,
    unlimitedLabels: false,
    adFree: false,
    maxLabels: 2,
  },
  standard: { ...PAID_FLAGS },
  pro: { ...PAID_FLAGS },
};
