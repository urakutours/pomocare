import { jwtVerify } from 'jose';
import type { Env } from '../types';

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Verify Neon Auth (Better Auth) JWT and extract user info.
 * Better Auth signs session JWTs with HS256 using BETTER_AUTH_SECRET.
 *
 * The JWT payload typically contains:
 *   sub: user ID (standard claim)
 *   email: user email (custom claim, may not be present)
 */
export async function verifyJWT(
  request: Request,
  env: Env,
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Better Auth may use `sub` or embed user id differently
    const userId = payload.sub
      || (payload as Record<string, unknown>).userId as string | undefined
      || (payload as Record<string, unknown>).id as string | undefined;

    if (!userId) return null;

    return {
      id: userId,
      email: (payload as Record<string, unknown>).email as string | undefined,
    };
  } catch {
    return null;
  }
}
