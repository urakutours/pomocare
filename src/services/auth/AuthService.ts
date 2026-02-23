import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type UserTier = 'free' | 'standard' | 'pro';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  isAnonymous: boolean;
  emailVerified: boolean;
}

function toUser(sbUser: SupabaseUser, tier: UserTier = 'free'): User {
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
    tier,
    isAnonymous: false,
    emailVerified: sbUser.email_confirmed_at != null,
  };
}

export class AuthService {
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? toUser(user) : null;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        callback(session?.user ? toUser(session.user) : null);
      },
    );
    return () => subscription.unsubscribe();
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
    // Redirect happens — no user returned
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toUser(data.user);
  }

  async signUpWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');
    return toUser(data.user);
  }

  async resendVerificationEmail(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
  }

  async confirmPasswordReset(_code: string, newPassword: string): Promise<void> {
    // Supabase password recovery: user clicks email link → lands on app with
    // PASSWORD_RECOVERY event → we call updateUser to set the new password.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async deleteAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
    await supabase.auth.signOut();
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }
}

export const authService = new AuthService();
