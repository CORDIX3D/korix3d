import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const checkout = await readFile(
  join(root, 'app/api/stripe/create-checkout-session/route.ts'),
  'utf8'
);
const quoteCheckout = await readFile(
  join(root, 'app/api/stripe/create-quote-checkout-session/route.ts'),
  'utf8'
);
const quoteCancellation = await readFile(
  join(root, 'app/api/stripe/cancel-quote-checkout/route.ts'),
  'utf8'
);
const quoteRefund = await readFile(
  join(root, 'app/api/admin/orders/refund/route.ts'),
  'utf8'
);
const webhook = await readFile(
  join(root, 'app/api/stripe/webhook/route.ts'),
  'utf8'
);
const stripe = await readFile(join(root, 'lib/stripe.ts'), 'utf8');
const stripeError = await readFile(join(root, 'lib/stripe-error.ts'), 'utf8');
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
  "'complete_quote_payment_locked'",
  "'release_quote_payment_locked'",
  "'refund_quote_payment_locked'",
];

const quoteCheckoutRequirements = [
  "order_type: 'quote'",
  "billing_address_collection: 'required'",
  "shipping_address_collection = { allowed_countries: ['PL'] }",
  'getStripeWebhookSecret();',
  "'/api/stripe/create-quote-checkout-session'",
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

for (const requirement of quoteCheckoutRequirements.slice(0, 4)) {
  if (!quoteCheckout.includes(requirement)) {
    throw new Error(`Brak zabezpieczenia płatności za wycenę: ${requirement}`);
  }
}

if (!quoteCancellation.includes("'release_quote_payment_locked'")) {
  throw new Error('Anulowanie płatności za wycenę nie zwalnia rezerwacji materiału.');
}

for (const requirement of [
  'requireAdminApiContext()',
  'isTrustedMutationRequest(request)',
  'stripe_payment_intent_id',
  'refunds.create(',
  'idempotencyKey: `korix3d-quote-refund-${order.id}`',
]) {
  if (!quoteRefund.includes(requirement)) {
    throw new Error(`Brak zabezpieczenia administracyjnego zwrotu wyceny: ${requirement}`);
  }
}

const quotePage = await readFile(join(root, 'app/(public)/wycena/page.tsx'), 'utf8');
if (!quotePage.includes(quoteCheckoutRequirements[4])) {
  throw new Error('Gotowa wycena nie otwiera Stripe Checkout.');
}

if (!stripe.includes("apiVersion: '2026-06-24.dahlia'")) {
  throw new Error('Wersja API Stripe nie jest przypięta.');
}

for (const errorCode of ['api_key_expired', 'api_key_invalid']) {
  if (!stripeError.includes(`'${errorCode}'`)) {
    throw new Error(`Brak obsługi błędu poświadczeń Stripe: ${errorCode}`);
  }
}
if (!stripe.includes('isStripeCredentialError(error)')) {
  throw new Error('Błędy poświadczeń Stripe nie są mapowane na błąd konfiguracji.');
}

for (const variable of ['STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=']) {
  if (!environment.includes(variable)) {
    throw new Error(`Brak zmiennej Stripe w .env.example: ${variable}`);
  }
}

console.log('Kontrakt produkcyjny Stripe jest kompletny.');
