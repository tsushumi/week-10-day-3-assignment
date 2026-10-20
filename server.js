require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const {
  sendWelcomeEmail,
  sendPaymentReceipt,
  sendPasswordReset,
} = require('./services/emailService');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Validation helpers
// Spec: the email must contain "@". This also requires text on both sides and a dot in the
// domain, which still accepts every normal address but rejects things like "@" or "a@b".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isValidEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_PATTERN.test(v.trim());

function fail(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

// Task 1: registration -> welcome email
app.post('/api/register', (req, res) => {
  const { name, email } = req.body || {};

  if (!isNonEmptyString(name) || !isNonEmptyString(email)) return fail(res, 'name and email are required');
  if (name.trim().length > 100) return fail(res, 'name must be 100 characters or fewer');
  if (!isValidEmail(email)) return fail(res, 'email must be a valid email address');

  // Fire and forget: the response does not wait for the email provider.
  sendWelcomeEmail({ name: name.trim(), email: email.trim() }).catch(console.error);

  res.status(201).json({ success: true, message: 'Account created. Welcome email sent.' });
});

// Task 2: payment receipt
app.post('/api/test/payment-receipt', async (req, res) => {
  const { email, amount, phone, merchantName } = req.body || {};

  if (!isValidEmail(email)) return fail(res, 'a valid email is required');
  const numericAmount = typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : amount;
  if (typeof numericAmount !== 'number' || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return fail(res, 'amount must be a positive number');
  }
  if (!isNonEmptyString(phone)) return fail(res, 'phone is required');
  if (!isNonEmptyString(merchantName)) return fail(res, 'merchantName is required');

  const transactionId = `TXN${Date.now()}`;

  try {
    await sendPaymentReceipt({
      email: email.trim(),
      amount: numericAmount,
      phone: phone.trim(),
      transactionId,
      merchantName: merchantName.trim(),
      paidAt: new Date(),
    });
  } catch (err) {
    console.error('Receipt email failed:', err.message);
    return fail(res, 'Could not send the receipt email', 502);
  }

  res.json({ success: true, transactionId, message: 'Receipt email sent' });
});

// Task 3: password reset
app.post('/api/test/password-reset', async (req, res) => {
  const { name, email } = req.body || {};

  if (!isNonEmptyString(name)) return fail(res, 'name is required');
  if (!isValidEmail(email)) return fail(res, 'a valid email is required');

  const token = crypto.randomBytes(32).toString('hex'); // fake token for this exercise

  try {
    await sendPasswordReset({ name: name.trim(), email: email.trim() }, token);
  } catch (err) {
    console.error('Password reset email failed:', err.message);
    return fail(res, 'Could not send the password reset email', 502);
  }

  res.json({ success: true, message: 'Password reset email sent' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', emailConfigured: Boolean(process.env.RESEND_API_KEY) });
});

// Error handling
app.use((req, res) => fail(res, 'Not found', 404));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 'Request body must be valid JSON');
  console.error(err);
  fail(res, 'Internal server error', 500);
});

if (require.main === module) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Warning: RESEND_API_KEY is not set. Emails will fail until you add it to .env.');
  }
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
