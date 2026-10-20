const test = require('node:test');
const assert = require('node:assert/strict');

// No real key is needed: a fake Resend client is injected below.
process.env.FROM_EMAIL = 'PayLink <onboarding@resend.dev>';
process.env.RESEND_API_KEY = 're_test_key';

const emailService = require('../services/emailService');
const { buildWelcomeEmail } = require('../emails/welcomeEmail');
const { buildPaymentReceiptEmail, maskPhone } = require('../emails/paymentReceipt');
const { buildPasswordResetEmail } = require('../emails/passwordReset');
const app = require('../server');

emailService.config.retryDelayMs = 40; // keep the suite fast

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake Resend client. `script` is a list of behaviours consumed one per call:
// 'ok' | 'error' (resolves { error }) | 'throw' (rejects) | { delay }
function fakeResend(script = []) {
  const calls = [];
  const fake = {
    calls,
    emails: {
      async send(payload) {
        calls.push({ payload, at: Date.now() });
        const step = script.shift() ?? 'ok';
        if (typeof step === 'object' && step.delay) await sleep(step.delay);
        if (step === 'error') return { data: null, error: { message: 'rate limited' } };
        if (step === 'throw') throw new Error('network down');
        return { data: { id: `email_${calls.length}` }, error: null };
      },
    },
  };
  emailService._setClient(fake);
  return fake;
}

let base;
let server;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body, raw) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });

// Templates
test('welcome email: content, table layout, button styling and text version', () => {
  const { html, text } = buildWelcomeEmail({ name: 'Wanjiku Kamau' });

  assert.match(html, /Welcome, Wanjiku!/);
  assert.doesNotMatch(html, /Welcome, Wanjiku Kamau/);
  assert.match(html, /<table/);
  assert.match(html, /style="/);
  for (const step of [
    'Log in to your dashboard',
    'Create your first payment link',
    'Share the link with your customer',
    'Get paid via M-Pesa instantly',
  ]) {
    assert.ok(html.includes(step), `html missing step: ${step}`);
    assert.ok(text.includes(step), `text missing step: ${step}`);
  }
  assert.match(html, /M-Pesa payments/);
  assert.match(
    html,
    /background-color: #0066ff; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none/,
  );
  assert.match(html, /href="https:\/\/paylink\.example\.com\/dashboard"/);
  assert.match(html, />Go to Dashboard</);
  assert.ok(html.includes('You received this email because you created a PayLink account.'));

  assert.ok(text.startsWith('Welcome, Wanjiku!'));
  assert.ok(text.includes('1. Log in to your dashboard'));
  assert.ok(text.includes('4. Get paid via M-Pesa instantly'));
  assert.ok(text.includes('Go to Dashboard: https://paylink.example.com/dashboard'));
  assert.doesNotMatch(text, /<[a-z/]/i, 'text version must not contain HTML');
});

test('welcome email: first name extraction handles odd input and escapes HTML', () => {
  assert.match(buildWelcomeEmail({ name: '  Ochieng   Otieno ' }).html, /Welcome, Ochieng!/);
  assert.match(buildWelcomeEmail({ name: 'Amina' }).html, /Welcome, Amina!/);
  assert.match(buildWelcomeEmail({ name: '   ' }).html, /Welcome, there!/);

  const evil = buildWelcomeEmail({ name: '<script>alert(1)</script> Bob' });
  assert.ok(!evil.html.includes('<script>alert'), 'user input must be escaped');
  assert.ok(evil.html.includes('&lt;script&gt;'));
});

test('payment receipt: amount, masked phone, details, link and footer', () => {
  const { html, text } = buildPaymentReceiptEmail({
    amount: 2500,
    phone: '0712345678',
    transactionId: 'TXN1698234567890',
    merchantName: 'Mama Mboga Store',
    paidAt: '2026-10-19T12:30:00Z',
  });

  assert.match(html, /Payment Successful/);
  assert.match(html, />KES 2,500</);
  assert.ok(html.includes('******5678'));
  assert.ok(!html.includes('0712345678'), 'full phone number must never appear');
  assert.ok(html.includes('Mama Mboga Store'));
  assert.ok(html.includes('TXN1698234567890'));
  assert.ok(html.includes('Monday, 19 October 2026 at 15:30'), 'Nairobi time (UTC+3)');
  assert.ok(html.includes('https://paylink.example.com/transactions/TXN1698234567890'));
  assert.match(html, />View Transaction</);
  assert.match(html, /#f3f4f6/);
  assert.ok(
    html.includes('This is an automated receipt from PayLink. If you did not make this payment, please contact support.'),
  );

  assert.ok(text.includes('Amount: KES 2,500'));
  assert.ok(text.includes('Phone: ******5678'));
  assert.ok(!text.includes('0712345678'));
  assert.doesNotMatch(text, /<[a-z/]/i);
});

test('payment receipt: phone masking, bad dates and escaping', () => {
  assert.equal(maskPhone('0712345678'), '******5678');
  assert.equal(maskPhone('+254 712 345 678'), '*********5678');
  assert.equal(maskPhone('1234'), '1234');
  assert.equal(maskPhone(''), '');

  const { html } = buildPaymentReceiptEmail({
    amount: 1234567.5,
    phone: '0700000000',
    transactionId: 'TXN 1/2',
    merchantName: 'A&B <Traders>',
    paidAt: 'not a date',
  });
  assert.doesNotMatch(html, /Invalid Date/);
  assert.ok(html.includes('KES 1,234,567.5'));
  assert.ok(html.includes('A&amp;B &lt;Traders&gt;'));
  assert.ok(html.includes('/transactions/TXN%201%2F2'), 'transaction id must be URL-encoded');
});

test('password reset: URL, expiry notice and fallback link', () => {
  const token = 'a'.repeat(64);
  const { html, text, resetUrl } = buildPasswordResetEmail({
    name: 'Wanjiku Kamau',
    email: 'wanjiku+test@example.com',
    token,
  });

  assert.equal(
    resetUrl,
    `https://paylink.example.com/reset-password?token=${token}&email=wanjiku%2Btest%40example.com`,
  );
  assert.match(html, /Hi Wanjiku,/);
  assert.match(html, />Reset Password</);
  assert.ok(html.includes(resetUrl.replace(/&/g, '&amp;')), 'button href and fallback are HTML-escaped');
  assert.ok(html.includes('This link expires in 1 hour.'));
  assert.ok(html.includes("copy and paste this link"));
  assert.ok(text.includes(`Reset Password: ${resetUrl}`));
  assert.ok(text.includes('This link expires in 1 hour.'));
  assert.doesNotMatch(text, /<[a-z/]/i);
});

test('bonus: all templates share the responsive layout, header and footer', () => {
  const emails = {
    welcome: buildWelcomeEmail({ name: 'A B' }).html,
    receipt: buildPaymentReceiptEmail({ amount: 1, phone: '0712345678', transactionId: 'T1', merchantName: 'M' }).html,
    reset: buildPasswordResetEmail({ name: 'A B', email: 'a@b.co', token: 'x' }).html,
  };
  for (const [name, html] of Object.entries(emails)) {
    assert.match(html, /width: 100%; max-width: 600px/, `${name}: responsive container`);
    assert.match(html, /border: 1px solid #e5e7eb/, `${name}: border`);
    assert.match(html, /box-shadow/, `${name}: shadow`);
    assert.match(html, /bgcolor="#0b1b3a"/, `${name}: dark header`);
    assert.match(html, /Pay<span[^>]*>Link<\/span>/, `${name}: logo text`);
    assert.match(html, /name="viewport"/, `${name}: viewport meta`);
    assert.match(html, /@media only screen and \(max-width: 620px\)/, `${name}: mobile styles`);
    assert.match(html, /\d{4} PayLink\. All rights reserved\./, `${name}: copyright`);
    assert.match(html, /mailto:support@paylink\.example\.com/, `${name}: support link`);
    for (const social of ['Twitter', 'LinkedIn', 'GitHub']) assert.ok(html.includes(`>${social}</a>`), `${name}: ${social}`);
  }
});

// emailService
test('sendEmail: sends the right payload and wraps a single recipient in an array', async () => {
  const fake = fakeResend();
  const data = await emailService.sendEmail({ to: 'a@b.co', subject: 'Hi', html: '<p>x</p>', text: 'x' });
  assert.equal(data.id, 'email_1');
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fake.calls[0].payload, {
    from: 'PayLink <onboarding@resend.dev>',
    to: ['a@b.co'],
    subject: 'Hi',
    html: '<p>x</p>',
    text: 'x',
  });
});

test('sendEmail: retries once after a failure and succeeds', async () => {
  for (const kind of ['error', 'throw']) {
    const fake = fakeResend([kind]);
    const data = await emailService.sendEmail({ to: ['a@b.co', 'c@d.co'], subject: 'Hi', html: 'x', text: 'x' });
    assert.equal(data.id, 'email_2');
    assert.equal(fake.calls.length, 2, `${kind}: exactly one retry`);
    assert.ok(fake.calls[1].at - fake.calls[0].at >= 35, `${kind}: waited before retrying`);
    assert.deepEqual(fake.calls[1].payload.to, ['a@b.co', 'c@d.co']);
  }
});

test('sendEmail: throws when the retry also fails, and never retries more than once', async () => {
  const fake = fakeResend(['error', 'error', 'ok']);
  await assert.rejects(emailService.sendEmail({ to: 'a@b.co', subject: 'Hi', html: 'x', text: 'x' }), /rate limited/);
  assert.equal(fake.calls.length, 2);

  const fake2 = fakeResend(['throw', 'throw']);
  await assert.rejects(emailService.sendEmail({ to: 'a@b.co', subject: 'Hi', html: 'x', text: 'x' }), /network down/);
  assert.equal(fake2.calls.length, 2);
});

test('sendEmail: validates input without calling Resend', async () => {
  const fake = fakeResend();
  await assert.rejects(emailService.sendEmail({ subject: 'Hi', html: 'x' }), /"to" is required/);
  await assert.rejects(emailService.sendEmail({ to: 'a@b.co', html: 'x' }), /"subject" is required/);
  assert.equal(fake.calls.length, 0);
});

test('convenience functions use the right subjects and templates', async () => {
  const fake = fakeResend();

  await emailService.sendWelcomeEmail({ name: 'Wanjiku Kamau', email: 'w@example.com' });
  await emailService.sendPaymentReceipt({
    email: 'w@example.com',
    amount: 2500,
    phone: '0712345678',
    transactionId: 'TXN1',
    merchantName: 'Mama Mboga Store',
  });
  await emailService.sendPasswordReset({ name: 'Wanjiku Kamau', email: 'w@example.com' }, 'tok123');

  const [welcome, receipt, reset] = fake.calls.map((c) => c.payload);
  assert.equal(welcome.subject, 'Welcome to PayLink');
  assert.match(welcome.html, /Welcome, Wanjiku!/);
  assert.equal(receipt.subject, 'Payment Receipt - KES 2,500');
  assert.match(receipt.html, /\*\*\*\*\*\*5678/);
  assert.match(receipt.html, /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/, 'paidAt defaults to now');
  assert.equal(reset.subject, 'Reset Your Password - PayLink');
  assert.ok(reset.html.includes('token=tok123'));
  assert.ok(reset.text.includes('token=tok123&email=w%40example.com'));
});

test('missing API key gives a clear error instead of crashing the server', async () => {
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  emailService._setClient(null);
  const started = Date.now();
  await assert.rejects(
    emailService.sendEmail({ to: 'a@b.co', subject: 'Hi', html: 'x', text: 'x' }),
    /RESEND_API_KEY is not set/,
  );
  assert.ok(Date.now() - started < 30, 'no pointless retry when the key is missing');
  process.env.RESEND_API_KEY = saved;
});

// HTTP endpoints
test('POST /api/register: responds 201 immediately and sends the email in the background', async () => {
  const fake = fakeResend([{ delay: 300 }]); // slow provider
  const started = Date.now();
  const res = await post('/api/register', { name: 'Wanjiku Kamau', email: 'wanjiku@example.com' });
  const elapsed = Date.now() - started;

  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { success: true, message: 'Account created. Welcome email sent.' });
  assert.ok(elapsed < 200, `response must not wait for the provider (took ${elapsed}ms)`);

  await sleep(400);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].payload.subject, 'Welcome to PayLink');
  assert.deepEqual(fake.calls[0].payload.to, ['wanjiku@example.com']);
  assert.match(fake.calls[0].payload.html, /Welcome, Wanjiku!/);
});

test('POST /api/register: still returns 201 (and does not crash) when sending fails', async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const fake = fakeResend(['error', 'error']);
    const res = await post('/api/register', { name: 'Test User', email: 'test@example.com' });
    assert.equal(res.status, 201);
    await sleep(200);
    assert.equal(fake.calls.length, 2);
    assert.equal(logged.length, 1, 'failure is logged via .catch(console.error)');
  } finally {
    console.error = originalError;
  }
});

test('POST /api/register: validation', async () => {
  const fake = fakeResend();
  const bad = [
    {},
    { name: 'A' },
    { email: 'a@b.co' },
    { name: '', email: 'a@b.co' },
    { name: '   ', email: 'a@b.co' },
    { name: 'A', email: 'no-at-sign' },
    { name: 'A', email: '@' },
    { name: 'A', email: 'a@b' },
    { name: 'A', email: 'a b@c.co' },
    { name: 42, email: 'a@b.co' },
    { name: 'A', email: ['a@b.co'] },
    { name: 'x'.repeat(101), email: 'a@b.co' },
  ];
  for (const body of bad) {
    const res = await post('/api/register', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).success, false);
  }
  const malformed = await post('/api/register', null, '{not json');
  assert.equal(malformed.status, 400);
  await sleep(50);
  assert.equal(fake.calls.length, 0, 'nothing is sent for invalid requests');
});

test('POST /api/test/payment-receipt: sends the receipt and returns the transaction id', async () => {
  const fake = fakeResend();
  const res = await post('/api/test/payment-receipt', {
    email: 'wanjiku@example.com',
    amount: 2500,
    phone: '0712345678',
    merchantName: 'Mama Mboga Store',
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.match(body.transactionId, /^TXN\d{13}$/);
  assert.equal(body.message, 'Receipt email sent');

  const { payload } = fake.calls[0];
  assert.equal(payload.subject, 'Payment Receipt - KES 2,500');
  assert.ok(payload.html.includes(body.transactionId));
  assert.ok(payload.html.includes('******5678'));
  assert.ok(payload.html.includes('Mama Mboga Store'));

  // amounts sent as numeric strings are accepted
  const res2 = await post('/api/test/payment-receipt', {
    email: 'w@example.com',
    amount: '1000',
    phone: '0712345678',
    merchantName: 'Shop',
  });
  assert.equal(res2.status, 200);
  assert.equal(fake.calls[1].payload.subject, 'Payment Receipt - KES 1,000');
});

test('POST /api/test/payment-receipt: validation and provider failure', async () => {
  const fake = fakeResend();
  const valid = { email: 'a@b.co', amount: 100, phone: '0712345678', merchantName: 'Shop' };
  const bad = [
    { ...valid, email: 'nope' },
    { ...valid, email: undefined },
    { ...valid, amount: 0 },
    { ...valid, amount: -5 },
    { ...valid, amount: 'abc' },
    { ...valid, amount: undefined },
    { ...valid, phone: '' },
    { ...valid, merchantName: '  ' },
  ];
  for (const body of bad) assert.equal((await post('/api/test/payment-receipt', body)).status, 400, JSON.stringify(body));
  assert.equal(fake.calls.length, 0);

  const originalError = console.error;
  console.error = () => {};
  try {
    fakeResend(['error', 'error']);
    const res = await post('/api/test/payment-receipt', valid);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).success, false);
  } finally {
    console.error = originalError;
  }
});

test('POST /api/test/password-reset: sends a reset email with a random 64-char hex token', async () => {
  const fake = fakeResend();
  const res = await post('/api/test/password-reset', { name: 'Wanjiku Kamau', email: 'wanjiku@example.com' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);

  const { payload } = fake.calls[0];
  assert.equal(payload.subject, 'Reset Your Password - PayLink');
  const [, token] = payload.text.match(/token=([0-9a-f]{64})&email=wanjiku%40example\.com/);
  assert.ok(token);
  await post('/api/test/password-reset', { name: 'Wanjiku Kamau', email: 'wanjiku@example.com' });
  const [, token2] = fake.calls[1].payload.text.match(/token=([0-9a-f]{64})/);
  assert.notEqual(token, token2, 'a fresh token is generated each time');

  assert.equal((await post('/api/test/password-reset', { email: 'a@b.co' })).status, 400);
  assert.equal((await post('/api/test/password-reset', { name: 'A', email: 'bad' })).status, 400);
});

test('unknown routes return a JSON 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).success, false);
});
