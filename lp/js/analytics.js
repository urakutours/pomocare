/**
 * LP (pomocare.com) 用 Google Analytics 4 ローダー。
 *
 * - Consent Mode v2: 初期は analytics_storage=denied
 * - 既存の Cookie 同意バナー（'pomocare-cookie-consent' キー）に従う
 *   - 'accepted' → analytics_storage=granted に昇格
 *   - 'declined' → denied のまま（計測なし）
 * - ページ読み込み後に同意を変更した場合もすぐ反映される
 */
(function () {
  var GA4_ID = 'G-2J9Z1KFYGC';
  var CONSENT_KEY = 'pomocare-cookie-consent';

  // gtag のブートストラップ
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 — デフォルトはすべて denied
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  gtag('js', new Date());
  gtag('config', GA4_ID, { send_page_view: true });

  // 既に同意済みなら即座に昇格
  try {
    var consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'accepted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    } else if (consent === 'declined') {
      gtag('consent', 'update', { analytics_storage: 'denied' });
    }
  } catch (e) { /* localStorage 無効環境 */ }

  // GA4 スクリプトを読み込み
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);

  // main.js が同意バナーをクリックされた時にカスタムイベントを発火させている想定は無いが、
  // storage イベント（他タブでの変更）で同期する
  window.addEventListener('storage', function (e) {
    if (e.key !== CONSENT_KEY) return;
    if (e.newValue === 'accepted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    } else if (e.newValue === 'declined') {
      gtag('consent', 'update', { analytics_storage: 'denied' });
    }
  });

  // 同じタブ内での同意変更（main.js の cookieAccept/Decline クリック）用に
  // localStorage の値を監視するポーリングを 3 秒だけ走らせる（同意は初回訪問時のみ）
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    try {
      var v = localStorage.getItem(CONSENT_KEY);
      if (v === 'accepted') {
        gtag('consent', 'update', { analytics_storage: 'granted' });
        clearInterval(iv);
      } else if (v === 'declined') {
        gtag('consent', 'update', { analytics_storage: 'denied' });
        clearInterval(iv);
      }
    } catch (e) { /* noop */ }
    if (tries > 30) clearInterval(iv); // 3 秒で打ち切り (100ms * 30)
  }, 100);
})();
