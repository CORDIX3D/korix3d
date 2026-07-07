'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/lib/types/database';

const STORAGE_KEY = 'korix3d_cart';

export interface CartItem {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stockQuantity: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function readCart(): CartItem[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === 'string' && Number(item.quantity) > 0)
      : [];
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
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    if (product.stock_quantity <= 0) return;
    const images = Array.isArray(product.images) ? product.images as string[] : [];
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + Math.max(1, quantity), product.stock_quantity) }
          : item);
      }
      return [...current, {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        price: Number(product.price),
        image: images[0] || null,
        quantity: Math.min(Math.max(1, quantity), product.stock_quantity),
        stockQuantity: product.stock_quantity,
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current
      .map((item) => item.id === productId
        ? { ...item, quantity: Math.min(Math.max(0, quantity), item.stockQuantity) }
        : item)
      .filter((item) => item.quantity > 0));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value = useMemo(() => ({ items, itemCount, subtotal, hydrated, addToCart, removeFromCart, updateQuantity, clearCart }), [items, itemCount, subtotal, hydrated, addToCart, removeFromCart, updateQuantity, clearCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
