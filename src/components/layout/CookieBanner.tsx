import { useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { analytics } from '@/services/analytics/AnalyticsService';

const CONSENT_KEY = 'pomocare-cookie-consent';

/**
 * Cookie 同意バナー。
 * Google Analytics を含む計測目的の Cookie 使用について、初回訪問時に同意を取る。
 * localStorage に保存されるため、2回目以降は表示されない。
 */
export function CookieBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        // 少し遅延させて FOUC を避ける
        const timer = window.setTimeout(() => setVisible(true), 800);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // localStorage 無効環境では表示しない
    }
  }, []);

  const handleAccept = () => {
    analytics.setConsent('accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    analytics.setConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] mx-auto bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-4 flex flex-col gap-3"
    >
      <p className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
        {t.cookieConsentMessage}
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleDecline}
          className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
        >
          {t.cookieConsentDecline}
        </button>
        <button
          onClick={handleAccept}
          className="px-3 py-1.5 text-xs rounded bg-tiffany hover:bg-tiffany-hover text-white transition-colors"
        >
          {t.cookieConsentAccept}
        </button>
      </div>
    </div>
  );
}
