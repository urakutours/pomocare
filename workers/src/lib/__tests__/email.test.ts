/**
 * Unit tests for the Resend/FreeResend fallback layer (migrated from
 * relatista's src/lib/email/smtp.ts canonical pattern to this Worker's
 * env.X argument-passing model).
 *
 * Covers:
 * - EMAIL_PRIMARY / EMAIL_FALLBACK provider selection
 * - primary failure / timeout -> fallback retry
 * - fallback not configured -> graceful skip (primary error still throws)
 * - fail-loud when both providers fail (aggregated error)
 * - provider-specific wire payload shaping (bare from / array to for FreeResend)
 * - FreeResend's `{ error: "..." }` error body format
 * - notifyFallbackFired no-op / success / failure-swallowing
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveProvider,
  resolveProviderOrder,
  toWirePayload,
  sendWithFallback,
  notifyFallbackFired,
} from '../email';
import type { Env } from '../../types';

const RESEND_URL = 'https://api.resend.com/emails';
const FREERESEND_BASE = 'https://mail-api.example.test/api';
const FREERESEND_URL = `${FREERESEND_BASE}/emails`;

const payload = {
  from: 'PomoCare <noreply@pomocare.com>',
  to: 'user@example.test',
  subject: 'Test subject',
  html: '<p>hello</p>',
};

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
    ...overrides,
  } as Env;
}

function freeresendEnv(overrides: Partial<Env> = {}): Env {
  return baseEnv({
    RESEND_BASE_URL: FREERESEND_BASE,
    FREERESEND_API_KEY: 'frk_test_dummy',
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function callOf(fetchMock: ReturnType<typeof vi.fn>, n: number) {
  const call = fetchMock.mock.calls[n] as [string, RequestInit];
  return { url: call[0], init: call[1] };
}

describe('email.ts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('resolveProvider', () => {
    it('resend: returns null when RESEND_API_KEY is missing', () => {
      expect(resolveProvider(baseEnv({ RESEND_API_KEY: '' }), 'resend')).toBeNull();
    });

    it('freeresend: returns null when API key or base URL are missing', () => {
      expect(resolveProvider(baseEnv(), 'freeresend')).toBeNull();
    });

    it('freeresend: strips a trailing slash from RESEND_BASE_URL', () => {
      const config = resolveProvider(freeresendEnv({ RESEND_BASE_URL: `${FREERESEND_BASE}/` }), 'freeresend');
      expect(config?.baseUrl).toBe(FREERESEND_BASE);
    });
  });

  describe('resolveProviderOrder', () => {
    it('defaults to primary=resend, fallback=freeresend when unset', () => {
      expect(resolveProviderOrder(baseEnv())).toEqual({ primary: 'resend', fallback: 'freeresend' });
    });

    it('EMAIL_FALLBACK=none disables the fallback', () => {
      expect(resolveProviderOrder(baseEnv({ EMAIL_FALLBACK: 'none' }))).toEqual({
        primary: 'resend',
        fallback: null,
      });
    });

    it('EMAIL_FALLBACK equal to primary is disabled (no self-retry)', () => {
      expect(resolveProviderOrder(baseEnv({ EMAIL_FALLBACK: 'resend' }))).toEqual({
        primary: 'resend',
        fallback: null,
      });
    });

    it('unknown EMAIL_PRIMARY warns and defaults to resend', () => {
      resolveProviderOrder(baseEnv({ EMAIL_PRIMARY: 'typo' }));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown EMAIL_PRIMARY="typo"'));
    });
  });

  describe('toWirePayload', () => {
    it('resend: keeps display-name from, arrays to', () => {
      expect(toWirePayload('resend', payload)).toEqual({
        from: payload.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      });
    });

    it('freeresend: bare from (strips display name), arrays to', () => {
      expect(toWirePayload('freeresend', payload)).toEqual({
        from: 'noreply@pomocare.com',
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      });
    });

    it('already-bare from is passed through unchanged for freeresend', () => {
      const bare = { ...payload, from: 'noreply@pomocare.com' };
      expect(toWirePayload('freeresend', bare).from).toBe('noreply@pomocare.com');
    });

    it('includes headers when provided', () => {
      const withHeaders = { ...payload, headers: { 'Auto-Submitted': 'auto-replied' } };
      expect(toWirePayload('resend', withHeaders)).toMatchObject({
        headers: { 'Auto-Submitted': 'auto-replied' },
      });
    });

    it('omits the headers key entirely when not provided', () => {
      expect(toWirePayload('resend', payload)).not.toHaveProperty('headers');
    });
  });

  describe('sendWithFallback', () => {
    it('primary success: sends once via resend, no fallback attempted', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'msg_1' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(baseEnv(), payload)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { url, init } = callOf(fetchMock, 0);
      expect(url).toBe(RESEND_URL);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_dummy');
    });

    it('primary failure (5xx) falls back to freeresend and succeeds', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }))
        .mockResolvedValueOnce(jsonResponse(200, { id: 'msg_fb' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(freeresendEnv(), payload)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const second = callOf(fetchMock, 1);
      expect(second.url).toBe(FREERESEND_URL);
      expect(JSON.parse(second.init.body as string)).toEqual({
        from: 'noreply@pomocare.com',
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      });
    });

    it('primary timeout falls back to freeresend (hang does not block the whole send)', async () => {
      const fetchMock = vi.fn((url: string, init: RequestInit) => {
        if (url === RESEND_URL) {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));
            });
          });
        }
        return Promise.resolve(jsonResponse(200, { id: 'msg_fb' }));
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(freeresendEnv(), payload, { timeoutMs: 30 })).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(callOf(fetchMock, 1).url).toBe(FREERESEND_URL);
    });

    it('fallback not configured (missing env): warns skip and throws the primary error', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(baseEnv(), payload)).rejects.toThrow(/internal_server_error/);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('skipped (not configured'));
    });

    it('EMAIL_FALLBACK=none: primary failure throws without attempting a fallback', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(freeresendEnv({ EMAIL_FALLBACK: 'none' }), payload)).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('EMAIL_FALLBACK equal to primary: the guard disables the retry (1 attempt only)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(freeresendEnv({ EMAIL_FALLBACK: 'resend' }), payload)).rejects.toThrow(
        /internal_server_error/,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('both providers fail: throws an aggregated error (fail-loud)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }))
        .mockResolvedValueOnce(jsonResponse(503, { name: 'service_unavailable', message: 'down' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendWithFallback(freeresendEnv(), payload)).rejects.toThrow(/all providers failed/);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("resolves FreeResend's { error: '...' } authorization error body (not collapsed to statusText)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { error: 'From email must be from domain: example.com' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        sendWithFallback(freeresendEnv({ EMAIL_PRIMARY: 'freeresend', EMAIL_FALLBACK: 'none' }), payload),
      ).rejects.toThrow(/From email must be from domain: example\.com/);
    });

    it('fallback firing is logged loud ([Email][FALLBACK] warn, primary success-rate signal)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(500, { name: 'internal_server_error', message: 'boom' }))
        .mockResolvedValueOnce(jsonResponse(200, { id: 'msg_fb' }));
      vi.stubGlobal('fetch', fetchMock);

      await sendWithFallback(freeresendEnv(), payload);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Email][FALLBACK]'));
    });
  });

  describe('notifyFallbackFired', () => {
    beforeEach(() => {
      // The cooldown Map is module-level state; pin the clock per test with
      // large (1h) gaps so the 15-min dead-man's-switch cooldown never
      // interferes between these tests regardless of execution order.
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('no-op when SLACK_ALERT_WEBHOOK_URL is unset', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await notifyFallbackFired(baseEnv(), 'resend', 'freeresend', 'msg_1');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts to the Slack webhook when configured', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      await notifyFallbackFired(
        baseEnv({ SLACK_ALERT_WEBHOOK_URL: 'https://hooks.slack.test/services/x' }),
        'resend',
        'freeresend',
        'msg_1',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://hooks.slack.test/services/x');
      expect(JSON.parse(init.body as string).text).toContain('primary=resend');
    });

    it('swallows a webhook POST failure and does not throw', async () => {
      vi.setSystemTime(new Date('2026-01-01T01:00:00Z')); // +1h, past the 15-min cooldown
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        notifyFallbackFired(
          baseEnv({ SLACK_ALERT_WEBHOOK_URL: 'https://hooks.slack.test/services/x' }),
          'resend',
          'freeresend',
          'msg_1',
        ),
      ).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Slack notify failed'));
    });

    it('swallows a non-2xx webhook response and does not throw', async () => {
      vi.setSystemTime(new Date('2026-01-01T02:00:00Z')); // +2h
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        notifyFallbackFired(
          baseEnv({ SLACK_ALERT_WEBHOOK_URL: 'https://hooks.slack.test/services/x' }),
          'resend',
          'freeresend',
          'msg_1',
        ),
      ).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
    });
  });
});
