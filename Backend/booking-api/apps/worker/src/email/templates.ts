// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { EmailPayloads, EmailTemplate } from '@tempora/db/emails';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Minimal, accessible HTML: one column, real text (no images), readable in dark mode clients. */
function layout(title: string, paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#17262f">
<main style="max-width:520px;margin:0 auto">${body}
<p style="margin:24px 0 0;font-size:13px;color:#5b6b75">Tempora · booking and invoicing for studios and clinics</p></main>
</body></html>`;
}

type Renderer<T extends EmailTemplate> = (payload: EmailPayloads[T]) => RenderedEmail;

const RENDERERS: { [T in EmailTemplate]: Renderer<T> } = {
  'console.login_code': ({ name, code, expiresInMinutes }) => ({
    subject: `${code} is your Tempora Console code`,
    text: `Hi ${name},\n\nYour login code is ${code}. It expires in ${expiresInMinutes} minutes.\n\nIf you did not try to log in, change your password.`,
    html: layout('Your login code', [
      `Hi ${escapeHtml(name)},`,
      'Your Tempora Console login code is:',
      `<strong style="font-size:28px;letter-spacing:6px">${code}</strong>`,
      `It expires in ${expiresInMinutes} minutes. If you did not try to log in, change your password.`,
    ]),
  }),

  'console.password_reset': ({ name, resetUrl, expiresInMinutes }) => ({
    subject: 'Reset your Tempora Console password',
    text: `Hi ${name},\n\nOpen this link to choose a new password (valid for ${expiresInMinutes} minutes):\n${resetUrl}\n\nIf you did not ask for this, ignore this email.`,
    html: layout('Reset your password', [
      `Hi ${escapeHtml(name)},`,
      `<a href="${escapeHtml(resetUrl)}" style="color:#2f5f78;font-weight:bold">Choose a new password</a> (valid for ${expiresInMinutes} minutes).`,
      'If you did not ask for this, you can ignore this email.',
    ]),
  }),

  'console.password_changed': ({ name }) => ({
    subject: 'Your Tempora Console password was changed',
    text: `Hi ${name},\n\nYour password was just changed and you were logged out everywhere.\nIf this was not you, reset your password now and contact your business owner.`,
    html: layout('Password changed', [
      `Hi ${escapeHtml(name)},`,
      'Your password was just changed and you were logged out on every device.',
      'If this was not you, reset your password now and contact your business owner.',
    ]),
  }),

  'portal.verify_email': ({ name, verifyUrl, expiresInHours }) => ({
    subject: 'Confirm your email for Tempora',
    text: `Hi ${name},\n\nConfirm your email address (valid for ${expiresInHours} hours):\n${verifyUrl}\n\nIf you did not create a Tempora account, ignore this email.`,
    html: layout('Confirm your email', [
      `Hi ${escapeHtml(name)},`,
      `<a href="${escapeHtml(verifyUrl)}" style="color:#2f5f78;font-weight:bold">Confirm your email address</a> (valid for ${expiresInHours} hours).`,
      'If you did not create a Tempora account, you can ignore this email.',
    ]),
  }),

  'portal.password_reset': ({ name, resetUrl, expiresInMinutes }) => ({
    subject: 'Reset your Tempora password',
    text: `Hi ${name},\n\nOpen this link to choose a new password (valid for ${expiresInMinutes} minutes):\n${resetUrl}\n\nIf you did not ask for this, ignore this email.`,
    html: layout('Reset your password', [
      `Hi ${escapeHtml(name)},`,
      `<a href="${escapeHtml(resetUrl)}" style="color:#2f5f78;font-weight:bold">Choose a new password</a> (valid for ${expiresInMinutes} minutes).`,
      'If you did not ask for this, you can ignore this email.',
    ]),
  }),

  'portal.password_changed': ({ name }) => ({
    subject: 'Your Tempora password was changed',
    text: `Hi ${name},\n\nYour password was just changed and you were logged out on every device.\nIf this was not you, reset your password now.`,
    html: layout('Password changed', [
      `Hi ${escapeHtml(name)},`,
      'Your password was just changed and you were logged out on every device.',
      'If this was not you, reset your password now.',
    ]),
  }),

  'console.invitation': ({
    businessName,
    inviterName,
    role,
    branchName,
    acceptUrl,
    expiresInDays,
  }) => {
    const place = branchName ? `${role} at ${branchName}` : role;
    return {
      subject: `${inviterName} invited you to ${businessName} on Tempora`,
      text: `${inviterName} invited you to join ${businessName} as ${place}.

Accept the invitation (valid for ${expiresInDays} days):
${acceptUrl}

If you were not expecting this, ignore this email.`,
      html: layout(`Join ${businessName}`, [
        `${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(businessName)}</strong> as ${escapeHtml(place)}.`,
        `<a href="${escapeHtml(acceptUrl)}" style="color:#2f5f78;font-weight:bold">Accept the invitation</a> (valid for ${expiresInDays} days).`,
        'If you were not expecting this, you can ignore this email.',
      ]),
    };
  },
};

export function isKnownTemplate(template: string): template is EmailTemplate {
  return Object.hasOwn(RENDERERS, template);
}

export function renderEmail<T extends EmailTemplate>(
  template: T,
  payload: EmailPayloads[T],
): RenderedEmail {
  return (RENDERERS[template] as Renderer<T>)(payload);
}
