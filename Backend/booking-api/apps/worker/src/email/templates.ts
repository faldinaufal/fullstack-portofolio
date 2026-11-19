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

  'portal.booking_confirmed': (p) => {
    const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      p.priceCents / 100,
    );
    const place = p.address ? `${p.branchName}, ${p.address}` : p.branchName;
    return {
      subject: `Booking confirmed: ${p.serviceName} at ${p.businessName}`,
      text: `Hi ${p.name},\n\nYour booking is confirmed.\n\n${p.serviceName} with ${p.therapist}\n${p.when}\n${place}\nPaid: ${price} (invoice ${p.invoiceNumber})\n\nDetails: ${p.bookingUrl}`,
      html: layout('Booking confirmed', [
        `Hi ${escapeHtml(p.name)},`,
        `Your booking at <strong>${escapeHtml(p.businessName)}</strong> is confirmed.`,
        `<strong>${escapeHtml(p.serviceName)}</strong> with ${escapeHtml(p.therapist)}<br>${escapeHtml(p.when)}<br>${escapeHtml(place)}`,
        `Paid: ${price} (invoice ${escapeHtml(p.invoiceNumber)})`,
        `<a href="${escapeHtml(p.bookingUrl)}" style="color:#2f5f78;font-weight:bold">View your booking</a>`,
      ]),
    };
  },

  'portal.booking_reminder': (p) => {
    const place = p.address ? `${p.branchName}, ${p.address}` : p.branchName;
    return {
      subject: `Reminder: ${p.serviceName} at ${p.businessName} tomorrow`,
      text: `Hi ${p.name},

A reminder of your booking.

${p.serviceName} with ${p.therapist}
${p.when}
${place}

Details: ${p.bookingUrl}`,
      html: layout('Booking reminder', [
        `Hi ${escapeHtml(p.name)},`,
        `A reminder of your booking at <strong>${escapeHtml(p.businessName)}</strong>.`,
        `<strong>${escapeHtml(p.serviceName)}</strong> with ${escapeHtml(p.therapist)}<br>${escapeHtml(p.when)}<br>${escapeHtml(place)}`,
        `<a href="${escapeHtml(p.bookingUrl)}" style="color:#2f5f78;font-weight:bold">View your booking</a>`,
      ]),
    };
  },

  'portal.booking_rescheduled': (p) => {
    const place = p.address ? `${p.branchName}, ${p.address}` : p.branchName;
    const now = `${p.when} with ${p.therapist}`;
    const was = `${p.previousWhen} with ${p.previousTherapist}`;
    return {
      subject: `Booking changed: ${p.serviceName} at ${p.businessName}`,
      text: `Hi ${p.name},\n\nYour booking was changed.\n\nNew: ${now}\nWas: ${was}\n\n${p.serviceName}\n${place}\n\nDetails: ${p.bookingUrl}`,
      html: layout('Booking changed', [
        `Hi ${escapeHtml(p.name)},`,
        `Your booking at <strong>${escapeHtml(p.businessName)}</strong> was changed.`,
        `<strong>${escapeHtml(now)}</strong><br><span style="color:#5b6b75">was ${escapeHtml(was)}</span>`,
        `${escapeHtml(p.serviceName)}<br>${escapeHtml(place)}`,
        `<a href="${escapeHtml(p.bookingUrl)}" style="color:#2f5f78;font-weight:bold">View your booking</a>`,
      ]),
    };
  },

  'portal.booking_cancelled': (p) => {
    const refund = p.refundByBusiness
      ? `${p.businessName} will refund your payment directly.`
      : 'Nothing was charged.';
    const reason = p.reason ? `Reason: ${p.reason}` : null;
    return {
      subject: `Booking cancelled: ${p.serviceName} at ${p.businessName}`,
      text: `Hi ${p.name},\n\n${p.businessName} cancelled your booking.\n\n${p.serviceName} with ${p.therapist}\n${p.when}\n${reason ? `${reason}\n` : ''}\n${refund}\n\nDetails: ${p.bookingUrl}`,
      html: layout('Booking cancelled', [
        `Hi ${escapeHtml(p.name)},`,
        `<strong>${escapeHtml(p.businessName)}</strong> cancelled your booking.`,
        `${escapeHtml(p.serviceName)} with ${escapeHtml(p.therapist)}<br>${escapeHtml(p.when)}`,
        ...(reason ? [escapeHtml(reason)] : []),
        escapeHtml(refund),
        `<a href="${escapeHtml(p.bookingUrl)}" style="color:#2f5f78;font-weight:bold">View your booking</a>`,
      ]),
    };
  },

  'admin.login_code': ({ name, code, expiresInMinutes }) => ({
    subject: `${code} is your Tempora Platform Admin code`,
    text: `Hi ${name},

Your Platform Admin code is ${code}. It expires in ${expiresInMinutes} minutes.

If you did not try to sign in, tell the team at once.`,
    html: layout('Your Platform Admin code', [
      `Hi ${escapeHtml(name)},`,
      'Your Tempora Platform Admin code is:',
      `<strong style="font-size:28px;letter-spacing:6px">${code}</strong>`,
      `It expires in ${expiresInMinutes} minutes. If you did not try to sign in, tell the team at once.`,
    ]),
  }),

  'console.tenant_suspended': ({ name, businessName, reason }) => ({
    subject: `${businessName} is suspended on Tempora`,
    text: `Hi ${name},

${businessName} has been suspended on Tempora.

Reason: ${reason}

Customers cannot book while it is suspended; existing bookings stay as they are. The Console stays open in read-only mode. Reply to this email to resolve it.`,
    html: layout('Business suspended', [
      `Hi ${escapeHtml(name)},`,
      `<strong>${escapeHtml(businessName)}</strong> has been suspended on Tempora.`,
      `Reason: ${escapeHtml(reason)}`,
      'Customers cannot book while it is suspended; existing bookings stay as they are. The Console stays open in read-only mode. Reply to this email to resolve it.',
    ]),
  }),

  'console.tenant_reactivated': ({ name, businessName, consoleUrl }) => ({
    subject: `${businessName} is active again on Tempora`,
    text: `Hi ${name},

${businessName} is active again: customers can book and the Console works as usual.

${consoleUrl}`,
    html: layout('Business active again', [
      `Hi ${escapeHtml(name)},`,
      `<strong>${escapeHtml(businessName)}</strong> is active again: customers can book and the Console works as usual.`,
      `<a href="${escapeHtml(consoleUrl)}" style="color:#2f5f78;font-weight:bold">Open the Console</a>`,
    ]),
  }),

  'console.payment_needs_attention': ({ name, bookingId }) => ({
    subject: 'A payment needs your attention',
    text: `Hi ${name},\n\nA payment arrived for booking ${bookingId}, which was no longer waiting for payment (it expired or was cancelled). Please review it in the Console and refund the customer outside Tempora if needed.`,
    html: layout('A payment needs your attention', [
      `Hi ${escapeHtml(name)},`,
      `A payment arrived for booking <code>${escapeHtml(bookingId)}</code>, which was no longer waiting for payment (it expired or was cancelled).`,
      'Please review it in the Console and refund the customer outside Tempora if needed.',
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
