import { Capacitor } from '@capacitor/core';

/** Detect iOS (iPhone, iPad, iPod) including iPadOS on Safari */
export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** True when running inside a Capacitor native app (Android or iOS) */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** True when running on Android (native or web browser) */
export function isAndroidPlatform(): boolean {
  return Capacitor.getPlatform() === 'android' || /Android/.test(navigator.userAgent);
}

/**
 * Whether users can purchase Pro/Standard plans in this context.
 * Returns false on Android native (Google Play Billing not yet integrated in v1.0).
 * Web/PWA returns true — Stripe checkout is available.
 *
 * TODO v1.1: enable after Google Play Billing integration.
 */
export function canPurchaseProPlan(): boolean {
  return !isNative();
}

/**
 * 認証リダイレクト先のベースURL。
 * ネイティブアプリ: GitHub Pages 上の中間リダイレクトページ経由でカスタムスキームへ転送。
 *   Neon Auth の trustedOrigins が https:// 以外を受け付けないため、
 *   app.pomocare.com（既に trusted）を中継する。
 * Web: 現在のオリジン
 */
export function getAuthRedirectBase(): string {
  if (isNative()) return 'https://app.pomocare.com/auth/native-callback';
  return window.location.origin + window.location.pathname;
}
