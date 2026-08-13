const STRIPE_CREDENTIAL_ERROR_CODES = new Set([
  'api_key_expired',
  'api_key_invalid',
]);

export function isStripeCredentialError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; type?: unknown };
  return candidate.type === 'StripeAuthenticationError'
    || (
      typeof candidate.code === 'string'
      && STRIPE_CREDENTIAL_ERROR_CODES.has(candidate.code)
    );
}
