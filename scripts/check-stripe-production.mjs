import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const checkout = await readFile(
  join(root, 'app/api/stripe/create-checkout-session/route.ts'),
  'utf8'
);
const webhook = await readFile(
  join(root, 'app/api/stripe/webhook/route.ts'),
  'utf8'
);
const stripe = await readFile(join(root, 'lib/stripe.ts'), 'utf8');
const environment = await readFile(join(root, '.env.example'), 'utf8');

const checkoutRequirements = [
  "currency: 'pln'",
  "automatic_tax: { enabled: false }",
  "prices_include_tax: 'true'",
  "success_url: `${origin}/checkout/sukces?session_id={CHECKOUT_SESSION_ID}`",
  "cancel_url: `${origin}/checkout?cancelled=1&order=${encodeURIComponent(order.id)}`",
  "idempotencyKey: `korix3d-checkout-${order.id}`",
  'getStripeWebhookSecret();',
];

const webhookRequirements = [
  "request.headers.get('stripe-signature')",
  'webhooks.constructEvent(',
  "'charge.refunded'",
  "'checkout.session.async_payment_failed'",
  "'checkout.session.async_payment_succeeded'",
  "'checkout.session.completed'",
  "'checkout.session.expired'",
  "'payment_intent.payment_failed'",
  "'claim_stripe_webhook_event'",
  "'finish_stripe_webhook_event'",
  "'fail_stripe_webhook_event'",
];

for (const requirement of checkoutRequirements) {
  if (!checkout.includes(requirement)) {
    throw new Error(`Brak zabezpieczenia Stripe Checkout: ${requirement}`);
  }
}

for (const requirement of webhookRequirements) {
  if (!webhook.includes(requirement)) {
    throw new Error(`Brak zabezpieczenia webhooka Stripe: ${requirement}`);
  }
}

if (!stripe.includes("apiVersion: '2026-06-24.dahlia'")) {
  throw new Error('Wersja API Stripe nie jest przypięta.');
}

for (const variable of ['STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=']) {
  if (!environment.includes(variable)) {
    throw new Error(`Brak zmiennej Stripe w .env.example: ${variable}`);
  }
}

console.log('Kontrakt produkcyjny Stripe jest kompletny.');
