export const STRIPE_CHECKOUT_RELEASE_EVENTS = [
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
] as const;

export function isExpectedStripeAmount(
  currency: string | null | undefined,
  amountInCents: number | null | undefined,
  orderTotal: number
) {
  return currency === 'pln'
    && Number.isFinite(orderTotal)
    && amountInCents === Math.round(orderTotal * 100);
}

export function isFullStripeRefund(input: {
  refunded: boolean;
  amount: number;
  amountRefunded: number;
}) {
  return input.refunded
    && Number.isInteger(input.amount)
    && input.amount > 0
    && Number.isInteger(input.amountRefunded)
    && input.amountRefunded >= input.amount;
}

export function shouldReleaseStockAfterStripeEvent(eventType: string) {
  return (STRIPE_CHECKOUT_RELEASE_EVENTS as readonly string[]).includes(eventType);
}
