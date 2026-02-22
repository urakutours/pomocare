import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService, type User } from '@/services/auth/AuthService';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  resendVerificationEmail: async () => {},
  sendPasswordReset: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((u) => {
      setUser(u);
      setIsLoading(false);
    });
    return unsubscribe;
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

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
      resendVerificationEmail, sendPasswordReset, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
