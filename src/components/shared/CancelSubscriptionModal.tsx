import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { cancelSubscription } from '@/services/stripe/StripeService';

interface CancelSubscriptionModalProps {
  onClose: () => void;
  onCancelled: () => void;
}

export function CancelSubscriptionModal({ onClose, onCancelled }: CancelSubscriptionModalProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isTrialing = user?.subscriptionStatus === 'trialing';

  // トライアル終了日と残日数の計算
  const trialEndDate = user?.subscriptionCurrentPeriodEnd
    ? new Date(user.subscriptionCurrentPeriodEnd)
    : null;

  const daysRemaining = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const formattedDate = trialEndDate
    ? trialEndDate.toLocaleDateString(
        language === 'ja' ? 'ja-JP' : language,
        { month: 'short', day: 'numeric' },
      )
    : '';

  const handleCancel = async () => {
    setError(null);
    setLoading(true);

    try {
      await cancelSubscription();
      setSuccess(true);
      onCancelled();
      // 少し待ってからモーダルを閉じる
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('[CancelSubscription] Error:', err);
      setError(err instanceof Error ? err.message : t.cancelSubscriptionError);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-neutral-700 rounded-xl shadow-xl w-full max-w-xs p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {success ? (
          /* 成功表示 */
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-800 dark:text-white">
              {t.cancelSubscriptionSuccess}
            </p>
          </div>
        ) : (
          <>
            {/* タイトル */}
            <h3 className="text-lg font-bold text-neutral-800 dark:text-white mb-2 pr-6">
              {t.cancelSubscriptionTitle}
            </h3>

            {/* トライアル情報ボックス */}
            {isTrialing && trialEndDate && (
              <div className="mb-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t.cancelSubscriptionTrialInfo.replace('{date}', formattedDate)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {t.cancelSubscriptionDaysLeft.replace('{days}', String(daysRemaining))}
                </p>
              </div>
            )}

            {/* 警告 */}
            <div className="flex gap-2 mb-4">
              <AlertTriangle size={16} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t.cancelSubscriptionWarning}
              </p>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* ボタン */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {t.cancelSubscriptionConfirm}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-100 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-500 transition-colors disabled:opacity-60"
              >
                {t.cancelSubscriptionKeep}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
