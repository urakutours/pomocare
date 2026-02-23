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
});

async function fetchUserTier(userId: string): Promise<UserTier> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tier')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Row doesn't exist yet — insert a free row
    await supabase.from('user_profiles').insert({ user_id: userId, tier: 'free' });
    return 'free';
  }
  return (data.tier as UserTier) ?? 'free';
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

        // Build user with free tier first for quick render
        const baseUser: User = {
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
          tier: 'free',
          isAnonymous: false,
          emailVerified: sbUser.email_confirmed_at != null,
        };
        setUser(baseUser);
        setIsLoading(false);

        // Fetch actual tier asynchronously
        const tier = await fetchUserTier(sbUser.id);
        if (tier !== 'free') {
          setUser(prev => prev ? { ...prev, tier } : prev);
        }
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

  return (
    <AuthContext.Provider value={{
      user, isLoading, isPasswordRecovery,
      signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
      resendVerificationEmail, sendPasswordReset, deleteAccount, clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
