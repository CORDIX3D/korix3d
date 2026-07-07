import type { CartItem } from '@/lib/cart-provider';

export const CHECKOUT_CURRENCY = 'PLN' as const;

export interface CheckoutDraft {
  customer: { email: string; name: string; phone: string };
  shippingAddress: { street: string; postalCode: string; city: string; country: 'PL' };
  items: Array<Pick<CartItem, 'id' | 'quantity'>>;
  currency: typeof CHECKOUT_CURRENCY;
}

// TODO(stripe): chroniony endpoint ma ponownie pobrać ceny i stany z Supabase,
// utworzyć Stripe Checkout Session i zwrócić wyłącznie bezpieczny URL Stripe.
