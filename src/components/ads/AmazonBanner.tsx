import { useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import {
  buildAffiliateUrl,
  getAffiliateConfig,
  hasAffiliateTrackingId,
  pickRotatingProduct,
} from '@/config/affiliates';

/**
 * Web / PWA 向けアフィリエイトバナー。
 *
 * - ユーザーの言語から地域（Amazon host + trackingId）を解決
 * - trackingId 未設定の地域では PomoCare Pro 誘導にフォールバック
 * - ローテーション表示で同じ商品ばかり出さない
 * - 「広告」ラベルを常時表示（景表法対応）
 *
 * 注: Android ネイティブでは AdMob が使われるので、本コンポーネントは呼ばれない。
 */
export function AmazonBanner() {
  const { language, t } = useI18n();

  const { href, emoji, title, subtitle, cta, sponsored } = useMemo(() => {
    const config = getAffiliateConfig(language);
    const product = pickRotatingProduct(config);

    // 未登録地域 or 商品リスト空 → 自社 Pro 誘導にフォールバック
    if (!hasAffiliateTrackingId(config) || !product) {
      return {
        href: '#upgrade',
        emoji: '✨',
        title: t.affiliateUpsellTitle,
        subtitle: t.affiliateUpsellSubtitle,
        cta: t.affiliateUpsellCta,
        sponsored: false,
      };
    }

    return {
      href: buildAffiliateUrl(config, product),
      emoji: product.emoji,
      title: product.title,
      subtitle: product.subtitle ?? '',
      cta: t.affiliateCtaAmazon,
      sponsored: true,
    };
  }, [language, t]);

  // 自社誘導の場合は同一タブ内遷移（将来 Checkout へのリンクに差し替え想定）
  // 外部アフィリエイトの場合は別タブで開く
  const isExternal = sponsored;

  return (
    <div className="flex-shrink-0 bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'sponsored noopener noreferrer' : undefined}
        className="max-w-sm mx-auto flex items-center gap-3 py-2 px-4 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
      >
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate">
              {title}
            </p>
            {sponsored && (
              <span className="flex-shrink-0 text-[10px] leading-none px-1 py-0.5 rounded bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-300">
                {t.adDisclosure}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-600 dark:text-neutral-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <span className="text-xs font-medium text-tiffany whitespace-nowrap flex-shrink-0">
          {cta} →
        </span>
      </a>
    </div>
  );
}
