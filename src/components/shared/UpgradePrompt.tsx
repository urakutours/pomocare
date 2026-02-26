import { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { createCheckoutSession, type CheckoutPlan } from '@/services/stripe/StripeService';
import type { UserTier } from '@/services/auth/AuthService';

// ---------- Discount helpers ----------
const MAX_DISCOUNT_MONTHS = 6;

const MONTHLY_PRICE: Record<string, { amount: number; symbol: string }> = {
  ja:  { amount: 250,  symbol: '¥' },
  en:  { amount: 2.49, symbol: '$' },
  es:  { amount: 2.49, symbol: '$' },
  pt:  { amount: 2.49, symbol: '$' },
  de:  { amount: 2.49, symbol: '€' },
  fr:  { amount: 2.49, symbol: '€' },
  it:  { amount: 2.49, symbol: '€' },
};

const PRO_PRICE: Record<string, { amount: number; symbol: string }> = {
  ja:  { amount: 5000,  symbol: '¥' },
  en:  { amount: 39.99, symbol: '$' },
  es:  { amount: 39.99, symbol: '$' },
  pt:  { amount: 39.99, symbol: '$' },
  de:  { amount: 39.99, symbol: '€' },
  fr:  { amount: 39.99, symbol: '€' },
  it:  { amount: 39.99, symbol: '€' },
};

function formatPrice(amount: number, symbol: string, lang: string): string {
  // JPY: ¥5,000  Others: $39.99 / €39.99
  if (lang === 'ja') return `${symbol}${Math.round(amount).toLocaleString()}`;
  return `${symbol}${amount.toFixed(2)}`;
}

function calcDiscount(subscriptionStartDate: string | null, language: string) {
  if (!subscriptionStartDate) return null;

  const start = new Date(subscriptionStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const months = Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
  const discountMonths = Math.min(Math.max(months, 0), MAX_DISCOUNT_MONTHS);

  if (discountMonths === 0) return null;

  const monthly = MONTHLY_PRICE[language] ?? MONTHLY_PRICE.en;
  const pro = PRO_PRICE[language] ?? PRO_PRICE.en;
  const discountAmount = discountMonths * monthly.amount;
  const finalPrice = Math.max(pro.amount - discountAmount, 0);

  return {
    months: discountMonths,
    discountAmount,
    finalPrice,
    symbol: pro.symbol,
  };
}

// ---------- Component ----------

interface UpgradePromptProps {
  onClose: () => void;
  /** ログインモーダルを開かせたいときに呼ぶコールバック（未ログイン時） */
  onRequestLogin?: () => void;
  /** 呼び出し元から渡される現在のtier */
  currentTier?: UserTier;
  /** Standard会員のサブスク開始日 */
  subscriptionStartDate?: string | null;
}

export function UpgradePrompt({ onClose, onRequestLogin, currentTier, subscriptionStartDate }: UpgradePromptProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tier = currentTier ?? user?.tier ?? 'free';
  const isStandard = tier === 'standard';
  const isLoading = loadingPlan !== null;

  // 割引計算（Standard → Pro 時のみ）
  const discount = useMemo(() => {
    if (!isStandard) return null;
    return calcDiscount(subscriptionStartDate ?? user?.subscriptionStartDate ?? null, language);
  }, [isStandard, subscriptionStartDate, user?.subscriptionStartDate, language]);

  const handleCheckout = async (plan: CheckoutPlan) => {
    // 未ログインの場合はログインを促す
    if (!user) {
      if (onRequestLogin) {
        onClose();
        onRequestLogin();
      } else {
        window.open('https://pomocare.com/#pricing', '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setError(null);
    setLoadingPlan(plan);

    try {
      const { url } = await createCheckoutSession(plan, language);
      // Stripe Hosted Checkout ページへリダイレクト
      window.location.href = url;
    } catch (err) {
      console.error('[UpgradePrompt] Checkout error:', err);
      setError(err instanceof Error ? err.message : t.checkoutError);
      setLoadingPlan(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-neutral-700 rounded-xl shadow-xl w-full max-w-xs p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold text-neutral-800 dark:text-white mb-2 pr-6">
          {isStandard ? t.upgradeToProTitle : t.upgradeTitle}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          {isStandard ? t.upgradeToProDescription : t.upgradeDescription}
        </p>

        {/* 割引情報（Standard → Pro） */}
        {isStandard && discount && (
          <div className="mb-3 px-3 py-2 bg-tiffany/10 dark:bg-tiffany/15 rounded-lg">
            <p className="text-xs font-medium text-tiffany">
              {t.proDiscountInfo
                .replace('{months}', String(discount.months))
                .replace('{amount}', formatPrice(discount.discountAmount, discount.symbol, language))
              }
            </p>
            <p className="text-sm font-bold text-tiffany mt-0.5">
              {t.proDiscountedPrice
                .replace('{price}', formatPrice(discount.finalPrice, discount.symbol, language))
              }
            </p>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {/* Standard プラン: サブスクリプション（Free時のみ表示） */}
          {!isStandard && (
            <button
              onClick={() => handleCheckout('standard')}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tiffany text-white font-semibold hover:bg-tiffany-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingPlan === 'standard' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {t.upgradeStandard} — {t.upgradeStandardPrice}
            </button>
          )}

          {/* Pro プラン: 買い切り */}
          <button
            onClick={() => handleCheckout('pro')}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              isStandard
                ? 'bg-tiffany text-white hover:bg-tiffany-hover'
                : 'border border-tiffany text-tiffany hover:bg-tiffany/10 dark:hover:bg-tiffany/20'
            }`}
          >
            {loadingPlan === 'pro' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {t.upgradePro} — {discount
              ? formatPrice(discount.finalPrice, discount.symbol, language)
              : t.upgradeProPrice
            }
          </button>
        </div>

        {/* 未ログイン時の注記 */}
        {!user && (
          <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-3">
            {t.checkoutLoginRequired}
          </p>
        )}

        {/* ローディング中のヒント */}
        {isLoading && (
          <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-3">
            {t.checkoutProcessing}
          </p>
        )}
      </div>
    </div>
  );
}
