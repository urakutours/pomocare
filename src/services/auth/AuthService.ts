import { authClient } from '@/lib/neon';
import { getAuthRedirectBase } from '@/utils/platform';

export type UserTier = 'free' | 'standard' | 'pro';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  subscriptionStartDate: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}

interface NeonUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
}

function toUser(
  neonUser: NeonUser,
  tier: UserTier = 'free',
  subscriptionStartDate: string | null = null,
  subscriptionStatus: string | null = null,
  subscriptionCurrentPeriodEnd: string | null = null,
): User {
  return {
    id: neonUser.id,
    email: neonUser.email ?? null,
    displayName: neonUser.name ?? null,
    photoURL: neonUser.image ?? null,
    tier,
    subscriptionStartDate,
    subscriptionStatus,
    subscriptionCurrentPeriodEnd,
    isAnonymous: false,
    emailVerified: neonUser.emailVerified ?? false,
  };
}

export class AuthService {
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await authClient.getSession();
    if (error || !data?.user) return null;
    return toUser(data.user as NeonUser);
  }

  /**
   * セッション変更を監視する。
   * Better Auth にはリアルタイムリスナーがないため、
   * ポーリングで getSession を定期確認し、変化時にコールバックを呼ぶ。
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    let lastUserId: string | null = null;
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const { data } = await authClient.getSession();
        const currentUser = data?.user as NeonUser | null;
        const currentId = currentUser?.id ?? null;

        if (currentId !== lastUserId) {
          lastUserId = currentId;
          callback(currentUser ? toUser(currentUser) : null);
        }
      } catch {
        // ignore transient errors
      }
    };

    // Initial check
    check();

    // Poll every 5 seconds for auth state changes
    const interval = setInterval(check, 5000);

    // Listen for storage events (cross-tab sign in/out)
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('better-auth') || e.key?.includes('session')) {
        check();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: getAuthRedirectBase(),
    });
    if (error) throw new Error(error.message ?? 'Google sign-in failed');
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? 'Sign-in failed');
    if (!data?.user) throw new Error('Sign-in failed');
    return toUser(data.user as NeonUser);
  }

  async signUpWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: email.split('@')[0] || 'User',
    });
    if (error) throw new Error(error.message ?? 'Sign-up failed');
    if (!data?.user) throw new Error('Sign-up failed');
    return toUser(data.user as NeonUser);
  }

  async resendVerificationEmail(): Promise<void> {
    const { data } = await authClient.getSession();
    if (data?.user?.email) {
      await authClient.sendVerificationEmail({
        email: data.user.email,
        callbackURL: getAuthRedirectBase(),
      });
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: getAuthRedirectBase() + '?type=password-reset',
    });
    if (error) throw new Error(error.message ?? 'Password reset request failed');
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const { error } = await authClient.resetPassword({
      newPassword,
      token,
    });
    if (error) throw new Error(error.message ?? 'Password reset failed');
  }

  async deleteAccount(): Promise<void> {
    // TODO: Phase 2 — implement via Cloudflare Worker
    // For now, sign out only. Account deletion requires server-side logic.
    await authClient.signOut();
  }

  async signOut(): Promise<void> {
    await authClient.signOut();
  }
}

export const authService = new AuthService();
