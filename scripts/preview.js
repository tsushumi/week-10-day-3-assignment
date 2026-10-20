// Renders the three email templates with sample data into ./previews/*.html so you can open
// them in a browser (or screenshot them) without sending anything.
//   npm run preview
const fs = require('fs');
const path = require('path');
const { buildWelcomeEmail } = require('../emails/welcomeEmail');
const { buildPaymentReceiptEmail } = require('../emails/paymentReceipt');
const { buildPasswordResetEmail } = require('../emails/passwordReset');

const outDir = path.join(__dirname, '..', 'previews');
fs.mkdirSync(outDir, { recursive: true });

const samples = {
  welcome: buildWelcomeEmail({ name: 'Wanjiku Kamau' }),
  'payment-receipt': buildPaymentReceiptEmail({
    amount: 2500,
    phone: '0712345678',
    transactionId: 'TXN1698234567890',
    merchantName: 'Mama Mboga Store',
    paidAt: new Date(),
  }),
  'password-reset': buildPasswordResetEmail({
    name: 'Wanjiku Kamau',
    email: 'wanjiku@example.com',
    token: 'f3a9c1d27b5e48a06c9d1e2b7a4f8035c6d9e1a2b3c4d5e6f708192a3b4c5d6e',
  }),
};

for (const [name, { html }] of Object.entries(samples)) {
  const file = path.join(outDir, `${name}.html`);
  fs.writeFileSync(file, html);
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}
