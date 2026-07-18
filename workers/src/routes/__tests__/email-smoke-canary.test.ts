/**
 * Unit tests for the pre-cutover email smoke canary route.
 *
 * Covers the fail-closed guard chain: Bearer secret mismatch (401),
 * SMOKE_CANARY_ENABLED not "true" (skip, 200), missing recipient/from (500),
 * open-relay guard (request body is never referenced), and send failure (502).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleEmailSmokeCanary } from '../email-smoke-canary';
import type { Env } from '../../types';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    NEON_DATABASE_URL: 'postgres://x',
    NEON_AUTH_URL: 'https://auth.example.test',
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_PRICE_STANDARD: 'price_standard',
    STRIPE_PRICE_PRO: 'price_pro',
    RESEND_API_KEY: 're_test_dummy',
    RESEND_FROM: 'PomoCare <noreply@pomocare.com>',
    SMOKE_CANARY_SECRET: 'canary-secret-value',
    SMOKE_CANARY_ENABLED: 'true',
    SMOKE_CANARY_MAILBOX: 'canary-inbox@example.test',
    ...overrides,
  } as Env;
}

function postRequest(body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://worker.example.test/internal/email-smoke-canary', {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('handleEmailSmokeCanary', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Default: reject any unexpected fetch so a guard bug can't slip through
    // and make a real network call from the test suite.
    fetchMock = vi.fn().mockRejectedValue(new Error('unexpected fetch call in test'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects non-POST methods with 405', async () => {
    const request = new Request('https://worker.example.test/internal/email-smoke-canary', { method: 'GET' });
    const res = await handleEmailSmokeCanary(request, baseEnv());
    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the Bearer secret does not match', async () => {
    const request = postRequest(undefined, { Authorization: 'Bearer wrong-secret' });
    const res = await handleEmailSmokeCanary(request, baseEnv());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the Authorization header is missing entirely', async () => {
    const request = postRequest(undefined);
    const res = await handleEmailSmokeCanary(request, baseEnv());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with 401 when SMOKE_CANARY_SECRET is unset (fail-closed, no accidental open gate)', async () => {
    const request = postRequest(undefined, { Authorization: 'Bearer anything' });
    const res = await handleEmailSmokeCanary(request, baseEnv({ SMOKE_CANARY_SECRET: undefined }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips with 200 when SMOKE_CANARY_ENABLED is not "true" (default OFF)', async () => {
    const request = postRequest(undefined, { Authorization: 'Bearer canary-secret-value' });

    const res = await handleEmailSmokeCanary(request, baseEnv({ SMOKE_CANARY_ENABLED: 'false' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { skipped: boolean; reason: string };
    expect(body.skipped).toBe(true);
    expect(body.reason).toContain('SMOKE_CANARY_ENABLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when SMOKE_CANARY_MAILBOX is unset', async () => {
    const request = postRequest(undefined, { Authorization: 'Bearer canary-secret-value' });
    const res = await handleEmailSmokeCanary(request, baseEnv({ SMOKE_CANARY_MAILBOX: undefined }));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when RESEND_FROM is unset', async () => {
    const request = postRequest(undefined, { Authorization: 'Bearer canary-secret-value' });
    const res = await handleEmailSmokeCanary(
      request,
      baseEnv({ RESEND_FROM: undefined as unknown as string }),
    );
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores the request body entirely (open-relay guard): attacker-controlled to/from never reach the send', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'msg_1' }));
    const request = postRequest(
      { to: 'attacker@evil.test', from: 'attacker@evil.test', subject: 'pwn', html: '<script>evil()</script>' },
      { Authorization: 'Bearer canary-secret-value' },
    );

    const res = await handleEmailSmokeCanary(request, baseEnv());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: boolean; run_id: string; sent_at: string };
    expect(body.sent).toBe(true);
    expect(typeof body.run_id).toBe('string');
    expect(typeof body.sent_at).toBe('string');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.to).toEqual(['canary-inbox@example.test']);
    expect(sentBody.from).toBe('PomoCare <noreply@pomocare.com>');
    expect(sentBody.subject).not.toContain('pwn');
    expect(sentBody.html).not.toContain('evil()');
  });

  it('attaches mail-loop suppression headers to the outgoing send', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'msg_1' }));
    const request = postRequest(undefined, { Authorization: 'Bearer canary-secret-value' });

    await handleEmailSmokeCanary(request, baseEnv());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.headers).toEqual({ 'Auto-Submitted': 'auto-replied', Precedence: 'bulk' });
  });

  it('returns 502 (not the raw provider error) when the underlying send fails on all providers', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }));
    const request = postRequest(undefined, { Authorization: 'Bearer canary-secret-value' });

    const res = await handleEmailSmokeCanary(request, baseEnv());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ sent: false });
  });
});
