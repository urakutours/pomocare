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
 * 認証リダイレクト先のベースURL。
 * ネイティブアプリ: カスタムスキームでアプリを直接起動
 * Web: 現在のオリジン
 */
export function getAuthRedirectBase(): string {
  if (isNative()) return 'com.pomocare.app://auth';
  return window.location.origin + window.location.pathname;
}
