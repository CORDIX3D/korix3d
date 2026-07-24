import type { CartItem } from '@/lib/cart-provider';

export const CHECKOUT_CURRENCY = 'PLN' as const;
export const CHECKOUT_PAYMENT_MODE = 'manual_confirmation' as const;

export interface CheckoutDraft {
  customer: { email: string; name: string; phone: string };
  shippingAddress: { street: string; postalCode: string; city: string; country: 'PL' };
  items: Array<Pick<CartItem, 'id' | 'quantity'>>;
  currency: typeof CHECKOUT_CURRENCY;
}

// MVP checkout nie pobiera danych karty. Endpoint /api/store/orders pobiera
// ceny i stany ponownie po stronie Supabase, tworzy zamówienie transakcyjnie
// i zmniejsza magazyn. Stripe zostanie dodany później jako osobny tryb płatności.
