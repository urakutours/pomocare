import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authService, type User, type UserTier } from '@/services/auth/AuthService';
import { authClient, neon } from '@/lib/neon';
import { NeonAdapter } from '@/services/storage/NeonAdapter';
import { App } from '@capacitor/app';
import { isNative } from '@/utils/platform';

const TIER_CACHE_KEY = 'pomocare-cached-tier';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearPasswordRecovery: () => void;
  /** 決済完了後などに呼ぶ: DBからtierを再取得してuserステートを更新する */
  refreshTier: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isPasswordRecovery: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  resendVerificationEmail: async () => {},
  sendPasswordReset: async () => {},
  deleteAccount: async () => {},
  clearPasswordRecovery: () => {},
  refreshTier: async () => {},
});

interface UserProfileData {
  tier: UserTier;
  subscriptionStartDate: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
}

/** Read cached tier from localStorage (fallback for when profile fetch fails). */
function getCachedTier(userId: string): UserTier {
  try {
    const raw = localStorage.getItem(TIER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.userId === userId) return parsed.tier as UserTier;
    }
  } catch { /* ignore */ }
  return 'free';
}

/** Persist tier to localStorage so we can use it as fallback. */
function setCachedTier(userId: string, tier: UserTier) {
  try {
    localStorage.setItem(TIER_CACHE_KEY, JSON.stringify({ userId, tier }));
  } catch { /* ignore */ }
}

async function fetchUserProfile(userId: string): Promise<UserProfileData> {
  try {
    const { data, error } = await neon
      .from('user_profiles')
      .select('tier, subscription_start_date, subscription_status, subscription_current_period_end')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[Auth] No profile row found, creating free tier for', userId);
        await neon.from('user_profiles').insert({ user_id: userId, tier: 'free' });
        setCachedTier(userId, 'free');
        return { tier: 'free', subscriptionStartDate: null, subscriptionStatus: null, subscriptionCurrentPeriodEnd: null };
      }
      console.error('[Auth] fetchUserProfile failed:', error.code, error.message);
      const cached = getCachedTier(userId);
      return { tier: cached, subscriptionStartDate: null, subscriptionStatus: null, subscriptionCurrentPeriodEnd: null };
    }

    const tier = (data.tier as UserTier) ?? 'free';
    setCachedTier(userId, tier);
    return {
      tier,
      subscriptionStartDate: data.subscription_start_date ?? null,
      subscriptionStatus: data.subscription_status ?? null,
      subscriptionCurrentPeriodEnd: data.subscription_current_period_end ?? null,
    };
  } catch (err) {
    console.error('[Auth] fetchUserProfile exception:', err);
    const cached = getCachedTier(userId);
    return { tier: cached, subscriptionStartDate: null, subscriptionStatus: null, subscriptionCurrentPeriodEnd: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Proactive session recovery on tab focus.
  const lastVisibilityCheckRef = useRef(0);
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastVisibilityCheckRef.current < 30_000) return;
      lastVisibilityCheckRef.current = Date.now();

      try {
        const { data } = await authClient.getSession();
        if (!data?.user) return;

        // Session is valid — refresh tier in case it changed while idle
        const profile = await fetchUserProfile(data.user.id);
        setUser(prev => prev && prev.id === data.user.id
          ? { ...prev, tier: profile.tier, subscriptionStartDate: profile.subscriptionStartDate, subscriptionStatus: profile.subscriptionStatus, subscriptionCurrentPeriodEnd: profile.subscriptionCurrentPeriodEnd }
          : prev
        );
      } catch (err) {
        console.error('[Auth] Visibility check error:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Check for password recovery token in URL (Better Auth uses ?token= param)
  // Neon Auth redirects to callbackURL with ?token=xxx appended.
  // We include type=password-reset in the redirectTo so it appears in the final URL.
  // Also accept token-only for robustness (Neon Auth may omit type).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');
    if (token && (type === 'password-reset' || !type)) {
      setIsPasswordRecovery(true);
    }
  }, []);

  // ネイティブアプリ: ディープリンク (appUrlOpen) でパスワードリセットを処理
  // com.pomocare.app://auth?type=password-reset&token=xxx
  // または https://app.pomocare.com?type=password-reset&token=xxx
  useEffect(() => {
    if (!isNative()) return;

    let listenerHandle: { remove: () => void } | null = null;

    App.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');

        if (token && (type === 'password-reset' || !type)) {
          // window.location.search を更新して EmailActionHandler が読めるようにする
          window.history.replaceState(
            {},
            '',
            `?token=${encodeURIComponent(token)}&type=password-reset`,
          );
          setIsPasswordRecovery(true);
        } else if (!token) {
          // OAuth コールバック等: セッションを即時再チェック
          authClient.getSession().catch(() => {});
        }
      } catch {
        // URL パース失敗は無視
      }
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial session load + polling for auth state changes
  useEffect(() => {
    let cancelled = false;
    let firstCheck = true;
    let lastUserId: string | null = null;

    const syncUser = async () => {
      if (cancelled) return;
      try {
        const { data } = await authClient.getSession();
        const neonUser = data?.user;
        const currentId = neonUser?.id ?? null;

        if (firstCheck || currentId !== lastUserId) {
          firstCheck = false;
          lastUserId = currentId;

          if (!neonUser) {
            setUser(null);
            setIsLoading(false);
            return;
          }

          // Build user — preserve existing tier if same user (avoids flash to 'free')
          setUser(prev => {
            const isSame = prev && prev.id === neonUser.id;
            return {
              id: neonUser.id,
              email: neonUser.email ?? null,
              displayName: neonUser.name ?? null,
              photoURL: neonUser.image ?? null,
              tier: isSame ? prev.tier : getCachedTier(neonUser.id),
              subscriptionStartDate: isSame ? prev.subscriptionStartDate : null,
              subscriptionStatus: isSame ? prev.subscriptionStatus : null,
              subscriptionCurrentPeriodEnd: isSame ? prev.subscriptionCurrentPeriodEnd : null,
              isAnonymous: false,
              emailVerified: neonUser.emailVerified ?? false,
            };
          });
          setIsLoading(false);

          // Fetch actual profile asynchronously
          const profile = await fetchUserProfile(neonUser.id);
          if (!cancelled) {
            setUser(prev => prev && prev.id === neonUser.id
              ? {
                  ...prev,
                  tier: profile.tier,
                  subscriptionStartDate: profile.subscriptionStartDate,
                  subscriptionStatus: profile.subscriptionStatus,
                  subscriptionCurrentPeriodEnd: profile.subscriptionCurrentPeriodEnd,
                }
              : prev
            );
          }
        }
      } catch (err) {
        console.warn('[Auth] syncUser error:', err);
        // On first check failure, still resolve loading
        if (firstCheck) {
          firstCheck = false;
          setIsLoading(false);
        }
      }
    };

    // Initial check
    syncUser();

    // Fallback: ensure loading resolves even if getSession hangs
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 10_000);

    // Poll for auth state changes (Better Auth doesn't have onAuthStateChange)
    const interval = setInterval(syncUser, 5000);

    // Cross-tab: listen for storage events
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('better-auth') || e.key?.includes('session')) {
        syncUser();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(fallbackTimer);
      window.removeEventListener('storage', onStorage);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await authService.signInWithEmail(email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await authService.signUpWithEmail(email, password);
  }, []);

  const signOut = useCallback(async () => {
    const uid = user?.id;
    if (uid) {
      NeonAdapter.clearCacheForUser(uid);
      localStorage.removeItem(TIER_CACHE_KEY);
    }
    await authService.signOut();
    setUser(null);
  }, [user?.id]);

  const resendVerificationEmail = useCallback(async () => {
    await authService.resendVerificationEmail();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await authService.sendPasswordReset(email);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setUser(null);
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    // Clean up URL params
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const refreshTier = useCallback(async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      console.warn('[Auth] refreshTier: no authenticated user');
      return;
    }
    const profile = await fetchUserProfile(data.user.id);
    console.log('[Auth] refreshTier result:', profile.tier);
    setUser(prev => prev
      ? {
          ...prev,
          tier: profile.tier,
          subscriptionStartDate: profile.subscriptionStartDate,
          subscriptionStatus: profile.subscriptionStatus,
          subscriptionCurrentPeriodEnd: profile.subscriptionCurrentPeriodEnd,
        }
      : prev
    );
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isPasswordRecovery,
      signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
      resendVerificationEmail, sendPasswordReset, deleteAccount, clearPasswordRecovery,
      refreshTier,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
