/**
 * Google Analytics 4 への接続と、Cookie 同意ベースのゲーティング。
 *
 * - 初期状態: Consent Mode v2 で analytics_storage=denied
 * - ユーザーが CookieBanner で「同意」を選択したら granted に昇格
 * - 拒否したら以降 track() は no-op
 *
 * 呼び出し元（useTimer.ts, useInstallPrompt.ts 等）はこれまで通り
 * analytics.track({ name, properties }) を呼ぶだけで、内部で gtag に委譲される。
 */

const GA4_MEASUREMENT_ID = 'G-2J9Z1KFYGC';
const CONSENT_KEY = 'pomocare-cookie-consent';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
}

type ConsentStatus = 'granted' | 'denied' | 'unknown';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getConsentStatus(): ConsentStatus {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'accepted') return 'granted';
    if (v === 'declined') return 'denied';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function loadGtag() {
  if (typeof window === 'undefined') return;
  if (window.gtag) return; // already loaded

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    (window.dataLayer ??= []).push(args);
  };
  // 初期デフォルトは denied（プライバシーファースト）。
  // 後から updateConsent('granted') で解放する。
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
  window.gtag('js', new Date());
  window.gtag('config', GA4_MEASUREMENT_ID, {
    send_page_view: true,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function updateConsent(status: 'granted' | 'denied') {
  if (!window.gtag) return;
  window.gtag('consent', 'update', {
    analytics_storage: status,
    // 広告関連は Pomocare では使わないので denied のまま
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

class AnalyticsService {
  private initialized = false;

  /** アプリ起動時に 1 度だけ呼ぶ */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    loadGtag();

    // 既に同意済みなら即座に granted に昇格
    const status = getConsentStatus();
    if (status === 'granted') updateConsent('granted');
    if (status === 'denied') updateConsent('denied');
  }

  /** ユーザーが CookieBanner で選択した結果を反映 */
  setConsent(consent: 'accepted' | 'declined'): void {
    try {
      localStorage.setItem(CONSENT_KEY, consent);
    } catch {
      // localStorage が使えない環境では諦める
    }
    updateConsent(consent === 'accepted' ? 'granted' : 'denied');
  }

  /** イベント送信（未同意なら dataLayer に積まれるだけで送信されない） */
  track(event: AnalyticsEvent): void {
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event.name, event.properties);
    }
    if (typeof window === 'undefined' || !window.gtag) return;
    window.gtag('event', event.name, event.properties);
  }

  /** 現在の同意状態 */
  getConsentStatus(): ConsentStatus {
    return getConsentStatus();
  }
}

export const analytics = new AnalyticsService();
