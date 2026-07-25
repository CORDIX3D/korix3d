import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createCheckoutToken() {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashCheckoutToken(token) };
}

export function hashCheckoutToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyCheckoutToken(token: string, expectedHash: string | null | undefined) {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashCheckoutToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
