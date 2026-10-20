const { BRAND, LINKS, escapeHtml, firstNameOf, button, renderLayout, textFooter } = require('./layout');

const FOOTER_NOTE = "If you didn't request a password reset, you can safely ignore this email.";
const EXPIRY_NOTICE = 'This link expires in 1 hour.';

function buildResetUrl(token, email) {
  // encodeURIComponent leaves hex tokens untouched but keeps other values URL-safe.
  return `${LINKS.resetPassword}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

function buildPasswordResetEmail({ name, email, token }) {
  const firstName = firstNameOf(name);
  const resetUrl = buildResetUrl(token, email);
  const explanation =
    'We received a request to reset the password for your PayLink account. Click the button below to choose a new one.';

  const content = `
<h1 style="margin: 0 0 16px; font-family: ${BRAND.font}; font-size: 28px; line-height: 1.25; color: ${BRAND.dark};">Hi ${escapeHtml(firstName)},</h1>
<p style="margin: 0 0 8px;">${escapeHtml(explanation)}</p>
${button('Reset Password', resetUrl)}
<p style="margin: 0 0 20px; font-weight: 600; color: ${BRAND.dark};">${EXPIRY_NOTICE}</p>
<p style="margin: 0 0 6px; font-size: 14px; color: ${BRAND.muted};">If the button doesn't work, copy and paste this link into your browser:</p>
<p style="margin: 0; font-size: 13px; color: ${BRAND.muted}; word-break: break-all; overflow-wrap: anywhere;">${escapeHtml(resetUrl)}</p>`;

  const html = renderLayout({
    title: 'Reset Your Password - PayLink',
    preheader: 'Use the link inside to reset your PayLink password. It expires in 1 hour.',
    content,
    footerNote: FOOTER_NOTE,
  });

  const text = [
    `Hi ${firstName},`,
    '',
    explanation,
    '',
    `Reset Password: ${resetUrl}`,
    '',
    EXPIRY_NOTICE,
    '',
    "If the button doesn't work, copy and paste the link above into your browser.",
    '',
    textFooter(FOOTER_NOTE),
  ].join('\n');

  return { html, text, resetUrl };
}

module.exports = { buildPasswordResetEmail, buildResetUrl };
