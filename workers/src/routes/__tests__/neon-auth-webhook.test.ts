/**
 * Integration test for the fail-loud contract: sendWithFallback throwing must
 * propagate all the way to a 500 response (Neon Auth relies on this to retry
 * the webhook delivery), and a successful send must return 200.
 *
 * Uses a real Ed25519 keypair generated at test time so the webhook signature
 * verification path (verifyWebhook) is exercised for real, not mocked away.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleNeonAuthWebhook } from '../neon-auth-webhook';
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
    ...overrides,
  } as Env;
}

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signedWebhookRequest(
  payload: Record<string, unknown>,
  keyPair: CryptoKeyPair,
  kid: string,
): Promise<Request> {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());

  const header = { alg: 'EdDSA', kid };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(rawBody));
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = base64urlEncode(new TextEncoder().encode(signaturePayload));
  const signingInput = `${headerB64}.${signaturePayloadB64}`;

  const signature = await crypto.subtle.sign(
    'Ed25519',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  const signatureB64 = base64urlEncode(signature);
  const jws = `${headerB64}..${signatureB64}`;

  return new Request('https://worker.example.test/api/webhooks/neon-auth', {
    method: 'POST',
    headers: {
      'x-neon-signature': jws,
      'x-neon-signature-kid': kid,
      'x-neon-timestamp': timestamp,
    },
    body: rawBody,
  });
}

describe('handleNeonAuthWebhook (fail-loud contract)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let keyPair: CryptoKeyPair;
  const kid = 'test-key-1';

  beforeEach(async () => {
    keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    fetchMock = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.endsWith('/.well-known/jwks.json')) {
        return new Response(JSON.stringify({ keys: [{ ...jwk, kid }] }), { status: 200 });
      }
      throw new Error(`unexpected fetch call to ${url} in test`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 500 when sendWithFallback throws (both providers unconfigured/failing) — must not be swallowed', async () => {
    const request = await signedWebhookRequest(
      {
        event_type: 'send.magic_link',
        user: { email: 'user@example.test' },
        event_data: { link_type: 'forget-password', link_url: 'https://app.pomocare.com/reset?token=abc' },
      },
      keyPair,
      kid,
    );

    // No EMAIL_PRIMARY/EMAIL_FALLBACK provider configured beyond the JWKS fetch mock above,
    // so postEmail's own fetch call falls through to the "unexpected fetch call" rejection,
    // which sendWithFallback must not swallow.
    const res = await handleNeonAuthWebhook(request, baseEnv());

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('returns 200 when sendWithFallback succeeds', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.endsWith('/.well-known/jwks.json')) {
        const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        return new Response(JSON.stringify({ keys: [{ ...jwk, kid }] }), { status: 200 });
      }
      if (typeof url === 'string' && url.includes('api.resend.com')) {
        return new Response(JSON.stringify({ id: 'msg_ok' }), { status: 200 });
      }
      throw new Error(`unexpected fetch call to ${url} in test`);
    });

    const request = await signedWebhookRequest(
      {
        event_type: 'send.magic_link',
        user: { email: 'user@example.test' },
        event_data: { link_type: 'email-verification', link_url: 'https://app.pomocare.com/verify?token=abc' },
      },
      keyPair,
      kid,
    );

    const res = await handleNeonAuthWebhook(request, baseEnv());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean };
    expect(body.received).toBe(true);
  });
});
