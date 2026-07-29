import Stripe from 'stripe';
import {
  EnvironmentConfigurationError,
  getRequiredStripeEnvironment,
} from '@/lib/env/server';

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
  return error instanceof StripeConfigurationError
    || error instanceof EnvironmentConfigurationError;
}

export function getStripeServer() {
  const environment = getRequiredStripeEnvironment();
  const secretKey = environment.STRIPE_SECRET_KEY;

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' });
    stripeClientKey = secretKey;
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  return getRequiredStripeEnvironment().STRIPE_WEBHOOK_SECRET;
}

export function getStripeCheckoutOrigin(fallbackOrigin: string) {
  const configuredOrigin = getRequiredStripeEnvironment().NEXT_PUBLIC_SITE_URL;

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
