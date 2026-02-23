import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import type { CheckoutPlan } from '@/services/stripe/StripeService';

interface PaymentSuccessToastProps {
  plan: CheckoutPlan;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 6000;

export function PaymentSuccessToast({ plan, onClose }: PaymentSuccessToastProps) {
  const { t } = useI18n();

  // 一定時間後に自動で閉じる
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  const message = plan === 'pro' ? t.paymentSuccessPro : t.paymentSuccessStandard;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-tiffany text-white rounded-xl shadow-lg text-sm font-medium max-w-xs w-full mx-4 animate-fade-in-up">
      <CheckCircle size={18} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
