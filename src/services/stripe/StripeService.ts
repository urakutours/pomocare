import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type CheckoutPlan = 'standard' | 'pro';

export interface CreateCheckoutResult {
  url: string;
}

/**
 * SDK の refreshSession() がハングすることがあるため、
 * fetch で直接トークンをリフレッシュするヘルパー。
 */
async function getFreshAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // トークンの有効期限を確認（60秒以内に切れる場合はリフレッシュ）
  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt - now > 60) {
    console.log('[Stripe] Token still valid, expires in', expiresAt - now, 'seconds');
    return session.access_token;
  }

  console.log('[Stripe] Token expired or expiring soon, refreshing via fetch...');
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!res.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await res.json();
  console.log('[Stripe] Token refreshed successfully');

  // SDK のセッションも更新
  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  return data.access_token as string;
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
  console.log('[Stripe] 1. Starting checkout:', { plan, language });

  const accessToken = await getFreshAccessToken();
  console.log('[Stripe] 2. Got access token');

  console.log('[Stripe] 3. Calling Edge Function...');
  const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ plan, language }),
  });
  console.log('[Stripe] 4. Response status:', res.status);

  if (!res.ok) {
    let errMsg = 'Checkout failed';
    try {
      const errData = await res.json();
      console.log('[Stripe] 5. Error data:', errData);
      if (errData.error) errMsg = errData.error;
      if (errData.message) errMsg = errData.message;
    } catch {
      // JSON パース失敗時はデフォルトメッセージを使用
    }
    throw new Error(errMsg);
  }

  const data = await res.json() as CreateCheckoutResult;
  console.log('[Stripe] 5. Checkout URL received:', data.url ? 'yes' : 'no');
  return data;
}

/**
 * Supabase Edge Function を呼び出して Stripe Customer Portal セッションを作成し、
 * ポータルの URL を返す（サブスクリプション管理・解約用）。
 */
export async function createPortalSession(language: string): Promise<{ url: string }> {
  console.log('[Stripe] Portal: Starting...');

  const accessToken = await getFreshAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ language }),
  });

  if (!res.ok) {
    let errMsg = 'Portal session failed';
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return await res.json() as { url: string };
}
