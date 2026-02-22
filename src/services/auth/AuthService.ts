import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode,
  confirmPasswordReset,
  deleteUser,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export type UserTier = 'free' | 'pro';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  isAnonymous: boolean;
  emailVerified: boolean;
}

function toUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    tier: 'free',
    isAnonymous: false,
    emailVerified: fbUser.emailVerified,
  };
}

export class AuthService {
  getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        unsubscribe();
        resolve(fbUser ? toUser(fbUser) : null);
      });
    });
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, (fbUser) => {
      callback(fbUser ? toUser(fbUser) : null);
    });
  }

  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    return toUser(result.user);
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return toUser(result.user);
  }

  async signUpWithEmail(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email
    await sendEmailVerification(result.user);
    return toUser(result.user);
  }

  async resendVerificationEmail(): Promise<void> {
    const fbUser = auth.currentUser;
    if (fbUser) {
      await sendEmailVerification(fbUser);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async applyActionCode(code: string): Promise<void> {
    await applyActionCode(auth, code);
  }

  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(auth, code, newPassword);
  }

  async deleteAccount(): Promise<void> {
    const fbUser = auth.currentUser;
    if (fbUser) {
      await deleteUser(fbUser);
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }
}

export const authService = new AuthService();
