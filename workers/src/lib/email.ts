import type { Env } from '../types';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend REST API.
 * Throws if the response is not 2xx.
 */
export async function sendEmail(env: Env, opts: SendEmailOptions): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${text}`);
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
