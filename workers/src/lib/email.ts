import type { Env } from '../types';

/**
 * Email sending layer (provider selection + automatic fallback).
 *
 * Migrated from relatista's canonical Resend/FreeResend fallback pattern
 * (`relatista/src/lib/email/smtp.ts`) to this Worker's `env.X` argument-passing
 * model (no `process.env` — every function that needs config takes `env`).
 *
 * Design:
 * - Try the primary provider; on failure / non-2xx / timeout, retry once
 *   against the fallback provider.
 * - Provider selection is controlled via env: EMAIL_PRIMARY / EMAIL_FALLBACK
 *   ("resend" | "freeresend" | "none"). Unset defaults to primary=resend,
 *   fallback=the opposite of primary (matches pre-migration single-provider
 *   behavior when fallback env isn't provisioned yet).
 * - FreeResend is a self-hosted Resend-API-compatible service. Its endpoint is
 *   RESEND_BASE_URL (name is historical — it points at the FreeResend host,
 *   not api.resend.com), its key is FREERESEND_API_KEY. Missing env means the
 *   fallback is skipped with a warn log (graceful degradation: deploying
 *   before the fallback env exists must not break sending).
 * - We never use the `resend` SDK: it applies RESEND_BASE_URL at module load
 *   time for *all* instances (no per-instance baseUrl), so mixing Resend + a
 *   Resend-compatible service in one process requires fetch direct calls with
 *   a per-provider fixed baseUrl.
 * - FreeResend validates more strictly than Resend (bare `from` + array
 *   `to`/`cc`/`bcc`/`reply_to` required, custom `headers` silently dropped).
 *   The difference is absorbed inside toWirePayload() per provider; we do not
 *   patch FreeResend to be lenient (keeps the "swap providers freely" ability
 *   intact).
 */

type ProviderName = 'resend' | 'freeresend';

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  /**
   * Custom headers (e.g. mail-loop suppression `Auto-Submitted` / `Precedence`).
   * NOTE: FreeResend has no schema for `headers` and silently drops it (never
   * forwarded to SES) — only Resend applies it.
   */
  headers?: Record<string, string>;
}

interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
}

const RESEND_API_BASE_URL = 'https://api.resend.com';

/** Per-attempt timeout (matches relatista's canonical value: a hung provider must not block the whole request). */
const SEND_TIMEOUT_MS = 6_000;

function isProviderName(value: string | undefined): value is ProviderName {
  return value === 'resend' || value === 'freeresend';
}

/** Resolve one provider's connection config from env. Returns null if required env is missing. */
export function resolveProvider(env: Env, name: ProviderName): ProviderConfig | null {
  if (name === 'resend') {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) return null;
    return { name, baseUrl: RESEND_API_BASE_URL, apiKey };
  }
  const apiKey = env.FREERESEND_API_KEY;
  const baseUrl = env.RESEND_BASE_URL?.replace(/\/+$/, '');
  if (!apiKey || !baseUrl) return null;
  return { name, baseUrl, apiKey };
}

/** Decide try order from EMAIL_PRIMARY / EMAIL_FALLBACK (default: resend -> freeresend). */
export function resolveProviderOrder(env: Env): {
  primary: ProviderName;
  fallback: ProviderName | null;
} {
  const rawPrimary = env.EMAIL_PRIMARY;
  const rawFallback = env.EMAIL_FALLBACK;

  let primary: ProviderName;
  if (isProviderName(rawPrimary)) {
    primary = rawPrimary;
  } else {
    if (rawPrimary) {
      console.warn(`[Email] unknown EMAIL_PRIMARY="${rawPrimary}", defaulting to "resend"`);
    }
    primary = 'resend';
  }

  const defaultFallback: ProviderName = primary === 'resend' ? 'freeresend' : 'resend';

  let fallback: ProviderName | null;
  if (rawFallback === 'none') {
    fallback = null;
  } else if (isProviderName(rawFallback)) {
    fallback = rawFallback;
  } else {
    if (rawFallback) {
      console.warn(`[Email] unknown EMAIL_FALLBACK="${rawFallback}", defaulting to "${defaultFallback}"`);
    }
    fallback = defaultFallback;
  }

  // Retrying against the same provider is pointless.
  if (fallback === primary) fallback = null;

  return { primary, fallback };
}

class EmailApiError extends Error {
  constructor(
    provider: ProviderName,
    readonly statusCode: number,
    readonly errorName: string,
    message: string,
  ) {
    super(`[Email:${provider}] ${errorName} (HTTP ${statusCode}): ${message}`);
    this.name = 'EmailApiError';
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Extract the bare email from `"Name <email>"`; trims and returns as-is if there's no display name. */
function extractBareEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/**
 * Shape a canonical payload into the wire payload for a given provider.
 * - `to` is always an array (Resend accepts string or array, FreeResend requires array).
 * - `from` is bare-email-only for FreeResend (its zod rejects display-name format);
 *   Resend keeps the display name for sender UX.
 */
export function toWirePayload(provider: ProviderName, payload: EmailPayload): Record<string, unknown> {
  const from = provider === 'freeresend' ? extractBareEmail(payload.from) : payload.from;
  const wire: Record<string, unknown> = {
    from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
  };
  if (payload.headers) {
    wire.headers = payload.headers;
  }
  return wire;
}

/** Send once to a Resend-API-compatible endpoint. Returns the message id on success. */
export async function postEmail(
  provider: ProviderConfig,
  payload: EmailPayload,
  timeoutMs: number,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toWirePayload(provider.name, payload)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`[Email:${provider.name}] timeout after ${timeoutMs}ms`);
    }
    throw err;
  }

  if (!response.ok) {
    let errorName = 'application_error';
    let message = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        const e = body as { name?: unknown; message?: unknown; error?: unknown };
        if (typeof e.name === 'string') errorName = e.name;
        // FreeResend's post-zod authorization errors use `{ error: "..." }`
        // instead of Resend's `{ name, message }` — capture it too, or the
        // real reason collapses into a generic statusText.
        if (typeof e.message === 'string') {
          message = e.message;
        } else if (typeof e.error === 'string') {
          message = e.error;
        } else if (e.error && typeof e.error === 'object') {
          message = JSON.stringify(e.error);
        }
      }
    } catch {
      // non-JSON error body: keep statusText
    }
    throw new EmailApiError(provider.name, response.status, errorName, message);
  }

  const data = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof data?.id === 'string' ? data.id : null;
}

/**
 * Dead-man's switch: notify Slack when a fallback fires. No-op if
 * SLACK_ALERT_WEBHOOK_URL is unset (graceful degradation before the env is
 * provisioned). POST failures are logged only, never propagated to the
 * caller. The cooldown Map is per-isolate / best-effort only — Workers give
 * no persistence guarantee across isolates, which is acceptable for this
 * alert (see task scope: KV-backed persistence is out of scope).
 */
const fallbackAlertLastSent = new Map<string, number>();
const FALLBACK_ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min

export async function notifyFallbackFired(
  env: Env,
  primary: ProviderName,
  fallback: ProviderName,
  id: string | null,
): Promise<void> {
  const webhookUrl = env.SLACK_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const dedupeKey = `fallback:${primary}->${fallback}`;
  const last = fallbackAlertLastSent.get(dedupeKey);
  if (last && Date.now() - last < FALLBACK_ALERT_COOLDOWN_MS) return;
  fallbackAlertLastSent.set(dedupeKey, Date.now());

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 [PomoCare] Email fallback fired: primary=${primary} failed, delivered via fallback=${fallback} (id=${id ?? 'unknown'})`,
      }),
      signal: AbortSignal.timeout(3_000),
    });
    // fetch doesn't throw on HTTP error responses, so leaving response.ok
    // unchecked would let a dead/misconfigured webhook URL silently kill the
    // dead-man's switch itself.
    if (!response.ok) {
      console.error(`[Email][FALLBACK] Slack notify failed: HTTP ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error(`[Email][FALLBACK] Slack notify failed: ${describeError(err)}`);
  }
}

/**
 * Send via the primary provider; on failure / non-2xx / timeout, retry once
 * via the fallback provider. Throws if both fail (or fallback is unavailable
 * and primary fails) — callers rely on this fail-loud behavior so upstream
 * retries (e.g. the Neon Auth webhook's own retry-on-500) still happen.
 * Logs only provider names / message ids / error summaries — never the
 * recipient's link/token or HTML body.
 */
export async function sendWithFallback(
  env: Env,
  payload: EmailPayload,
  opts?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? SEND_TIMEOUT_MS;
  const { primary, fallback } = resolveProviderOrder(env);

  const primaryConfig = resolveProvider(env, primary);
  let primaryError: unknown;

  if (primaryConfig) {
    try {
      const id = await postEmail(primaryConfig, payload, timeoutMs);
      console.log(`[Email] primary=${primary} success id=${id ?? 'unknown'}`);
      return;
    } catch (err) {
      primaryError = err;
      console.error(`[Email] primary=${primary} failed: ${describeError(err)}`);
    }
  } else {
    primaryError = new Error(`[Email] primary=${primary} is not configured (missing env)`);
    console.error(describeError(primaryError));
  }

  if (!fallback) {
    throw primaryError;
  }

  const fallbackConfig = resolveProvider(env, fallback);
  if (!fallbackConfig) {
    console.warn(`[Email] fallback=${fallback} skipped (not configured, missing env)`);
    throw primaryError;
  }

  try {
    const id = await postEmail(fallbackConfig, payload, timeoutMs);
    // Warn level on purpose: this is the direct signal for primary's success
    // rate. If primary is silently dead but fallback keeps delivering, "mail
    // arrives" would otherwise hide it at info level.
    console.warn(`[Email][FALLBACK] primary=${primary} failed, delivered via fallback=${fallback} id=${id ?? 'unknown'}`);
    await notifyFallbackFired(env, primary, fallback, id);
    return;
  } catch (fallbackErr) {
    console.error(`[Email] fallback=${fallback} also failed: ${describeError(fallbackErr)}`);
    throw new Error(
      `[Email] all providers failed: primary=${primary} (${describeError(primaryError)}) / fallback=${fallback} (${describeError(fallbackErr)})`,
    );
  }
}

/**
 * Wraps email content in the PomoCare brand layout:
 * light grey background → white card → logo → content → footer.
 */
export function emailLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto;">
    <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px;">
      <img src="https://pomocare.com/images/logo.svg" alt="PomoCare" width="180" style="display: block; margin: 0 auto 24px;">
      ${content}
    </div>
    <div style="text-align: center; color: #999999; font-size: 12px; margin-top: 32px;">
      &copy; PomoCare. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renders a centred Tiffany CTA button wrapped in a div for email clients.
 */
export function tiffanyButton(href: string, label: string): string {
  return `<div style="text-align: center; margin: 24px 0;">
    <a href="${href}" style="display: inline-block; background-color: #0abab5; color: #ffffff; padding: 16px 44px; border-radius: 6px; font-size: 16px; font-weight: 700; text-decoration: none;">${label}</a>
  </div>`;
}

/**
 * HTML template for password reset emails.
 * The reset link is valid for 1 hour.
 */
export function passwordResetTemplate(resetUrl: string): string {
  const content = `
    <h2 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Reset your password</h2>
    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hi there,</p>
    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">We got a request to reset your PomoCare password. Tap the button below to pick a new one.</p>
    ${tiffanyButton(resetUrl, 'Reset password')}
    <p style="color: #777777; font-size: 13px; line-height: 1.5; margin: 24px 0 8px;">This link expires in 1 hour. If you didn't ask for this, you can safely ignore this email.</p>
    <p style="color: #777777; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">Button not working? Paste this link into your browser:<br><a href="${resetUrl}" style="color: #0abab5; word-break: break-all;">${resetUrl}</a></p>
  `;
  return emailLayout(content, 'Reset your PomoCare password');
}

/**
 * HTML template for email verification emails.
 * The verification link is valid for 1 hour.
 */
export function emailVerificationTemplate(verifyUrl: string): string {
  const content = `
    <h2 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Confirm your email</h2>
    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Welcome to PomoCare!</p>
    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Please confirm your email address so we can activate your account.</p>
    ${tiffanyButton(verifyUrl, 'Confirm email')}
    <p style="color: #777777; font-size: 13px; line-height: 1.5; margin: 24px 0 8px;">This link expires in 1 hour. If you didn't sign up for PomoCare, you can ignore this message.</p>
    <p style="color: #777777; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">Button not working? Paste this link into your browser:<br><a href="${verifyUrl}" style="color: #0abab5; word-break: break-all;">${verifyUrl}</a></p>
  `;
  return emailLayout(content, 'Confirm your PomoCare email');
}
