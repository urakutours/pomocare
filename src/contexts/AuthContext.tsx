import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authService, type User, type UserTier } from '@/services/auth/AuthService';
import { supabase } from '@/lib/supabase';
import { SupabaseAdapter } from '@/services/storage/SupabaseAdapter';

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
  /** 決済完了後などに呼ぶ: Supabaseからtierを再取得してuserステートを更新する */
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
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tier, subscription_start_date, subscription_status, subscription_current_period_end')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[Auth] No profile row found, creating free tier for', userId);
      await supabase.from('user_profiles').insert({ user_id: userId, tier: 'free' });
      setCachedTier(userId, 'free');
      return { tier: 'free', subscriptionStartDate: null, subscriptionStatus: null, subscriptionCurrentPeriodEnd: null };
    }
    console.error('[Auth] fetchUserProfile failed:', error.code, error.message);
    // Use cached tier instead of defaulting to 'free'
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
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Proactive session recovery on tab focus.
  // When the user returns after idle, ensure the auth session is still valid
  // and refresh tier from the server to prevent stale 'free' tier display.
  const lastVisibilityCheckRef = useRef(0);
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      // Throttle: skip if checked less than 30 seconds ago
      if (Date.now() - lastVisibilityCheckRef.current < 30_000) return;
      lastVisibilityCheckRef.current = Date.now();

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Session gone — try to refresh it
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.warn('[Auth] Session recovery failed on focus:', error.message);
            // onAuthStateChange will fire with null session → user logged out
          }
          return;
        }
        // Session is valid — refresh tier in case it changed while idle
        const profile = await fetchUserProfile(session.user.id);
        setUser(prev => prev && prev.id === session.user.id
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }

        if (!session?.user) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        const sbUser = session.user;

        // Build user — preserve existing tier if same user (avoids flash to 'free' on TOKEN_REFRESHED)
        // Falls back to localStorage-cached tier for new sessions instead of 'free'
        setUser(prev => {
          const isSame = prev && prev.id === sbUser.id;
          return {
            id: sbUser.id,
            email: sbUser.email ?? null,
            displayName:
              sbUser.user_metadata?.full_name ??
              sbUser.user_metadata?.name ??
              null,
            photoURL:
              sbUser.user_metadata?.avatar_url ??
              sbUser.user_metadata?.picture ??
              null,
            tier: isSame ? prev.tier : getCachedTier(sbUser.id),
            subscriptionStartDate: isSame ? prev.subscriptionStartDate : null,
            subscriptionStatus: isSame ? prev.subscriptionStatus : null,
            subscriptionCurrentPeriodEnd: isSame ? prev.subscriptionCurrentPeriodEnd : null,
            isAnonymous: false,
            emailVerified: sbUser.email_confirmed_at != null,
          };
        });
        setIsLoading(false);

        // Fetch actual profile asynchronously and always apply it
        const profile = await fetchUserProfile(sbUser.id);
        setUser(prev => prev && prev.id === sbUser.id
          ? {
              ...prev,
              tier: profile.tier,
              subscriptionStartDate: profile.subscriptionStartDate,
              subscriptionStatus: profile.subscriptionStatus,
              subscriptionCurrentPeriodEnd: profile.subscriptionCurrentPeriodEnd,
            }
          : prev
        );
      },
    );
    return () => subscription.unsubscribe();
  }, []);

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
    // Clear caches for current user to prevent stale data on next login
    const uid = user?.id;
    if (uid) {
      SupabaseAdapter.clearCacheForUser(uid);
      localStorage.removeItem(TIER_CACHE_KEY);
    }
    await authService.signOut();
  }, [user?.id]);

  const resendVerificationEmail = useCallback(async () => {
    await authService.resendVerificationEmail();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await authService.sendPasswordReset(email);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const refreshTier = useCallback(async () => {
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (!sbUser) {
      console.warn('[Auth] refreshTier: no authenticated user');
      return;
    }
    const profile = await fetchUserProfile(sbUser.id);
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
