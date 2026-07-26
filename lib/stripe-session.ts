export type StripeSessionBinding = 'unbound' | 'match' | 'mismatch';

export function getStripeSessionBinding(
  storedSessionId: string | null | undefined,
  receivedSessionId: string
): StripeSessionBinding {
  const stored = String(storedSessionId || '').trim();
  const received = String(receivedSessionId || '').trim();

  if (!stored) return 'unbound';
  return stored === received ? 'match' : 'mismatch';
}
