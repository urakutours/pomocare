import { supabase } from '@/lib/supabase';

const EDGE_FUNCTION_URL = 'https://cjylcizaikyirdxkwpao.supabase.co/functions/v1';

export type CheckoutPlan = 'standard' | 'pro';

export interface CreateCheckoutResult {
  url: string;
}

/**
 * Supabase Edge Function を呼び出して Stripe Checkout Session を作成し、
 * Stripe Hosted Checkout の URL を返す。
 *
 * @param plan    'standard' | 'pro'
 * @param language  i18n言語コード（通貨選択に使用: ja→JPY, de/fr/it→EUR, others→USD）
 */
export async function createCheckoutSession(
  plan: CheckoutPlan,
  language: string
): Promise<CreateCheckoutResult> {
  // 現在のセッションから JWT を取得
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('Not authenticated. Please log in to purchase.');
  }

  const res = await fetch(`${EDGE_FUNCTION_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan, language }),
  });

  if (!res.ok) {
    let errMsg = 'Checkout failed';
    try {
      const errData = await res.json() as { error?: string };
      if (errData.error) errMsg = errData.error;
    } catch {
      // JSON パース失敗時はデフォルトメッセージを使用
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<CreateCheckoutResult>;
}
