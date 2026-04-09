/**
 * API client for Cloudflare Workers.
 * Gets Neon Auth (Better Auth) session token and uses it as Authorization header.
 */
import { authClient } from '@/lib/neon';

const WORKER_BASE_URL = import.meta.env.VITE_WORKER_URL as string;

/** Get JWT from current Better Auth session. */
async function getJWT(): Promise<string> {
  const { data } = await authClient.getSession();
  const token = data?.session?.token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

/** Make an authenticated POST request to a Worker endpoint. */
export async function workerPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const jwt = await getJWT();
  const res = await fetch(`${WORKER_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error || `Worker error ${res.status}`);
  }
  return res.json() as Promise<T>;
}
