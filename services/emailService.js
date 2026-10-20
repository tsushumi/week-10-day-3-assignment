require('dotenv').config({ quiet: true });
const { Resend } = require('resend');
const { buildWelcomeEmail } = require('../emails/welcomeEmail');
const { buildPaymentReceiptEmail } = require('../emails/paymentReceipt');
const { buildPasswordResetEmail } = require('../emails/passwordReset');
const { formatKES } = require('../emails/layout');

const FROM_EMAIL = process.env.FROM_EMAIL || 'PayLink <onboarding@resend.dev>';

// Exposed so tests can shorten the wait between the first attempt and the retry.
const config = { retryDelayMs: 1000 };

// The Resend constructor throws when there is no API key, so the client is created on first
// use. That way the server still boots (and tells you what is wrong) instead of crashing on import.
let client = null;
function getClient() {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set. Copy .env.example to .env and add your Resend API key.');
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

// Test hook: inject a fake Resend client (pass null to reset).
function _setClient(fake) {
  client = fake;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One attempt. Resend reports API errors in the response ({ error }) rather than throwing,
// so both styles of failure are turned into a thrown Error here.
async function attemptSend(payload) {
  const { data, error } = await getClient().emails.send(payload);
  if (error) throw new Error(error.message || 'Resend returned an error');
  if (!data || !data.id) throw new Error('Resend returned no email id');
  return data;
}

/**
 * Base sender: wraps resend.emails.send(), logs the email ID on success, and retries once
 * after 1 second. If the retry also fails, the error is thrown to the caller.
 */
async function sendEmail({ to, subject, html, text }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');

  const payload = { from: FROM_EMAIL, to: recipients, subject, html, text };

  try {
    const data = await attemptSend(payload);
    console.log(`Email sent to ${recipients.join(', ')}: ${data.id}`);
    return data;
  } catch (err) {
    // A missing API key will not fix itself in one second, so don't wait and retry for it.
    if (!process.env.RESEND_API_KEY && !client) throw err;

    console.warn(`Email failed, retrying in ${config.retryDelayMs / 1000}s: ${err.message}`);
    await sleep(config.retryDelayMs);

    const data = await attemptSend(payload); // a second failure propagates
    console.log(`Email sent on retry to ${recipients.join(', ')}: ${data.id}`);
    return data;
  }
}

// ---------------------------------------------------------------------------
// Convenience functions: build the template, then hand it to sendEmail()
// ---------------------------------------------------------------------------

function sendWelcomeEmail({ name, email }) {
  const { html, text } = buildWelcomeEmail({ name });
  return sendEmail({ to: email, subject: 'Welcome to PayLink', html, text });
}

function sendPaymentReceipt({ email, amount, phone, transactionId, merchantName, paidAt }) {
  const receipt = { amount, phone, transactionId, merchantName, paidAt: paidAt || new Date() };
  const { html, text } = buildPaymentReceiptEmail(receipt);
  return sendEmail({
    to: email,
    subject: `Payment Receipt - ${formatKES(amount)}`,
    html,
    text,
  });
}

function sendPasswordReset({ name, email }, token) {
  const { html, text } = buildPasswordResetEmail({ name, email, token });
  return sendEmail({ to: email, subject: 'Reset Your Password - PayLink', html, text });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPaymentReceipt,
  sendPasswordReset,
  config,
  _setClient,
};
