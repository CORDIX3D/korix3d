'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/lib/types/database';

const STORAGE_KEY = 'korix3d_cart';
const MAX_CART_QUANTITY = 99;

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
    if (!Array.isArray(parsed)) return [];

    return parsed.reduce<CartItem[]>((validItems, item) => {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') return validItems;

      const price = Number(item.price);
      const stockQuantity = Math.floor(Number(item.stockQuantity));
      const quantity = Math.floor(Number(item.quantity));
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stockQuantity) || stockQuantity < 1 || !Number.isFinite(quantity) || quantity < 1) {
        return validItems;
      }

      validItems.push({
        id: item.id,
        slug: typeof item.slug === 'string' && item.slug.trim() ? item.slug : item.id,
        sku: typeof item.sku === 'string' ? item.sku : '',
        name: item.name,
        price,
        image: typeof item.image === 'string' && item.image ? item.image : null,
        quantity: Math.min(quantity, stockQuantity, MAX_CART_QUANTITY),
        stockQuantity: Math.min(stockQuantity, MAX_CART_QUANTITY),
      });
      return validItems;
    }, []);
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
    const stockQuantity = Math.min(Math.floor(Number(product.stock_quantity)), MAX_CART_QUANTITY);
    const price = Number(product.price);
    if (!Number.isFinite(stockQuantity) || stockQuantity <= 0 || !Number.isFinite(price) || price < 0) return;

    const safeQuantity = Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), stockQuantity);
    const images = Array.isArray(product.images) ? product.images as string[] : [];
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + safeQuantity, stockQuantity), stockQuantity }
          : item);
      }
      return [...current, {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        price,
        image: images[0] || null,
        quantity: safeQuantity,
        stockQuantity,
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current
      .map((item) => item.id === productId
        ? { ...item, quantity: Math.min(Math.max(0, Math.floor(Number(quantity) || 0)), item.stockQuantity, MAX_CART_QUANTITY) }
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
