import { workerPost } from '@/lib/api';
import { PAYMENTS_UI_ENABLED } from '@/config/features';

export type CheckoutPlan = 'standard' | 'pro';

export interface CreateCheckoutResult {
  url: string;
}

/**
 * Stripe Checkout セッションを作成する。
 * native では PAYMENTS_UI_ENABLED=false のため即 throw（fail-closed）。
 * UI ガード（UpgradePrompt self-guard / canPurchaseProPlan ガード）をすり抜けた場合の
 * 二重防御として機能する（Play 消費専用アプリ要件、① judgment 2026-06-13）。
 */
export async function createCheckoutSession(
  plan: CheckoutPlan,
  language: string,
): Promise<CreateCheckoutResult> {
  if (!PAYMENTS_UI_ENABLED) {
    throw new Error('Payments are not available in this context.');
  }
  return workerPost<CreateCheckoutResult>('/create-checkout-session', { plan, language });
}

/**
 * Stripe カスタマーポータルセッションを作成する。
 * native では PAYMENTS_UI_ENABLED=false のため即 throw（fail-closed）。
 */
export async function createPortalSession(language: string): Promise<{ url: string }> {
  if (!PAYMENTS_UI_ENABLED) {
    throw new Error('Payments are not available in this context.');
  }
  return workerPost<{ url: string }>('/create-portal-session', { language });
}

/**
 * サブスクリプションをキャンセルする。
 * 自社 Worker への直接 API 呼び出しであり Stripe Portal/Checkout には到達しない。
 * Play 消費専用アプリポリシー上、解約導線は native でも許容されるため throw しない。
 */
export async function cancelSubscription(): Promise<{ success: boolean }> {
  return workerPost<{ success: boolean }>('/cancel-subscription');
}
