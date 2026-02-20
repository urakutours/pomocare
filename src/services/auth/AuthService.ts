import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
}

function toUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    tier: 'free', // Stripe連携まではfree固定
    isAnonymous: false,
  };
}

export class AuthService {
  /** 現在ログイン中のユーザーを返す（未ログインなら null） */
  getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        unsubscribe();
        resolve(fbUser ? toUser(fbUser) : null);
      });
    });
  }

  /** Firebase Auth の状態変化を購読する */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, (fbUser) => {
      callback(fbUser ? toUser(fbUser) : null);
    });
  }

  /** Google ログイン */
  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    return toUser(result.user);
  }

  /** メール/パスワード ログイン */
  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return toUser(result.user);
  }

  /** メール/パスワード 新規登録 */
  async signUpWithEmail(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return toUser(result.user);
  }

  /** ログアウト */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }
}

export const authService = new AuthService();
