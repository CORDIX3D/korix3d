import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigurationError';
  }
}

export function isStripeConfigurationError(
  error: unknown
): error is StripeConfigurationError {
  return error instanceof StripeConfigurationError;
}

export function getStripeServer() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeConfigurationError('STRIPE_SECRET_KEY is not configured');
  }

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' });
    stripeClientKey = secretKey;
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StripeConfigurationError('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

export function getStripeCheckoutOrigin(fallbackOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredOrigin && process.env.NODE_ENV === 'production') {
    throw new StripeConfigurationError('NEXT_PUBLIC_SITE_URL is not configured');
  }

  try {
    const url = new URL(configuredOrigin || fallbackOrigin);
    if (
      process.env.NODE_ENV === 'production' &&
      url.protocol !== 'https:'
    ) {
      throw new StripeConfigurationError('NEXT_PUBLIC_SITE_URL must use HTTPS');
    }
    return url.origin;
  } catch (error) {
    if (isStripeConfigurationError(error)) throw error;
    throw new StripeConfigurationError('NEXT_PUBLIC_SITE_URL is invalid');
  }
}
