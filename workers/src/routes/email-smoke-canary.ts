import type { Env } from '../types';
import { sendWithFallback } from '../lib/email';

/**
 * Pre-cutover synthetic smoke test (canary) send for the Resend/FreeResend
 * fallback path. Mirrors relatista's `/api/cron/email-smoke-canary` design,
 * adapted from a Vercel Cron route (verifyCronAuth + VERCEL_ENV gate) to a
 * Bearer-secret-gated Worker route (this Worker has no cron-style trusted
 * invoker, so the Bearer secret is the sole gate).
 *
 * Fail-closed guards (in order):
 * 1. `Authorization: Bearer <SMOKE_CANARY_SECRET>` required, compared in
 *    constant time (see timingSafeEqual below). Mismatch or unset secret -> 401.
 * 2. `SMOKE_CANARY_ENABLED !== "true"` -> no-op (200 + skipped:true). Default
 *    OFF; only flip to "true" during an active cutover verification window.
 * 3. Recipient is the env-fixed `SMOKE_CANARY_MAILBOX` only — the request
 *    body is never read/parsed, so this route cannot be turned into an
 *    open relay no matter what a caller sends.
 * 4. Missing SMOKE_CANARY_MAILBOX / RESEND_FROM -> 500 (not configured).
 * 5. Response body is minimal ({sent, run_id, sent_at}) — provider errors /
 *    secrets are never echoed back.
 * 6. Mail-loop suppression headers are attached to the outgoing message.
 */

/**
 * Constant-time string comparison for the Bearer secret.
 *
 * Web Crypto has no direct `timingSafeEqual`. We hash both inputs to a
 * fixed-length SHA-256 digest first (removing any length/content-position
 * timing signal from the raw strings), then compare the digest bytes without
 * early-exit branching. This is the "hash-then-compare" constant-time
 * technique (bitwise OR accumulation, no short-circuiting comparison).
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [aDigest, bDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const aBytes = new Uint8Array(aDigest);
  const bBytes = new Uint8Array(bDigest);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

async function verifyCanarySecret(request: Request, env: Env): Promise<boolean> {
  const expected = env.SMOKE_CANARY_SECRET;
  if (!expected) return false; // fail-closed: unset secret can never authenticate

  const authHeader = request.headers.get('Authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return timingSafeEqual(provided, expected);
}

export async function handleEmailSmokeCanary(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!(await verifyCanarySecret(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (env.SMOKE_CANARY_ENABLED !== 'true') {
    return Response.json({
      skipped: true,
      reason: 'SMOKE_CANARY_ENABLED is not "true"',
    });
  }

  const mailbox = env.SMOKE_CANARY_MAILBOX;
  const from = env.RESEND_FROM;
  if (!mailbox || !from) {
    console.error('[email-smoke-canary] missing SMOKE_CANARY_MAILBOX or RESEND_FROM (not configured)');
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }

  const runId = crypto.randomUUID();
  const sentAt = new Date().toISOString();
  const subject = `[PomoCare Smoke Canary] ${sentAt} run=${runId}`;
  const html = `
    <p>PomoCare Resend/FreeResend fallback synthetic smoke test (canary).</p>
    <p>run_id: ${runId}</p>
    <p>sent_at: ${sentAt}</p>
    <p>This is an automated monitoring send, unrelated to any real password reset
    or account action. It contains no real link or token. No reply needed.</p>
  `;

  try {
    await sendWithFallback(env, {
      from,
      to: mailbox,
      subject,
      html,
      // Mail-loop suppression: this is an automated, non-interactive send.
      // NOTE: FreeResend silently drops custom `headers` (no schema for it),
      // so this only takes effect when Resend actually sends the message.
      headers: {
        'Auto-Submitted': 'auto-replied',
        Precedence: 'bulk',
      },
    });
  } catch (err) {
    console.error('[email-smoke-canary] send failed:', err instanceof Error ? err.message : 'unknown');
    return Response.json({ sent: false }, { status: 502 });
  }

  console.log(`[email-smoke-canary] sent run_id=${runId}`);
  return Response.json({ sent: true, run_id: runId, sent_at: sentAt });
}
