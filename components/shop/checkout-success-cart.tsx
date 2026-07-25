'use client';

import { useEffect } from 'react';
import { useCart } from '@/lib/cart-provider';

export function CheckoutSuccessCart({ clear }: { clear: boolean }) {
  const { clearCart } = useCart();

  useEffect(() => {
    if (!clear) return;
    clearCart();
    window.sessionStorage.removeItem('korix3d_pending_payment');
  }, [clear, clearCart]);

  return null;
}
