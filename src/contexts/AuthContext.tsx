import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService, type User, type UserTier } from '@/services/auth/AuthService';
import { supabase } from '@/lib/supabase';

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
}

async function fetchUserProfile(userId: string): Promise<UserProfileData> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tier, subscription_start_date')
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = "Row not found" — the only case where we should create a new row
    if (error.code === 'PGRST116') {
      console.log('[Auth] No profile row found, creating free tier for', userId);
      await supabase.from('user_profiles').insert({ user_id: userId, tier: 'free' });
      return { tier: 'free', subscriptionStartDate: null };
    }
    // Any other error (RLS, network, etc.) — log and return free without overwriting
    console.error('[Auth] fetchUserProfile failed:', error.code, error.message);
    return { tier: 'free', subscriptionStartDate: null };
  }

  return {
    tier: (data.tier as UserTier) ?? 'free',
    subscriptionStartDate: data.subscription_start_date ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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
        setUser(prev => {
          const preservedTier = (prev && prev.id === sbUser.id) ? prev.tier : 'free';
          const preservedSubStart = (prev && prev.id === sbUser.id) ? prev.subscriptionStartDate : null;
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
            tier: preservedTier,
            subscriptionStartDate: preservedSubStart,
            isAnonymous: false,
            emailVerified: sbUser.email_confirmed_at != null,
          };
        });
        setIsLoading(false);

        // Fetch actual profile asynchronously and always apply it
        const profile = await fetchUserProfile(sbUser.id);
        setUser(prev => prev && prev.id === sbUser.id
          ? { ...prev, tier: profile.tier, subscriptionStartDate: profile.subscriptionStartDate }
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
    await authService.signOut();
  }, []);

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
      ? { ...prev, tier: profile.tier, subscriptionStartDate: profile.subscriptionStartDate }
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
