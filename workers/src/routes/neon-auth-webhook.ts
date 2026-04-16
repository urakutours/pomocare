import type { Env } from '../types';
import { sendEmail, passwordResetTemplate, emailVerificationTemplate } from '../lib/email';

interface NeonAuthWebhookPayload {
  event_type: string;
  user?: { email?: string };
  event_data?: { link_type?: string; link_url?: string };
}

// Decode a base64url string to Uint8Array (Web Crypto compatible)
function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Encode an ArrayBuffer (or Uint8Array) to a base64url string
function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify a Neon Auth webhook request using Web Crypto API (Ed25519 / EdDSA).
 *
 * Neon Auth sends a detached JWS in `x-neon-signature`:
 *   <headerB64>.<empty>.<signatureB64>
 *
 * The signing input is:
 *   base64url(header) + "." + base64url(timestamp + "." + base64url(rawBody))
 */
async function verifyWebhook(
  rawBody: string,
  headers: { signature: string | null; kid: string | null; timestamp: string | null },
  jwksUrl: string,
): Promise<NeonAuthWebhookPayload> {
  const { signature, kid, timestamp } = headers;

  if (!signature || !kid || !timestamp) {
    throw new Error('Missing webhook signature headers');
  }

  // Fetch JWKS and find the key matching `kid`
  const jwksRes = await fetch(jwksUrl);
  if (!jwksRes.ok) {
    throw new Error(`Failed to fetch JWKS: ${jwksRes.status}`);
  }
  const jwks = (await jwksRes.json()) as { keys: Array<{ kid: string } & JsonWebKey> };
  const jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) {
    throw new Error(`Key ${kid} not found in JWKS`);
  }

  // Import the public key for Ed25519 (EdDSA) verification.
  // Neon Auth JWKS uses kty=OKP / crv=Ed25519.
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'Ed25519' },
    false,
    ['verify'],
  );

  // Parse the detached JWS: <headerB64>.<empty>.<signatureB64>
  const parts = signature.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWS format: expected 3 parts');
  }
  const [headerB64, emptyPayload, signatureB64] = parts;
  if (emptyPayload !== '') {
    throw new Error('Expected detached JWS format (empty payload segment)');
  }

  // Reconstruct the signing input (mirrors Relatista's node:crypto implementation)
  const payloadB64 = base64urlEncode(new TextEncoder().encode(rawBody));
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = base64urlEncode(new TextEncoder().encode(signaturePayload));
  const signingInput = `${headerB64}.${signaturePayloadB64}`;

  const isValid = await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    base64urlDecode(signatureB64),
    new TextEncoder().encode(signingInput),
  );

  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }

  // Reject stale webhooks (5 minute window)
  const ageMs = Date.now() - parseInt(timestamp, 10);
  if (ageMs > 5 * 60 * 1000) {
    throw new Error('Webhook timestamp too old');
  }

  return JSON.parse(rawBody) as NeonAuthWebhookPayload;
}

export async function handleNeonAuthWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response('Failed to read request body', { status: 400 });
  }

  const jwksUrl = `${env.NEON_AUTH_URL}/.well-known/jwks.json`;

  let payload: NeonAuthWebhookPayload;
  try {
    payload = await verifyWebhook(
      rawBody,
      {
        signature: request.headers.get('x-neon-signature'),
        kid: request.headers.get('x-neon-signature-kid'),
        timestamp: request.headers.get('x-neon-timestamp'),
      },
      jwksUrl,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[neon-auth-webhook] Verification error:', msg);
    return Response.json({ error: msg }, { status: 400 });
  }

  if (payload.event_type !== 'send.magic_link') {
    // Acknowledge unhandled event types (e.g. sign-in magic links not used in PomoCare)
    return Response.json({ received: true });
  }

  const email = payload.user?.email;
  const linkType = payload.event_data?.link_type;
  const linkUrl = payload.event_data?.link_url;

  if (!email || !linkUrl) {
    console.error('[neon-auth-webhook] Missing email or link_url in payload');
    return Response.json({ error: 'Missing required payload fields' }, { status: 400 });
  }

  try {
    if (linkType === 'forget-password') {
      await sendEmail(env, {
        to: email,
        subject: 'Reset your PomoCare password',
        html: passwordResetTemplate(linkUrl),
      });
      console.log(`[neon-auth-webhook] Password reset email sent to ${email}`);
    } else if (linkType === 'email-verification') {
      await sendEmail(env, {
        to: email,
        subject: 'Confirm your PomoCare email',
        html: emailVerificationTemplate(linkUrl),
      });
      console.log(`[neon-auth-webhook] Verification email sent to ${email}`);
    } else {
      // Other magic link types (sign-in etc.) — no-op
      console.log(`[neon-auth-webhook] Ignoring link_type=${linkType}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send email';
    console.error('[neon-auth-webhook] Email send error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({ received: true });
}
