import { workerPost } from '@/lib/api';

export type CheckoutPlan = 'standard' | 'pro';

export interface CreateCheckoutResult {
  url: string;
}

export async function createCheckoutSession(
  plan: CheckoutPlan,
  language: string,
): Promise<CreateCheckoutResult> {
  return workerPost<CreateCheckoutResult>('/create-checkout-session', { plan, language });
}

export async function createPortalSession(language: string): Promise<{ url: string }> {
  return workerPost<{ url: string }>('/create-portal-session', { language });
}

export async function cancelSubscription(): Promise<{ success: boolean }> {
  return workerPost<{ success: boolean }>('/cancel-subscription');
}
