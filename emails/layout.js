// Shared building blocks for every PayLink email (bonus: consistent header + footer).
// Email clients are picky: layouts use nested tables and inline styles. The only <style>
// block is a progressive-enhancement media query for small screens.

const BRAND = {
  name: 'PayLink',
  dark: '#0b1b3a', // header background
  blue: '#0066ff', // CTA buttons
  green: '#16a34a',
  text: '#1f2937',
  muted: '#6b7280',
  pageBg: '#f3f4f6',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const LINKS = {
  dashboard: 'https://paylink.example.com/dashboard',
  transactions: 'https://paylink.example.com/transactions',
  resetPassword: 'https://paylink.example.com/reset-password',
  supportEmail: 'support@paylink.example.com',
  twitter: 'https://twitter.com/paylink',
  linkedin: 'https://www.linkedin.com/company/paylink',
  github: 'https://github.com/paylink',
};

// User-supplied values (names, merchants) end up inside HTML, so always escape them.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "Wanjiku Kamau" -> "Wanjiku". Trims first so leading spaces don't produce an empty name.
function firstNameOf(name) {
  return String(name ?? '').trim().split(/\s+/)[0] || 'there';
}

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString('en-US')}`;
}

// Bulletproof button: the colours live on the <a> (as specified) and on the table cell so
// Outlook, which ignores padding on links, still shows a solid button.
function button(label, href) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
  <tr>
    <td align="center" bgcolor="${BRAND.blue}" style="border-radius: 8px; background-color: ${BRAND.blue};">
      <a href="${escapeHtml(href)}" target="_blank" style="background-color: #0066ff; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block; font-family: ${BRAND.font}; font-size: 16px; font-weight: 600; line-height: 1.2;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function header() {
  return `
<tr>
  <td align="center" bgcolor="${BRAND.dark}" style="background-color: ${BRAND.dark}; padding: 28px 24px; border-radius: 12px 12px 0 0;">
    <span style="font-family: ${BRAND.font}; font-size: 28px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">Pay<span style="color: #4d94ff;">Link</span></span>
  </td>
</tr>`;
}

function footer(note) {
  const link = `color: ${BRAND.muted}; text-decoration: underline;`;
  return `
<tr>
  <td align="center" bgcolor="#f9fafb" class="px" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; font-family: ${BRAND.font}; font-size: 13px; line-height: 1.6; color: ${BRAND.muted};">
    <p style="margin: 0 0 12px;">${escapeHtml(note)}</p>
    <p style="margin: 0 0 12px;">
      <a href="${LINKS.twitter}" style="${link}">Twitter</a>
      &nbsp;&middot;&nbsp;
      <a href="${LINKS.linkedin}" style="${link}">LinkedIn</a>
      &nbsp;&middot;&nbsp;
      <a href="${LINKS.github}" style="${link}">GitHub</a>
    </p>
    <p style="margin: 0 0 4px;">Need help? <a href="mailto:${LINKS.supportEmail}" style="${link}">${LINKS.supportEmail}</a></p>
    <p style="margin: 0;">&copy; ${new Date().getFullYear()} PayLink. All rights reserved.</p>
  </td>
</tr>`;
}

// Wraps template-specific content in the shared header/footer. The container is
// max-width 600px but width 100%, so it shrinks on phones; the border and shadow give it depth.
function renderLayout({ title, preheader = '', content, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .outer { padding: 12px 8px !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .amount { font-size: 34px !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.pageBg}; -webkit-text-size-adjust: 100%;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.pageBg}" style="background-color: ${BRAND.pageBg};">
    <tr>
      <td align="center" class="outer" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);">
          ${header()}
          <tr>
            <td class="px" style="padding: 36px 40px 28px; font-family: ${BRAND.font}; font-size: 16px; line-height: 1.6; color: ${BRAND.text};">
              ${content}
            </td>
          </tr>
          ${footer(footerNote)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Plain-text counterpart of the footer, shared by every text version.
function textFooter(note) {
  return [
    '--',
    note,
    `Need help? ${LINKS.supportEmail}`,
    `Twitter: ${LINKS.twitter} | LinkedIn: ${LINKS.linkedin} | GitHub: ${LINKS.github}`,
    `© ${new Date().getFullYear()} PayLink. All rights reserved.`,
  ].join('\n');
}

module.exports = { BRAND, LINKS, escapeHtml, firstNameOf, formatKES, button, renderLayout, textFooter };
