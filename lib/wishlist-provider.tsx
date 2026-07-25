'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';

type WishlistToggleResult = 'added' | 'removed' | 'login_required' | 'error';

type WishlistContextValue = {
  productIds: string[];
  loading: boolean;
  error: string;
  isSaved: (productId: string) => boolean;
  isPending: (productId: string) => boolean;
  toggle: (productId: string) => Promise<WishlistToggleResult>;
  refresh: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setProductIds([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('wishlist_items')
        .select('product_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(250);

      if (queryError) throw queryError;
      setProductIds((data || []).map((item: { product_id: string }) => item.product_id));
    } catch {
      setProductIds([]);
      setError('Nie udało się pobrać listy życzeń. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async (productId: string): Promise<WishlistToggleResult> => {
    if (!user) return 'login_required';
    if (pendingIds.includes(productId)) return 'error';

    const saved = productIds.includes(productId);
    const previousIds = productIds;
    setPendingIds((current) => [...current, productId]);
    setProductIds((current) => saved
      ? current.filter((id) => id !== productId)
      : [productId, ...current]
    );
    setError('');

    try {
      const result = saved
        ? await supabase
            .from('wishlist_items')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', productId)
        : await supabase
            .from('wishlist_items')
            .upsert(
              { user_id: user.id, product_id: productId },
              { onConflict: 'user_id,product_id', ignoreDuplicates: true }
            );

      if (result.error) throw result.error;
      return saved ? 'removed' : 'added';
    } catch {
      setProductIds(previousIds);
      setError('Nie udało się zapisać zmiany na liście życzeń.');
      return 'error';
    } finally {
      setPendingIds((current) => current.filter((id) => id !== productId));
    }
  }, [pendingIds, productIds, user]);

  const value = useMemo<WishlistContextValue>(() => ({
    productIds,
    loading: authLoading || loading,
    error,
    isSaved: (productId) => productIds.includes(productId),
    isPending: (productId) => pendingIds.includes(productId),
    toggle,
    refresh,
  }), [authLoading, error, loading, pendingIds, productIds, refresh, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
}
