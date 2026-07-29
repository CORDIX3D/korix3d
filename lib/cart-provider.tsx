'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/lib/types/database';
import {
  addCartItem,
  getCartSummary,
  type CartItem,
  removeCartItem,
  sanitizeCart,
  updateCartItemQuantity,
} from '@/lib/cart';

const STORAGE_KEY = 'korix3d_cart';
export type { CartItem } from '@/lib/cart';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  replaceCart: (items: CartItem[]) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function readCart(): CartItem[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return sanitizeCart(parsed);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setHydrated(true);
    const syncCart = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener('storage', syncCart);
    return () => window.removeEventListener('storage', syncCart);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage can fail in private mode or when storage quota is exceeded.
    }
  }, [hydrated, items]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    setItems((current) => addCartItem(current, product, quantity));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((current) => removeCartItem(current, productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => updateCartItemQuantity(current, productId, quantity));
  }, []);

  const replaceCart = useCallback((nextItems: CartItem[]) => {
    setItems(sanitizeCart(nextItems));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const { itemCount, subtotal } = getCartSummary(items);

  const value = useMemo(() => ({ items, itemCount, subtotal, hydrated, addToCart, removeFromCart, updateQuantity, replaceCart, clearCart }), [items, itemCount, subtotal, hydrated, addToCart, removeFromCart, updateQuantity, replaceCart, clearCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
