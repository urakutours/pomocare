import type { Env } from '../types';

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Verify session by forwarding the token to Neon Auth's get-session endpoint.
 *
 * Neon Auth (managed Better Auth) uses opaque session tokens, not locally-verifiable JWTs.
 * BETTER_AUTH_SECRET はマネージドサービス側で管理されユーザーに公開されないため、
 * Worker 側ではセッショントークンを Neon Auth に転送して検証する。
 */
export async function verifySession(
  request: Request,
  env: Env,
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${env.NEON_AUTH_URL}/get-session`, {
      headers: {
        Cookie: `better-auth.session_token=${token}`,
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      session?: { userId?: string };
      user?: { id?: string; email?: string };
    };

    const userId = data.user?.id || data.session?.userId;
    if (!userId) return null;

    return {
      id: userId,
      email: data.user?.email,
    };
  } catch {
    return null;
  }
}
