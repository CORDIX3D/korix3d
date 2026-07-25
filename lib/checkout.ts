import type { CartItem } from '@/lib/cart-provider';

export const CHECKOUT_CURRENCY = 'PLN' as const;
export const CHECKOUT_PAYMENT_MODE = 'stripe_checkout' as const;

export type CheckoutBillingAddress = {
  invoiceType: 'individual' | 'company';
  name: string;
  company: string;
  nip: string;
  street: string;
  postalCode: string;
  city: string;
  country: 'PL';
};

export interface CheckoutDraft {
  customer: { email: string; name: string; phone: string };
  shippingAddress: { street: string; postalCode: string; city: string; country: 'PL' };
  billingAddress: CheckoutBillingAddress;
  items: Array<Pick<CartItem, 'id' | 'quantity'>>;
  currency: typeof CHECKOUT_CURRENCY;
}

// Endpoint pobiera ceny i stany ponownie po stronie Supabase, rezerwuje magazyn
// transakcyjnie, a dane karty są podawane wyłącznie na stronie Stripe Checkout.
