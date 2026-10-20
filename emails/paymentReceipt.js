const { BRAND, LINKS, escapeHtml, formatKES, button, renderLayout, textFooter } = require('./layout');

const FOOTER_NOTE =
  'This is an automated receipt from PayLink. If you did not make this payment, please contact support.';

// 0712345678 -> ******5678 (only the last 4 digits are shown)
function maskPhone(phone) {
  const value = String(phone ?? '').replace(/\s+/g, '');
  if (!value) return '';
  if (value.length <= 4) return value;
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

function formatDateTime(paidAt) {
  let date = paidAt ? new Date(paidAt) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date(); // never print "Invalid Date" in a receipt
  return date.toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  });
}

function buildPaymentReceiptEmail({ amount, phone, transactionId, merchantName, paidAt }) {
  const formattedAmount = formatKES(amount);
  const maskedPhone = maskPhone(phone);
  const dateTime = formatDateTime(paidAt);
  const viewUrl = `${LINKS.transactions}/${encodeURIComponent(transactionId)}`;

  const rows = [
    ['Paid to', merchantName],
    ['Transaction ID', transactionId],
    ['Phone', maskedPhone],
    ['Date/Time', dateTime],
  ];

  const detailRows = rows
    .map(
      ([label, value], i) => `
    <tr>
      <td valign="top" style="padding: 12px 16px; ${i ? 'border-top: 1px solid #e5e7eb;' : ''} font-size: 14px; color: ${BRAND.muted}; width: 38%;">${label}</td>
      <td valign="top" align="right" style="padding: 12px 16px; ${i ? 'border-top: 1px solid #e5e7eb;' : ''} font-size: 14px; font-weight: 600; color: ${BRAND.text}; word-break: break-word;">${escapeHtml(value)}</td>
    </tr>`,
    )
    .join('');

  const content = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center">
      <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-family: ${BRAND.font}; font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 999px;">&#10003; Payment Successful</span>
    </td>
  </tr>
  <tr>
    <td align="center" class="amount" style="padding: 20px 0 6px; font-family: ${BRAND.font}; font-size: 42px; font-weight: 800; line-height: 1.1; color: ${BRAND.dark};">${escapeHtml(formattedAmount)}</td>
  </tr>
  <tr>
    <td align="center" style="padding: 0 0 24px; font-size: 14px; color: ${BRAND.muted};">Thank you for your payment</td>
  </tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="background-color: #f3f4f6; border-radius: 8px;">
  ${detailRows}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center">${button('View Transaction', viewUrl)}</td></tr>
</table>`;

  const html = renderLayout({
    title: 'Payment Receipt',
    preheader: `Payment of ${formattedAmount} to ${merchantName} was successful.`,
    content,
    footerNote: FOOTER_NOTE,
  });

  const text = [
    'Payment Successful',
    '',
    `Amount: ${formattedAmount}`,
    '',
    `Paid to: ${merchantName}`,
    `Transaction ID: ${transactionId}`,
    `Phone: ${maskedPhone}`,
    `Date/Time: ${dateTime}`,
    '',
    `View Transaction: ${viewUrl}`,
    '',
    textFooter(FOOTER_NOTE),
  ].join('\n');

  return { html, text };
}

module.exports = { buildPaymentReceiptEmail, maskPhone };
