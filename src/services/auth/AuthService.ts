export type UserTier = 'free' | 'pro';

export interface User {
  id: string;
  tier: UserTier;
  isAnonymous: boolean;
}

const ANONYMOUS_USER: User = {
  id: 'anonymous',
  tier: 'free',
  isAnonymous: true,
};

export class AuthService {
  async getCurrentUser(): Promise<User> {
    return ANONYMOUS_USER;
  }
}
