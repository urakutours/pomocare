import type { UserTier } from '@/services/auth/AuthService';
import { isNative } from '@/utils/platform';

/**
 * 広告 kill-switch。
 * - false（現在）: 広告を一切表示しない。AdMob SDK も初期化しない。
 * - true（収益化時）: 以下の作業を合わせて行うこと:
 *   1. AdBanner.tsx の ADMOB_BANNER_ID を本番 ID（ca-app-pub-5675101743750825/4761723348）へ差替
 *   2. AdBanner.tsx の isTesting: false に変更
 *   3. main.tsx の initializeForTesting: false（または削除）に変更
 */
export const ADS_ENABLED = false;

/**
 * 決済 UI kill-switch（Play 消費専用アプリ要件、① judgment 2026-06-13）。
 * - Web / PWA: true — Stripe checkout / portal が全機能する
 * - Android native: false — 購入・ポータル UI を構造的に出さない（Netflix 型）
 *
 * native で決済を再開する場合は Google Play Billing 統合とセットで flip すること。
 * Pro 機能自体は native でも有効のまま（tier は Web で購入 → Neon 経由で native が消費）。
 */
export const PAYMENTS_UI_ENABLED = !isNative();

export interface FeatureFlags {
  cloudSync: boolean;
  multiDevice: boolean;
  exportData: boolean;
  advancedStats: boolean;
  sessionNotes: boolean;
  unlimitedLabels: boolean;
  adFree: boolean;
  maxLabels: number;
}

const PAID_FLAGS: FeatureFlags = {
  cloudSync: true,
  multiDevice: true,
  exportData: true,
  advancedStats: true,
  sessionNotes: true,
  unlimitedLabels: true,
  adFree: true,
  maxLabels: Infinity,
};

export const FEATURE_FLAGS: Record<UserTier, FeatureFlags> = {
  free: {
    cloudSync: true,
    multiDevice: true,
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
