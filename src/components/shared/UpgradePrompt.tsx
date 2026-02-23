import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { createCheckoutSession, type CheckoutPlan } from '@/services/stripe/StripeService';

interface UpgradePromptProps {
  onClose: () => void;
  /** ログインモーダルを開かせたいときに呼ぶコールバック（未ログイン時） */
  onRequestLogin?: () => void;
}

export function UpgradePrompt({ onClose, onRequestLogin }: UpgradePromptProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoading = loadingPlan !== null;

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
          {t.upgradeTitle}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          {t.upgradeDescription}
        </p>

        {/* エラーメッセージ */}
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {/* Standard プラン: サブスクリプション */}
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

          {/* Pro プラン: 買い切り */}
          <button
            onClick={() => handleCheckout('pro')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-tiffany text-tiffany font-semibold hover:bg-tiffany/10 dark:hover:bg-tiffany/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingPlan === 'pro' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {t.upgradePro} — {t.upgradeProPrice}
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
