const { BRAND, LINKS, escapeHtml, firstNameOf, button, renderLayout, textFooter } = require('./layout');

const FOOTER_NOTE = 'You received this email because you created a PayLink account.';

const STEPS = [
  'Log in to your dashboard',
  'Create your first payment link',
  'Share the link with your customer',
  'Get paid via M-Pesa instantly',
];

const INTRO =
  'Your PayLink account is ready. You can now start accepting M-Pesa payments from your customers with a simple payment link.';

function buildWelcomeEmail({ name }) {
  const firstName = firstNameOf(name);

  const steps = STEPS.map(
    (step) => `<li style="margin: 0 0 8px; padding-left: 4px;">${escapeHtml(step)}</li>`,
  ).join('\n');

  const content = `
<h1 style="margin: 0 0 16px; font-family: ${BRAND.font}; font-size: 28px; line-height: 1.25; color: ${BRAND.dark};">Welcome, ${escapeHtml(firstName)}!</h1>
<p style="margin: 0 0 24px;">${escapeHtml(INTRO)}</p>
<h2 style="margin: 0 0 12px; font-family: ${BRAND.font}; font-size: 18px; color: ${BRAND.dark};">Quick start</h2>
<ol style="margin: 0; padding-left: 22px;">
${steps}
</ol>
${button('Go to Dashboard', LINKS.dashboard)}`;

  const html = renderLayout({
    title: 'Welcome to PayLink',
    preheader: `Welcome, ${firstName}! Your PayLink account is ready.`,
    content,
    footerNote: FOOTER_NOTE,
  });

  const text = [
    `Welcome, ${firstName}!`,
    '',
    INTRO,
    '',
    'Quick start:',
    ...STEPS.map((step, i) => `${i + 1}. ${step}`),
    '',
    `Go to Dashboard: ${LINKS.dashboard}`,
    '',
    textFooter(FOOTER_NOTE),
  ].join('\n');

  return { html, text };
}

module.exports = { buildWelcomeEmail };
